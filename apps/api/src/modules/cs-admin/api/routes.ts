import { AssignRequiredTemplateInputSchema } from "@bgreen/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { canCsWrite } from "../../../auth-helpers.js";
import type { AppEnv } from "../../../context.js";
import { requiredTemplateService } from "../../../services.js";

// V12.1 — CS-admin routes for required-template assignments. Behind the
// canCsWrite gate (admin OR maintainer); promoter-only CS users cannot
// assign. Mounted at /cs in app.ts; paths register at /required-templates.
const csAdminGate = async (userId: string): Promise<Response | null> => {
  if (await canCsWrite(userId)) return null;
  return Response.json({ error: "central_services_write_required" }, { status: 403 });
};

const assignPathInputSchema = z.object({
  organizationId: z.string().uuid(),
});

const removePathInputSchema = z.object({
  organizationId: z.string().uuid(),
  templateId: z.string().uuid(),
});

export const csAdminRoutes = new Hono<AppEnv>()
  .post(
    "/required-templates/:organizationId",
    zValidator("param", assignPathInputSchema),
    zValidator("json", AssignRequiredTemplateInputSchema),
    async (c) => {
      const denied = await csAdminGate(c.var.user.id);
      if (denied) return denied;
      const { organizationId } = c.req.valid("param");
      const input = c.req.valid("json");
      const result = await requiredTemplateService.assign({
        organizationId,
        templateId: input.templateId,
        recurrence: input.recurrence,
        firstDueAt: new Date(input.firstDueAt),
        assignedByUserId: c.var.user.id,
      });
      if (!result.ok) return c.json({ error: result.code }, 404);
      return c.json(result.assignment, 201);
    },
  )
  .delete(
    "/required-templates/:organizationId/:templateId",
    zValidator("param", removePathInputSchema),
    async (c) => {
      const denied = await csAdminGate(c.var.user.id);
      if (denied) return denied;
      const { organizationId, templateId } = c.req.valid("param");
      const result = await requiredTemplateService.unassign({
        organizationId,
        templateId,
        actorUserId: c.var.user.id,
      });
      return c.json(result);
    },
  )
  .get(
    "/required-templates/:organizationId",
    zValidator("param", assignPathInputSchema),
    async (c) => {
      const denied = await csAdminGate(c.var.user.id);
      if (denied) return denied;
      const { organizationId } = c.req.valid("param");
      const list = await requiredTemplateService.listForOrganization(organizationId);
      return c.json(list);
    },
  );
