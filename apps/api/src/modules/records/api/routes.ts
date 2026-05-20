import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../../context.js";
import { recordService } from "../../../services.js";

const submitInput = z.object({
  templateId: z.string().uuid(),
  values: z.record(z.string(), z.unknown()),
  asDraft: z.boolean().optional(),
});

export const recordsRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const orgId = c.var.organizationId;
    if (!orgId) return c.json({ error: "no_active_org" }, 400);
    // Admins see every record in the org; members see their own submissions.
    const list =
      c.var.membershipRole === "admin"
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
    if (c.var.membershipRole !== "admin" && record.submittedByUserId !== c.var.user.id) {
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
    });
    if (!result.ok) {
      if (result.code === "validation_failed") {
        return c.json({ error: result.code, errors: result.errors }, 422);
      }
      return c.json({ error: result.code }, 400);
    }
    return c.json(result.record, 201);
  });
