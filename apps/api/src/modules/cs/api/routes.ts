import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { canCsRelation, canCsWrite } from "../../../auth-helpers.js";
import type { AppEnv } from "../../../context.js";
import { recordService, repositories, workflowService } from "../../../services.js";

const reviewInput = z.object({
  decision: z.enum(["approve", "request_changes", "reject"]),
  comment: z.string().max(2000).nullable().optional(),
});

const domainInput = z.object({
  domain: z.string().min(1).max(253),
  note: z.string().max(500).nullable().optional(),
});

// Every /cs/* route requires a central-services user. The check sits in
// every handler since some pages allow any CS role (read) while others
// require admin/maintainer (write).
async function gateCsRead(userId: string): Promise<Response | null> {
  if (await canCsWrite(userId)) return null;
  if (await canCsRelation(userId, "promoter")) return null;
  return Response.json({ error: "central_services_required" }, { status: 403 });
}

async function gateCsAdmin(userId: string): Promise<Response | null> {
  return (await canCsRelation(userId, "admin"))
    ? null
    : Response.json({ error: "central_services_admin_required" }, { status: 403 });
}

export const csRoutes = new Hono<AppEnv>()
  .get("/inbox", async (c) => {
    const denied = await gateCsRead(c.var.user.id);
    if (denied) return denied;
    const instances = await workflowService.listAllSubmitted();
    return c.json(instances);
  })
  .get("/records/:id", async (c) => {
    const denied = await gateCsRead(c.var.user.id);
    if (denied) return denied;
    const record = await repositories.records.findAnyById(c.req.param("id"));
    if (!record) return c.json({ error: "not_found" }, 404);
    return c.json(record);
  })
  .post("/records/:id/review", zValidator("json", reviewInput), async (c) => {
    if (!(await canCsWrite(c.var.user.id))) {
      return c.json({ error: "central_services_required" }, 403);
    }
    const record = await repositories.records.findAnyById(c.req.param("id"));
    if (!record) return c.json({ error: "not_found" }, 404);
    const input = c.req.valid("json");
    const result = await recordService.review({
      organizationId: record.organizationId,
      recordId: record.id,
      reviewerUserId: c.var.user.id,
      decision: input.decision,
      comment: input.comment ?? null,
    });
    if (!result.ok) {
      if (result.code === "record_not_found") return c.json({ error: result.code }, 404);
      return c.json({ error: result.code }, 400);
    }
    return c.json(result.record);
  })
  .get("/domains", async (c) => {
    const denied = await gateCsRead(c.var.user.id);
    if (denied) return denied;
    const list = await repositories.centralServicesDomains.list();
    return c.json(list);
  })
  .post("/domains", zValidator("json", domainInput), async (c) => {
    const denied = await gateCsAdmin(c.var.user.id);
    if (denied) return denied;
    const input = c.req.valid("json");
    const normalized = input.domain.trim().toLowerCase().replace(/^@/, "");
    await repositories.centralServicesDomains.insert({
      domain: normalized,
      note: input.note ?? null,
      createdByUserId: c.var.user.id,
    });
    return c.json({ ok: true });
  })
  .delete("/domains/:id", async (c) => {
    const denied = await gateCsAdmin(c.var.user.id);
    if (denied) return denied;
    await repositories.centralServicesDomains.delete(c.req.param("id"));
    return c.json({ ok: true });
  });
