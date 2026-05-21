import { Hono } from "hono";
import { logger } from "hono/logger";
import { Inngest } from "inngest";
import { serve as inngestServe } from "inngest/hono";
import type { AppEnv } from "./context.js";
import { authMiddleware } from "./middleware/auth.js";
import { fgaMiddleware } from "./middleware/fga.js";
import { auditRoutes } from "./modules/audit/module.js";
import { recordTemplatesRoutes } from "./modules/form-templates/module.js";
import { identityRoutes } from "./modules/identity/module.js";
import { lookupsRoutes } from "./modules/lookups/module.js";
import { inviteRoutes, organizationsRoutes } from "./modules/organizations/module.js";
import { recordsRoutes } from "./modules/records/module.js";
import { workflowsRoutes } from "./modules/workflows/module.js";

const inngest = new Inngest({ id: "bgreen-api" });

// Public surface — no auth required. /health and the Inngest function endpoint
// (Inngest signs its own webhook calls; auth would block it).
const publicRoutes = new Hono()
  .get("/health", (c) => c.json({ status: "ok", service: "api" } as const))
  .on(["GET", "POST", "PUT"], "/api/inngest", inngestServe({ client: inngest, functions: [] }));

// Authenticated surface — every request requires a valid WorkOS access token
// + an FGA cache scope. Order matters: auth populates c.var.user; fga sees it.
const authedRoutes = new Hono<AppEnv>()
  .use("*", authMiddleware)
  .use("*", fgaMiddleware)
  .route("/identity", identityRoutes)
  .route("/organizations", organizationsRoutes)
  .route("/invites", inviteRoutes)
  .route("/lookups", lookupsRoutes)
  .route("/record-templates", recordTemplatesRoutes)
  .route("/records", recordsRoutes)
  .route("/audit", auditRoutes)
  .route("/workflows", workflowsRoutes);

export const app = new Hono().use("*", logger()).route("/", publicRoutes).route("/", authedRoutes);

export type AppType = typeof app;
