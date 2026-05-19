import { Hono } from "hono";

export const identityRoutes = new Hono().get("/me", (c) =>
  c.json({ error: "not_implemented", reason: "WorkOS integration ships in V2.2" }, 501),
);
