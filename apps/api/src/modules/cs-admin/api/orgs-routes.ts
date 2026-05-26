import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { canCsRelation, canCsWrite } from "../../../auth-helpers.js";
import type { AppEnv } from "../../../context.js";
import { csOrgsService } from "../../../services.js";

const gateCsRead = async (userId: string): Promise<Response | null> => {
  if (await canCsWrite(userId)) return null;
  if (await canCsRelation(userId, "promoter")) return null;
  return Response.json({ error: "central_services_required" }, { status: 403 });
};

const orgIdParam = z.object({ id: z.string().uuid() });

export const csOrgsRoutes = new Hono<AppEnv>()
  .get("/orgs", async (c) => {
    const denied = await gateCsRead(c.var.user.id);
    if (denied) return denied;
    const list = await csOrgsService.list();
    return c.json(list);
  })
  .get("/orgs/:id", zValidator("param", orgIdParam), async (c) => {
    const denied = await gateCsRead(c.var.user.id);
    if (denied) return denied;
    const { id } = c.req.valid("param");
    const detail = await csOrgsService.get(id);
    if (!detail) return c.json({ error: "not_found" }, 404);
    return c.json(detail);
  });
