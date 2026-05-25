import { CsHealthTierSchema } from "@bgreen/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { canCsRelation, canCsWrite } from "../../../auth-helpers.js";
import type { AppEnv } from "../../../context.js";
import { csHealthService } from "../../../services.js";

const gateCsRead = async (userId: string): Promise<Response | null> => {
  if (await canCsWrite(userId)) return null;
  if (await canCsRelation(userId, "promoter")) return null;
  return Response.json({ error: "central_services_required" }, { status: 403 });
};

const listQuerySchema = z.object({
  tier: CsHealthTierSchema.optional(),
  hasStagnantWork: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  sortBy: z
    .enum(["tier", "daysSinceLastLogin", "stagnantWorkflowsCount", "oldestStagnantWorkflowDays"])
    .optional(),
});

const orgIdParamSchema = z.object({
  organizationId: z.string().uuid(),
});

const cohortQuerySchema = z.object({
  cohortMonth: z.string().regex(/^\d{4}-\d{2}$/, "use YYYY-MM"),
});

export const csHealthRoutes = new Hono<AppEnv>()
  .get("/health", zValidator("query", listQuerySchema), async (c) => {
    const denied = await gateCsRead(c.var.user.id);
    if (denied) return denied;
    const query = c.req.valid("query");
    const list = await csHealthService.list(query);
    return c.json(list);
  })
  .get(
    "/health/:organizationId",
    zValidator("param", orgIdParamSchema),
    async (c) => {
      const denied = await gateCsRead(c.var.user.id);
      if (denied) return denied;
      const { organizationId } = c.req.valid("param");
      const detail = await csHealthService.get(organizationId);
      if (!detail) return c.json({ error: "not_found" }, 404);
      return c.json(detail);
    },
  )
  .get(
    "/cohorts/activation",
    zValidator("query", cohortQuerySchema),
    async (c) => {
      const denied = await gateCsRead(c.var.user.id);
      if (denied) return denied;
      const { cohortMonth } = c.req.valid("query");
      const result = await csHealthService.cohortActivation(cohortMonth);
      return c.json(result);
    },
  );
