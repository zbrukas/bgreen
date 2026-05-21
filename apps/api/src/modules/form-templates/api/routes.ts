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
  topicTagId: z.string().uuid().nullable().optional(),
  isSubTemplate: z.boolean().optional(),
});

const updateInput = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  formSchema: FormSchemaSchema.optional(),
  topicTagId: z.string().uuid().nullable().optional(),
  isSubTemplate: z.boolean().optional(),
});

// V5.4 stop-gap: templates are CS-owned. Writes require a central-services
// user with admin or maintainer role. V5.4d will replace this with
// proper FGA checks on the central_services_workspace resource.
function isCsWriter(user: { userType: string; centralServicesRole: string | null }): boolean {
  return (
    user.userType === "central_services" &&
    (user.centralServicesRole === "admin" || user.centralServicesRole === "maintainer")
  );
}

export const recordTemplatesRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const list = await recordTemplateService.list();
    return c.json(list);
  })
  .get("/:id", async (c) => {
    const tpl = await recordTemplateService.get(c.req.param("id"));
    if (!tpl) return c.json({ error: "not_found" }, 404);
    return c.json(tpl);
  })
  .post("/", zValidator("json", createInput), async (c) => {
    if (!isCsWriter(c.var.user)) {
      return c.json({ error: "central_services_required" }, 403);
    }
    const input = c.req.valid("json");
    const created = await recordTemplateService.create({
      name: input.name,
      description: input.description ?? null,
      formSchema: input.formSchema,
      createdByUserId: c.var.user.id,
      workflowDefinitionId: input.workflowDefinitionId,
      topicTagId: input.topicTagId ?? null,
      isSubTemplate: input.isSubTemplate ?? false,
    });
    return c.json(created, 201);
  })
  .patch("/:id", zValidator("json", updateInput), async (c) => {
    if (!isCsWriter(c.var.user)) {
      return c.json({ error: "central_services_required" }, 403);
    }
    const updated = await recordTemplateService.update(c.req.param("id"), c.req.valid("json"));
    if (!updated) return c.json({ error: "not_found" }, 404);
    return c.json(updated);
  })
  .post("/:id/publish", async (c) => {
    if (!isCsWriter(c.var.user)) {
      return c.json({ error: "central_services_required" }, 403);
    }
    const updated = await recordTemplateService.publish(c.req.param("id"));
    if (!updated) return c.json({ error: "not_found" }, 404);
    return c.json(updated);
  })
  .post("/:id/archive", async (c) => {
    if (!isCsWriter(c.var.user)) {
      return c.json({ error: "central_services_required" }, 403);
    }
    const updated = await recordTemplateService.archive(c.req.param("id"));
    if (!updated) return c.json({ error: "not_found" }, 404);
    return c.json(updated);
  });
