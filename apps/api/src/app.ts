import { Hono } from "hono";
import { logger } from "hono/logger";
import { serve as inngestServe } from "inngest/hono";
import type { AppEnv } from "./context.js";
import { inngest } from "./inngest.js";
import { authMiddleware } from "./middleware/auth.js";
import { auditRoutes } from "./modules/audit/module.js";
import { csAuthRoutes } from "./modules/cs-auth/module.js";
import { csRoutes } from "./modules/cs/api/routes.js";
import { createIesExtractionFunction } from "./modules/economic-profile/module.js";
import { recordTemplatesRoutes } from "./modules/form-templates/module.js";
import { identityRoutes } from "./modules/identity/module.js";
import { lookupsRoutes } from "./modules/lookups/module.js";
import { inviteRoutes, organizationsRoutes } from "./modules/organizations/module.js";
import { recordsRoutes } from "./modules/records/module.js";
import { topicsRoutes } from "./modules/topics/module.js";
import { workflowsRoutes } from "./modules/workflows/module.js";
import { iesExtractionService } from "./services.js";

// Register Inngest functions. Each module owns its function factory; we
// import + invoke here so dependencies (services) are wired before the
// handler is mounted.
const inngestFunctions = [createIesExtractionFunction(iesExtractionService)];

// Public surface — no auth required. /health, /cs/auth/* (login flow),
// and the Inngest function endpoint (Inngest signs its own webhook calls;
// auth would block it).
const publicRoutes = new Hono()
  .get("/health", (c) => c.json({ status: "ok", service: "api" } as const))
  .on(
    ["GET", "POST", "PUT"],
    "/api/inngest",
    inngestServe({ client: inngest, functions: inngestFunctions }),
  )
  .route("/cs/auth", csAuthRoutes);

// Authenticated surface — every request requires either a valid WorkOS
// JWT (org users) or a CS session token (CS users). Auth populates
// c.var.user. Authorization gates live inline in each route via
// canOrgRelation / canCsRelation against the DB.
const authedRoutes = new Hono<AppEnv>()
  .use("*", authMiddleware)
  .route("/identity", identityRoutes)
  .route("/organizations", organizationsRoutes)
  .route("/invites", inviteRoutes)
  .route("/lookups", lookupsRoutes)
  .route("/record-templates", recordTemplatesRoutes)
  .route("/records", recordsRoutes)
  .route("/audit", auditRoutes)
  .route("/workflows", workflowsRoutes)
  .route("/topics", topicsRoutes)
  .route("/cs", csRoutes);

export const app = new Hono().use("*", logger()).route("/", publicRoutes).route("/", authedRoutes);

export type AppType = typeof app;
