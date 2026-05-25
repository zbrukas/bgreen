// V11.2 — apps/pdf Hono app.
//   GET  /health
//   POST /render  (internal-token guarded; runs the full
//                  React-SSR → Gotenberg pipeline)
//
// The route:
//   1. Validates the envelope (template, data, branding).
//   2. Logo URL resolution: if the org uploaded a logo, apps/api
//      passes the S3 object key in branding.logoKey. We sign it
//      via the PDF_LOGO_BASE_URL prefix so Gotenberg can fetch it.
//   3. Server-renders the React template (renderTemplate validates
//      template-specific data; returns the wrapped HTML doc).
//   4. POSTs the HTML to Gotenberg → returns the PDF bytes.

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { z } from "zod";
import {
  type GotenbergClient,
  GotenbergException,
  buildGotenbergClient,
} from "./gotenberg/client.js";
import { renderTemplate } from "./templates/index.js";

const renderBodySchema = z
  .object({
    template: z.enum(["ghg-inventory", "esrs-e1", "custom"]),
    // Per-template data is validated inside renderTemplate against
    // the matching zod schema — we keep this loose at the envelope
    // layer so a typo in template doesn't fail with a confusing
    // discriminated-union error.
    data: z.unknown(),
    branding: z.object({
      organizationId: z.string().uuid(),
      organizationName: z.string().min(1),
      logoKey: z.string().nullable(),
      primaryColor: z.string().nullable(),
    }),
  })
  .strict();

function requireInternalToken(c: import("hono").Context): Response | null {
  const expected = process.env.PDF_INTERNAL_TOKEN;
  if (!expected) {
    return c.json({ error: "pdf_service_not_configured" }, 503);
  }
  const got = c.req.header("x-internal-token");
  if (got !== expected) {
    return c.json({ error: "forbidden" }, 403);
  }
  return null;
}

// Resolve the org's logo key into a URL Gotenberg can fetch. apps/api
// publishes a PDF_LOGO_BASE_URL env var pointing at the bGreen S3
// bucket's public read prefix (or a CloudFront / signed-URL service
// in production). When unset, logos are omitted gracefully.
function resolveLogoUrl(logoKey: string | null): string | null {
  if (!logoKey) return null;
  const base = process.env.PDF_LOGO_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/${logoKey.replace(/^\/+/, "")}`;
}

// One client per process; reused across requests. Read at module load
// so misconfiguration surfaces at boot time (well, lazily on first
// import — Node ESM hoists module initialisers).
let cachedClient: GotenbergClient | null = null;
function gotenbergClient(): GotenbergClient {
  if (cachedClient === null) cachedClient = buildGotenbergClient();
  return cachedClient;
}

export const app = new Hono()
  .use("*", logger())
  .get("/health", (c) => c.json({ status: "ok", service: "pdf" } as const))
  .post("/render", zValidator("json", renderBodySchema), async (c) => {
    const authBlock = requireInternalToken(c);
    if (authBlock) return authBlock;

    const body = c.req.valid("json");

    const renderResult = renderTemplate({
      template: body.template,
      data: body.data,
      branding: {
        organizationName: body.branding.organizationName,
        logoUrl: resolveLogoUrl(body.branding.logoKey),
        primaryColor: body.branding.primaryColor,
      },
    });

    if (!renderResult.ok) {
      const status = renderResult.error === "template_not_found" ? 404 : 400;
      return c.json(
        {
          error: renderResult.error,
          ...(renderResult.details ? { details: renderResult.details } : {}),
        },
        status,
      );
    }

    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await gotenbergClient().convertHtmlToPdf(renderResult.html);
    } catch (e) {
      if (e instanceof GotenbergException) {
        const status = e.error.kind === "transient" ? 503 : 502;
        return c.json({ error: e.error.kind, message: e.error.message }, status);
      }
      const message = e instanceof Error ? e.message : String(e);
      return c.json({ error: "render_failed", message }, 502);
    }

    return new Response(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdfBytes.byteLength),
      },
    });
  });

export type AppType = typeof app;
