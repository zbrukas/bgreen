import { FormSchemaSchema } from "@bgreen/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../../context.js";
import { recordTemplateService } from "../../../services.js";

const workflowDefinitionIdSchema = z.enum([
  "single-step-submit",
  "two-step-review",
  "three-step-certify",
]);

const createInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  formSchema: FormSchemaSchema,
  workflowDefinitionId: workflowDefinitionIdSchema.optional(),
});

const updateInput = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  formSchema: FormSchemaSchema.optional(),
});

function requireOrg(c: { var: { organizationId?: string } }): string | null {
  return c.var.organizationId ?? null;
}

export const recordTemplatesRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const orgId = requireOrg(c);
    if (!orgId) return c.json({ error: "no_active_org" }, 400);
    const list = await recordTemplateService.list(orgId);
    return c.json(list);
  })
  .get("/:id", async (c) => {
    const orgId = requireOrg(c);
    if (!orgId) return c.json({ error: "no_active_org" }, 400);
    const tpl = await recordTemplateService.get(orgId, c.req.param("id"));
    if (!tpl) return c.json({ error: "not_found" }, 404);
    return c.json(tpl);
  })
  .post("/", zValidator("json", createInput), async (c) => {
    const orgId = requireOrg(c);
    if (!orgId) return c.json({ error: "no_active_org" }, 400);
    if (c.var.membershipRole !== "admin") {
      return c.json({ error: "admin_required" }, 403);
    }
    const input = c.req.valid("json");
    const created = await recordTemplateService.create({
      organizationId: orgId,
      name: input.name,
      description: input.description ?? null,
      formSchema: input.formSchema,
      createdByUserId: c.var.user.id,
      workflowDefinitionId: input.workflowDefinitionId,
    });
    return c.json(created, 201);
  })
  .patch("/:id", zValidator("json", updateInput), async (c) => {
    const orgId = requireOrg(c);
    if (!orgId) return c.json({ error: "no_active_org" }, 400);
    if (c.var.membershipRole !== "admin") {
      return c.json({ error: "admin_required" }, 403);
    }
    const updated = await recordTemplateService.update(
      orgId,
      c.req.param("id"),
      c.req.valid("json"),
      c.var.user.id,
    );
    if (!updated) return c.json({ error: "not_found" }, 404);
    return c.json(updated);
  })
  .post("/:id/publish", async (c) => {
    const orgId = requireOrg(c);
    if (!orgId) return c.json({ error: "no_active_org" }, 400);
    if (c.var.membershipRole !== "admin") {
      return c.json({ error: "admin_required" }, 403);
    }
    const updated = await recordTemplateService.publish(orgId, c.req.param("id"), c.var.user.id);
    if (!updated) return c.json({ error: "not_found" }, 404);
    return c.json(updated);
  })
  .post("/:id/archive", async (c) => {
    const orgId = requireOrg(c);
    if (!orgId) return c.json({ error: "no_active_org" }, 400);
    if (c.var.membershipRole !== "admin") {
      return c.json({ error: "admin_required" }, 403);
    }
    const updated = await recordTemplateService.archive(orgId, c.req.param("id"), c.var.user.id);
    if (!updated) return c.json({ error: "not_found" }, 404);
    return c.json(updated);
  });
