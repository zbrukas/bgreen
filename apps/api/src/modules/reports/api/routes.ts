// V11.3 — HTTP surface for the reports module.
//
//   POST /reports                  → start a generation (admin only;
//                                    202 Accepted)
//   GET  /reports                  → list reports for the org
//   GET  /reports/:id              → poll one report's status
//   GET  /reports/:id/download     → 302 to a presigned S3 URL
//                                    (writes a `report.downloaded`
//                                    audit row)
//
// Per V11 plan §FGA: only `admin` can trigger generation; all
// members can download. Tenant scope enforced via orgScope at the
// repo layer plus per-route org-id checks.

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { canOrgRelation } from "../../../auth-helpers.js";
import type { AppEnv } from "../../../context.js";
import { reportService } from "../../../services.js";

const generateBodySchema = z
  .object({
    template: z.enum(["ghg-inventory", "esrs-e1", "custom"]),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    // Optional pt-PT title for Custom reports. Ignored for ghg /
    // esrs templates (they have fixed titles).
    customTitle: z.string().min(1).max(200).optional(),
  })
  .strict()
  .refine((v) => v.periodStart <= v.periodEnd, {
    message: "periodStart must be <= periodEnd",
  });

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

async function requireOrgAdmin(
  c: import("hono").Context<AppEnv>,
): Promise<{ orgId: string } | Response> {
  const gate = await requireOrgMembership(c);
  if (gate instanceof Response) return gate;
  if (!gate.isAdmin) return c.json({ error: "forbidden" }, 403);
  return { orgId: gate.orgId };
}

export const reportsRoutes = new Hono<AppEnv>()
  .post("/", zValidator("json", generateBodySchema), async (c) => {
    const gate = await requireOrgAdmin(c);
    if (gate instanceof Response) return gate;
    const body = c.req.valid("json");
    const result = await reportService.start({
      organizationId: gate.orgId,
      userId: c.var.user.id,
      template: body.template,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      customTitle: body.customTitle,
    });
    if (!result.ok) {
      return c.json({ error: result.error.kind }, 500);
    }
    return c.json(result.report, 202);
  })
  .get("/", async (c) => {
    const gate = await requireOrgMembership(c);
    if (gate instanceof Response) return gate;
    const reports = await reportService.list(gate.orgId);
    return c.json(reports);
  })
  .get("/:id", async (c) => {
    const gate = await requireOrgMembership(c);
    if (gate instanceof Response) return gate;
    const report = await reportService.getStatus(gate.orgId, c.req.param("id"));
    if (!report) return c.json({ error: "not_found" }, 404);
    return c.json(report);
  })
  .get("/:id/download", async (c) => {
    const gate = await requireOrgMembership(c);
    if (gate instanceof Response) return gate;
    const result = await reportService.downloadUrl({
      organizationId: gate.orgId,
      actorUserId: c.var.user.id,
      reportId: c.req.param("id"),
    });
    if (!result.ok) {
      const status =
        result.error === "not_found"
          ? 404
          : result.error === "not_ready"
            ? 409
            : 500;
      return c.json({ error: result.error }, status);
    }
    return c.redirect(result.url, 302);
  });
