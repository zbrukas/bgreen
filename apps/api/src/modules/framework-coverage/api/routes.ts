// V10.2 — HTTP surface for the framework coverage checker.
//
//   GET  /framework-datapoints?framework=esrs   → catalog list
//   GET  /framework-coverage/:framework         → org's coverage matrix
//   POST /framework-coverage/:framework/check   → matrix + AI explanations
//   GET  /template-datapoint-mappings           → mapping list (global)
//   POST /template-datapoint-mappings           → add a mapping (CS write)
//   DELETE /template-datapoint-mappings/:id     → remove a mapping (CS write)
//
// Auth: mounted under the authed surface. The catalog + matrix are
// org-member reads; mapping mutations require canCsWrite (CS admin or
// maintainer). Mapping reads are deliberately open to authed users so
// the V10.4 coverage UI can surface "this template covers X
// datapoints" labels without a CS round-trip.

import { zValidator } from "@hono/zod-validator";
import type { Framework } from "@bgreen/frameworks";
import { Hono } from "hono";
import { z } from "zod";
import { canCsWrite, canOrgRelation } from "../../../auth-helpers.js";
import type { AppEnv } from "../../../context.js";
import { coverageService } from "../../../services.js";

const frameworkEnum = z.enum(["esrs", "ghg", "gri"]);

const listDatapointsQuerySchema = z.object({
  framework: frameworkEnum.optional(),
});

const coverageParamSchema = z.object({
  framework: frameworkEnum,
});

const coverageQuerySchema = z.object({
  // ?includeNonApplicable=true → return rows with applicable=false.
  // Default false to match the calculator's contract.
  includeNonApplicable: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

const createMappingSchema = z
  .object({
    templateId: z.string().uuid(),
    frameworkDatapointId: z.string().min(1).max(128),
  })
  .strict();

async function requireOrgMembership(
  c: import("hono").Context<AppEnv>,
): Promise<{ orgId: string } | Response> {
  const orgId = c.var.organizationId;
  if (!orgId) return c.json({ error: "no_active_org" }, 400);
  const userId = c.var.user.id;
  const [isAdmin, isWriter, isReader] = await Promise.all([
    canOrgRelation(userId, orgId, "org_admin"),
    canOrgRelation(userId, orgId, "org_user_write"),
    canOrgRelation(userId, orgId, "org_user_read"),
  ]);
  if (!isAdmin && !isWriter && !isReader) return c.json({ error: "forbidden" }, 403);
  return { orgId };
}

export const frameworkDatapointsRoutes = new Hono<AppEnv>().get(
  "/",
  zValidator("query", listDatapointsQuerySchema),
  async (c) => {
    const { framework } = c.req.valid("query");
    const datapoints = await coverageService.listDatapoints(framework);
    return c.json(datapoints);
  },
);

export const frameworkCoverageRoutes = new Hono<AppEnv>()
  .get(
    "/:framework",
    zValidator("param", coverageParamSchema),
    zValidator("query", coverageQuerySchema),
    async (c) => {
      const gate = await requireOrgMembership(c);
      if (gate instanceof Response) return gate;
      const { framework } = c.req.valid("param");
      const { includeNonApplicable } = c.req.valid("query");
      const matrix = await coverageService.getMatrix({
        organizationId: gate.orgId,
        framework: framework as Framework,
        includeNonApplicable,
      });
      return c.json(matrix);
    },
  )
  // V10.3 — synchronous AI explanation pass. Returns matrix +
  // explanations + aiError (null on success, pt-PT string on failure).
  // Always 200: explanations are an additive surface, never gates the
  // deterministic matrix.
  .post(
    "/:framework/check",
    zValidator("param", coverageParamSchema),
    zValidator("query", coverageQuerySchema),
    async (c) => {
      const gate = await requireOrgMembership(c);
      if (gate instanceof Response) return gate;
      const { framework } = c.req.valid("param");
      const { includeNonApplicable } = c.req.valid("query");
      const result = await coverageService.checkCoverage({
        organizationId: gate.orgId,
        actorUserId: c.var.user.id,
        framework: framework as Framework,
        includeNonApplicable,
      });
      return c.json(result);
    },
  );

export const templateDatapointMappingsRoutes = new Hono<AppEnv>()
  // Global list — any authed user can read. The V10.4 admin screen
  // filters client-side to the relevant template.
  .get("/", async (c) => {
    const mappings = await coverageService.listMappings();
    return c.json(mappings);
  })
  // CS-only mapping create.
  .post("/", zValidator("json", createMappingSchema), async (c) => {
    if (!(await canCsWrite(c.var.user.id))) {
      return c.json({ error: "forbidden" }, 403);
    }
    const body = c.req.valid("json");
    const result = await coverageService.addMapping({
      templateId: body.templateId,
      frameworkDatapointId: body.frameworkDatapointId,
      actorUserId: c.var.user.id,
    });
    if (!result.ok) {
      return c.json({ error: result.error }, 404);
    }
    return c.json(result.mapping, 201);
  })
  // CS-only mapping delete.
  .delete("/:id", async (c) => {
    if (!(await canCsWrite(c.var.user.id))) {
      return c.json({ error: "forbidden" }, 403);
    }
    const id = c.req.param("id");
    const removed = await coverageService.deleteMapping({
      mappingId: id,
      actorUserId: c.var.user.id,
    });
    if (!removed) {
      return c.json({ error: "not_found" }, 404);
    }
    return c.json({ ok: true });
  });
