// V6.4 — HTTP surface for the IES extraction + economic profile flow.
//
// Auth: every route is mounted under apps/api/src/app.ts's authed
// surface. We additionally check org membership (canOrgRelation) before
// touching tenant data. Status: poll-based; the UI re-fetches GET
// /economic-profile/ies/:id until the row enters a terminal state.

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { canOrgRelation } from "../../../auth-helpers.js";
import type { AppEnv } from "../../../context.js";
import {
  economicProfileService,
  iesExtractionService,
  iesUploadService,
} from "../../../services.js";

const editsSchema = z
  .object({
    year: z.number().int().min(1990).max(2100).optional(),
    employees: z.number().int().min(0).nullable().optional(),
    turnover: z.number().min(0).nullable().optional(),
    ebitda: z.number().nullable().optional(),
    balanceSheetTotal: z.number().min(0).nullable().optional(),
    cae: z.string().min(1).max(64).nullable().optional(),
  })
  .strict();

const manualEntrySchema = z
  .object({
    year: z.number().int().min(1990).max(2100),
    employees: z.number().int().min(0).nullable(),
    turnover: z.number().min(0).nullable(),
    ebitda: z.number().nullable(),
    balanceSheetTotal: z.number().min(0).nullable(),
    cae: z.string().min(1).max(64).nullable(),
  })
  .strict();

const dimensaoConfirmSchema = z
  .object({
    dimensao: z.enum(["micro", "pequena", "media", "grande"]),
    source: z.enum(["ai_classified", "user_override"]),
  })
  .strict();

const yearParamSchema = z.object({
  year: z.coerce.number().int().min(1990).max(2100),
});

const listQuerySchema = z.object({
  year: z.coerce.number().int().min(1990).max(2100).optional(),
});

// Tenant gate. Every route requires the user to be a member of the
// active organization in any role (admin or member — both can upload
// IES). Returns null on success or a JSON response on failure.
async function requireOrgMembership(
  c: import("hono").Context<AppEnv>,
): Promise<{ orgId: string; canWrite: boolean } | Response> {
  const orgId = c.var.organizationId;
  if (!orgId) return c.json({ error: "no_active_org" }, 400);
  const userId = c.var.user.id;
  // Members in any role (admin, writer, or reader) can poll status +
  // list profiles. Mutating routes (upload, confirm, cancel, manual)
  // re-check with finer-grained gates inline.
  const [isAdmin, isWriter, isReader] = await Promise.all([
    canOrgRelation(userId, orgId, "org_admin"),
    canOrgRelation(userId, orgId, "org_user_write"),
    canOrgRelation(userId, orgId, "org_user_read"),
  ]);
  if (!isAdmin && !isWriter && !isReader) return c.json({ error: "forbidden" }, 403);
  return { orgId, canWrite: isAdmin || isWriter };
}

// Stricter gate for mutating routes — read-only members can poll but
// can't upload/confirm/manual-enter. Mirrors the existing pattern: V5.8
// reversal split membership into read/write/admin tiers.
async function requireOrgWrite(
  c: import("hono").Context<AppEnv>,
): Promise<{ orgId: string } | Response> {
  const gate = await requireOrgMembership(c);
  if (gate instanceof Response) return gate;
  if (!gate.canWrite) return c.json({ error: "forbidden" }, 403);
  return { orgId: gate.orgId };
}

export const economicProfileRoutes = new Hono<AppEnv>()
  // ── Upload an IES PDF and kick off extraction ──
  // multipart/form-data: field name `file`. No JSON validation here —
  // size + MIME checks live in IesUploadService.
  .post("/ies", async (c) => {
    const gate = await requireOrgWrite(c);
    if (gate instanceof Response) return gate;
    const { orgId } = gate;

    const form = await c.req.parseBody();
    const file = form.file;
    if (!(file instanceof File)) {
      return c.json({ error: "file_required" }, 400);
    }

    const result = await iesUploadService.start({
      organizationId: orgId,
      userId: c.var.user.id,
      filename: file.name,
      mimeType: file.type,
      body: new Uint8Array(await file.arrayBuffer()),
    });
    if (!result.ok) {
      // 413 for size, 415 for MIME, 500 for storage. The service's
      // discriminated union maps cleanly to HTTP codes.
      const status =
        result.error.kind === "too_large"
          ? 413
          : result.error.kind === "not_pdf"
            ? 415
            : result.error.kind === "empty_file"
              ? 400
              : 500;
      return c.json({ error: result.error.kind }, status);
    }
    return c.json(result.log, 202);
  })
  // ── Poll status ──
  .get("/ies/:id", async (c) => {
    const gate = await requireOrgMembership(c);
    if (gate instanceof Response) return gate;
    const log = await iesExtractionService.getStatus(gate.orgId, c.req.param("id"));
    if (!log) return c.json({ error: "not_found" }, 404);
    return c.json(log);
  })
  // ── Confirm extraction (optionally with edits) ──
  .post("/ies/:id/confirm", zValidator("json", editsSchema), async (c) => {
    const gate = await requireOrgWrite(c);
    if (gate instanceof Response) return gate;
    const edits = c.req.valid("json");
    const result = await iesExtractionService.confirm(gate.orgId, c.req.param("id"), edits);
    if (!result.ok) {
      const status = result.error === "log_not_found" ? 404 : 409;
      return c.json({ error: result.error }, status);
    }
    return c.json(result.profile);
  })
  // ── Cancel extraction ──
  .post("/ies/:id/cancel", async (c) => {
    const gate = await requireOrgWrite(c);
    if (gate instanceof Response) return gate;
    const result = await iesExtractionService.cancel(gate.orgId, c.req.param("id"));
    if (!result.ok) {
      const status = result.error === "log_not_found" ? 404 : 409;
      return c.json({ error: result.error }, status);
    }
    return c.json({ ok: true });
  })
  // ── Manual entry fallback ──
  .post("/manual", zValidator("json", manualEntrySchema), async (c) => {
    const gate = await requireOrgWrite(c);
    if (gate instanceof Response) return gate;
    const input = c.req.valid("json");
    const result = await economicProfileService.manualEntry({
      organizationId: gate.orgId,
      ...input,
    });
    if (!result.ok) {
      return c.json({ error: result.error }, 400);
    }
    return c.json(result.profile, 201);
  })
  // ── V7.1 dimensao: propose classification for one year ──
  .get(
    "/:year/dimensao/proposed",
    zValidator("param", yearParamSchema),
    async (c) => {
      const gate = await requireOrgMembership(c);
      if (gate instanceof Response) return gate;
      const { year } = c.req.valid("param");
      const result = await economicProfileService.proposeDimensao(gate.orgId, year);
      if (!result.ok) return c.json({ error: result.error }, 404);
      return c.json({
        year: result.year,
        proposal: result.proposal,
        alreadyConfirmed: result.alreadyConfirmed,
      });
    },
  )
  // ── V7.1 dimensao: confirm classification for one year ──
  .post(
    "/:year/dimensao",
    zValidator("param", yearParamSchema),
    zValidator("json", dimensaoConfirmSchema),
    async (c) => {
      const gate = await requireOrgWrite(c);
      if (gate instanceof Response) return gate;
      const { year } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await economicProfileService.confirmDimensao({
        organizationId: gate.orgId,
        year,
        dimensao: body.dimensao,
        source: body.source,
      });
      if (!result.ok) return c.json({ error: result.error }, 404);
      return c.json(result.profile);
    },
  )
  // ── List profiles for the org (or fetch a specific year) ──
  .get("/", zValidator("query", listQuerySchema), async (c) => {
    const gate = await requireOrgMembership(c);
    if (gate instanceof Response) return gate;
    const { year } = c.req.valid("query");
    if (year !== undefined) {
      const profile = await economicProfileService.findByYear(gate.orgId, year);
      if (!profile) return c.json({ error: "not_found" }, 404);
      return c.json(profile);
    }
    const profiles = await economicProfileService.list(gate.orgId);
    return c.json(profiles);
  });
