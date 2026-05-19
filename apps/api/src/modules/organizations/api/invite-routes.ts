import { Hono } from "hono";
import type { AppEnv } from "../../../context.js";
import { inviteService } from "../../../services.js";

export const inviteRoutes = new Hono<AppEnv>()
  .get("/:token", async (c) => {
    const token = c.req.param("token");
    if (!token) return c.json({ error: "missing_token" }, 400);
    const result = await inviteService.preview({
      token,
      userEmail: c.var.user.email,
    });
    if ("error" in result) {
      return c.json({ error: result.error }, 404);
    }
    return c.json(result.preview);
  })
  .post("/:token/accept", async (c) => {
    const token = c.req.param("token");
    if (!token) return c.json({ error: "missing_token" }, 400);
    const result = await inviteService.accept({
      token,
      userId: c.var.user.id,
      userEmail: c.var.user.email,
    });
    if ("error" in result) {
      return c.json({ error: result.error }, 400);
    }
    return c.json(result, 200);
  });
