import { Hono } from "hono";
import type { AppEnv } from "../../../context.js";
import { organizationService } from "../../../services.js";

export const organizationsRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const orgs = await organizationService.listOrganizationsForUser(c.var.user.id);
    return c.json(orgs);
  })
  .post("/", (c) =>
    c.json({ error: "not_implemented", reason: "Create organization ships in V2.3" }, 501),
  );
