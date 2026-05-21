import { Hono } from "hono";
import type { AppEnv } from "../../../context.js";
import { workflowService } from "../../../services.js";

export const workflowsRoutes = new Hono<AppEnv>().get("/inbox", async (c) => {
  const orgId = c.var.organizationId;
  if (!orgId) return c.json({ error: "no_active_org" }, 400);
  const instances = await workflowService.listPendingForActor(orgId, c.var.user.id);
  return c.json(instances);
});
