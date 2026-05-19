import { Hono } from "hono";

export const organizationsRoutes = new Hono()
  .get("/", (c) =>
    c.json({ error: "not_implemented", reason: "List organizations ships in V2.2" }, 501),
  )
  .post("/", (c) =>
    c.json({ error: "not_implemented", reason: "Create organization ships in V2.3" }, 501),
  );
