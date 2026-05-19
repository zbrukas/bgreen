import { Hono } from "hono";
import type { AppEnv } from "../../../context.js";

export const identityRoutes = new Hono<AppEnv>().get("/me", (c) => {
  return c.json(c.var.user);
});
