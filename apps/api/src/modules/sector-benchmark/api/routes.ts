// V7.2 — /sector-benchmark surface.
//
// One endpoint for now: GET /sector-benchmark/compare?year=N. Resolves
// the org's profile for the year, derives (cae3, dimensao) from it,
// runs SectorBenchmarkLookup, and returns the BenchmarkComparison.
// Always 200 (even on InsufficientData) — the result shape is
// discriminated so the UI branches on `aggregate.insufficientData`.

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { canOrgRelation } from "../../../auth-helpers.js";
import type { AppEnv } from "../../../context.js";
import { economicProfileService, sectorBenchmarkLookup } from "../../../services.js";
import { buildComparison, extractCae3 } from "../application/benchmark-comparison.js";

const compareQuerySchema = z.object({
  year: z.coerce.number().int().min(1990).max(2100),
});

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

export const sectorBenchmarkRoutes = new Hono<AppEnv>().get(
  "/compare",
  zValidator("query", compareQuerySchema),
  async (c) => {
    const gate = await requireOrgMembership(c);
    if (gate instanceof Response) return gate;
    const { year } = c.req.valid("query");
    const profile = await economicProfileService.findByYear(gate.orgId, year);
    if (!profile) return c.json({ error: "profile_not_found" }, 404);
    const cae3 = extractCae3(profile.cae);
    const aggregate = await sectorBenchmarkLookup.lookup({
      cae3,
      dimensao: profile.dimensao,
      year,
    });
    return c.json(buildComparison(profile, aggregate));
  },
);
