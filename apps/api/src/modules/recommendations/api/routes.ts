// V9.2 — HTTP surface for the recommendations module.
//
// Flow:
//   POST /recommendations              → start a run, returns the
//                                        row id (202 Accepted)
//   GET  /recommendations              → list history (admin: all;
//                                        member: own only)
//   GET  /recommendations/:id          → poll one run's status
//   POST /recommendations/:id/feedback → record per-item feedback
//
// Auth: mounted under the authed surface in apps/api/src/app.ts.
// Authorization: any org member can trigger a generation (member or
// admin). Admins see all generations in /recommendations; members
// see only their own. Tenant scope enforced via orgScope at the repo
// layer plus per-route org-id checks below.

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { canOrgRelation } from "../../../auth-helpers.js";
import type { AppEnv } from "../../../context.js";
import { recommendationsService } from "../../../services.js";

const feedbackKindSchema = z.enum([
  "util",
  "ja_implementada",
  "nao_aplicavel",
  "irrelevante",
  "incorreta",
]);

const feedbackBodySchema = z
  .object({
    recommendationIndex: z.number().int().min(0),
    kind: feedbackKindSchema,
  })
  .strict();

// Gate helper: same pattern as economic-profile routes. Returns the
// authed org id + role hints on success or a JSON response on failure.
async function requireOrgMembership(
  c: import("hono").Context<AppEnv>,
): Promise<{ orgId: string; isAdmin: boolean } | Response> {
  const orgId = c.var.organizationId;
  if (!orgId) return c.json({ error: "no_active_org" }, 400);
  const userId = c.var.user.id;
  const [isAdmin, isWriter, isReader] = await Promise.all([
    canOrgRelation(userId, orgId, "org_admin"),
    canOrgRelation(userId, orgId, "org_user_write"),
    canOrgRelation(userId, orgId, "org_user_read"),
  ]);
  if (!isAdmin && !isWriter && !isReader) return c.json({ error: "forbidden" }, 403);
  return { orgId, isAdmin };
}

async function requireOrgWrite(
  c: import("hono").Context<AppEnv>,
): Promise<{ orgId: string; isAdmin: boolean } | Response> {
  const gate = await requireOrgMembership(c);
  if (gate instanceof Response) return gate;
  const userId = c.var.user.id;
  const canWrite = gate.isAdmin || (await canOrgRelation(userId, gate.orgId, "org_user_write"));
  if (!canWrite) return c.json({ error: "forbidden" }, 403);
  return gate;
}

export const recommendationsRoutes = new Hono<AppEnv>()
  // ── Start a new generation run ──
  .post("/", async (c) => {
    const gate = await requireOrgWrite(c);
    if (gate instanceof Response) return gate;
    const result = await recommendationsService.start({
      organizationId: gate.orgId,
      userId: c.var.user.id,
    });
    if (!result.ok) {
      return c.json({ error: result.error.kind }, 500);
    }
    return c.json(result.generated, 202);
  })
  // ── History view ──
  .get("/", async (c) => {
    const gate = await requireOrgMembership(c);
    if (gate instanceof Response) return gate;
    const history = await recommendationsService.listHistory(gate.orgId);
    // Members see only their own runs; admins see everything. The
    // tenant scope already filters out other orgs entirely.
    const visible = gate.isAdmin
      ? history
      : history.filter((entry) => entry.generation.requestedByUserId === c.var.user.id);
    return c.json(visible);
  })
  // ── Poll one run ──
  .get("/:id", async (c) => {
    const gate = await requireOrgMembership(c);
    if (gate instanceof Response) return gate;
    const row = await recommendationsService.getStatus(gate.orgId, c.req.param("id"));
    if (!row) return c.json({ error: "not_found" }, 404);
    if (!gate.isAdmin && row.requestedByUserId !== c.var.user.id) {
      return c.json({ error: "forbidden" }, 403);
    }
    return c.json(row);
  })
  // ── Per-item feedback (upsert) ──
  .post("/:id/feedback", zValidator("json", feedbackBodySchema), async (c) => {
    const gate = await requireOrgMembership(c);
    if (gate instanceof Response) return gate;
    const body = c.req.valid("json");
    const result = await recommendationsService.recordFeedback({
      organizationId: gate.orgId,
      userId: c.var.user.id,
      generationId: c.req.param("id"),
      recommendationIndex: body.recommendationIndex,
      kind: body.kind,
    });
    if (!result.ok) {
      const status =
        result.error === "generation_not_found"
          ? 404
          : result.error === "out_of_range"
            ? 400
            : 409;
      return c.json({ error: result.error }, status);
    }
    return c.json(result.feedback, 201);
  });
