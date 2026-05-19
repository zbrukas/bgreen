import { Hono } from "hono";
import { Inngest } from "inngest";
import { serve as inngestServe } from "inngest/hono";
import { identityRoutes } from "./modules/identity/module.js";
import { organizationsRoutes } from "./modules/organizations/module.js";

const inngest = new Inngest({ id: "bgreen-api" });

export const app = new Hono()
  .get("/health", (c) => c.json({ status: "ok", service: "api" } as const))
  .route("/identity", identityRoutes)
  .route("/organizations", organizationsRoutes)
  .on(["GET", "POST", "PUT"], "/api/inngest", inngestServe({ client: inngest, functions: [] }));

export type AppType = typeof app;
