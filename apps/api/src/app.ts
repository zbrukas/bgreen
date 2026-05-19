import { Hono } from "hono";
import { logger } from "hono/logger";
import { Inngest } from "inngest";
import { serve as inngestServe } from "inngest/hono";
import type { AppEnv } from "./context.js";
import { authMiddleware } from "./middleware/auth.js";
import { identityRoutes } from "./modules/identity/module.js";
import { organizationsRoutes } from "./modules/organizations/module.js";

const inngest = new Inngest({ id: "bgreen-api" });

// Public surface — no auth required. /health and the Inngest function endpoint
// (Inngest signs its own webhook calls; auth would block it).
const publicRoutes = new Hono()
  .get("/health", (c) => c.json({ status: "ok", service: "api" } as const))
  .on(["GET", "POST", "PUT"], "/api/inngest", inngestServe({ client: inngest, functions: [] }));

// Authenticated surface — every request requires a valid WorkOS access token.
const authedRoutes = new Hono<AppEnv>()
  .use("*", authMiddleware)
  .route("/identity", identityRoutes)
  .route("/organizations", organizationsRoutes);

export const app = new Hono().use("*", logger()).route("/", publicRoutes).route("/", authedRoutes);

export type AppType = typeof app;
