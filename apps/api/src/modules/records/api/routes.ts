import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { canCsWrite, canOrgRelation } from "../../../auth-helpers.js";
import type { AppEnv } from "../../../context.js";
import { recordService } from "../../../services.js";

const submitInput = z.object({
  templateId: z.string().uuid(),
  values: z.record(z.string(), z.unknown()),
  asDraft: z.boolean().optional(),
});

const updateInput = z.object({
  values: z.record(z.string(), z.unknown()),
  action: z.enum(["save_draft", "submit"]),
});

const reviewInput = z.object({
  decision: z.enum(["approve", "request_changes", "reject"]),
  comment: z.string().max(2000).nullable().optional(),
});

const prefillQuery = z.object({
  template: z.string().uuid(),
});

export const recordsRoutes = new Hono<AppEnv>()
  .get("/prefill", zValidator("query", prefillQuery), async (c) => {
    const orgId = c.var.organizationId;
    if (!orgId) return c.json({ error: "no_active_org" }, 400);
    const { template } = c.req.valid("query");
    const result = await recordService.computePrefill(orgId, template);
    if ("error" in result) return c.json({ error: result.error }, 404);
    return c.json(result);
  })
  .get("/", async (c) => {
    const orgId = c.var.organizationId;
    if (!orgId) return c.json({ error: "no_active_org" }, 400);
    // Admins see every record in the org; members see their own submissions.
    const isAdmin = await canOrgRelation(c.var.user.id, orgId, "org_admin");
    const list = isAdmin
      ? await recordService.listAll(orgId)
      : await recordService.listMine(orgId, c.var.user.id);
    return c.json(list);
  })
  .get("/:id", async (c) => {
    const orgId = c.var.organizationId;
    if (!orgId) return c.json({ error: "no_active_org" }, 400);
    const record = await recordService.get(orgId, c.req.param("id"));
    if (!record) return c.json({ error: "not_found" }, 404);
    // Members can only fetch their own records; admins can fetch any.
    const isAdmin = await canOrgRelation(c.var.user.id, orgId, "org_admin");
    if (!isAdmin && record.submittedByUserId !== c.var.user.id) {
      return c.json({ error: "forbidden" }, 403);
    }
    return c.json(record);
  })
  .post("/", zValidator("json", submitInput), async (c) => {
    const orgId = c.var.organizationId;
    if (!orgId) return c.json({ error: "no_active_org" }, 400);
    const input = c.req.valid("json");
    const result = await recordService.submit({
      organizationId: orgId,
      templateId: input.templateId,
      rawValues: input.values,
      submitterUserId: c.var.user.id,
      asDraft: input.asDraft,
      actorTopicScope: c.var.topicScope ?? [],
    });
    if (!result.ok) {
      if (result.code === "validation_failed") {
        return c.json({ error: result.code, errors: result.errors }, 422);
      }
      return c.json({ error: result.code }, 400);
    }
    return c.json(result.record, 201);
  })
  .post("/:id/review", zValidator("json", reviewInput), async (c) => {
    const orgId = c.var.organizationId;
    if (!orgId) return c.json({ error: "no_active_org" }, 400);
    // V5.4: review responsibility lives on central services, not on org
    // admins. Any CS admin or maintainer can act as the reviewer.
    if (!(await canCsWrite(c.var.user.id))) {
      return c.json({ error: "central_services_required" }, 403);
    }
    const input = c.req.valid("json");
    const result = await recordService.review({
      organizationId: orgId,
      recordId: c.req.param("id"),
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
  .patch("/:id", zValidator("json", updateInput), async (c) => {
    const orgId = c.var.organizationId;
    if (!orgId) return c.json({ error: "no_active_org" }, 400);
    const input = c.req.valid("json");
    const result = await recordService.update({
      organizationId: orgId,
      recordId: c.req.param("id"),
      rawValues: input.values,
      actorUserId: c.var.user.id,
      action: input.action,
      actorTopicScope: c.var.topicScope ?? [],
    });
    if (!result.ok) {
      if (result.code === "validation_failed") {
        return c.json({ error: result.code, errors: result.errors }, 422);
      }
      if (result.code === "forbidden") return c.json({ error: result.code }, 403);
      if (result.code === "record_not_found") return c.json({ error: result.code }, 404);
      return c.json({ error: result.code }, 400);
    }
    return c.json(result.record);
  });
