// V11.1 — apps/pdf Hono app. Two routes:
//   GET  /health
//   POST /render  (internal-token guarded)
//
// V11.1 scope: skeleton + auth + input validation. The actual
// HTML rendering (React Server Components) + Gotenberg call land in
// V11.2; right now /render returns 501 with template_not_yet_implemented
// so the apps/api → apps/pdf transport can be exercised end-to-end
// without touching Gotenberg.

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { z } from "zod";

const renderBodySchema = z
  .object({
    template: z.enum(["ghg-inventory", "esrs-e1", "custom"]),
    data: z.unknown(),
    branding: z.object({
      organizationId: z.string().uuid(),
      organizationName: z.string().min(1),
      logoKey: z.string().nullable(),
      primaryColor: z.string().nullable(),
    }),
  })
  .strict();

// Auth gate: every non-health route requires X-Internal-Token to match
// PDF_INTERNAL_TOKEN. apps/pdf is never publicly exposed — even on a
// shared network, the shared secret defends against accidental
// cross-tenant calls.
function requireInternalToken(c: import("hono").Context): Response | null {
  const expected = process.env.PDF_INTERNAL_TOKEN;
  if (!expected) {
    // Fail closed when misconfigured. apps/api won't have a token to
    // send anyway; surface the misconfiguration as 503 not 200.
    return c.json({ error: "pdf_service_not_configured" }, 503);
  }
  const got = c.req.header("x-internal-token");
  if (got !== expected) {
    return c.json({ error: "forbidden" }, 403);
  }
  return null;
}

export const app = new Hono()
  .use("*", logger())
  .get("/health", (c) => c.json({ status: "ok", service: "pdf" } as const))
  .post("/render", zValidator("json", renderBodySchema), async (c) => {
    const authBlock = requireInternalToken(c);
    if (authBlock) return authBlock;

    // V11.1 — templates not implemented yet. The transport contract is
    // exercised; the actual render lands in V11.2. Return 501 with a
    // discriminator the HttpPdfRenderer maps to render_failed.
    return c.json(
      {
        error: "render_not_implemented",
        message: "apps/pdf /render is not yet implemented; lands in V11.2",
      },
      501,
    );
  });

export type AppType = typeof app;
