import { Hono } from "hono";
import { requireOrgRelation } from "../../../auth-helpers.js";
import type { AppEnv } from "../../../context.js";
import { auditService } from "../../../services.js";

const allowedEntityKinds = new Set([
  "record",
  "record_template",
  "organization",
  "organization_invite",
  "workflow_instance",
] as const);

type AllowedEntityKind = typeof allowedEntityKinds extends Set<infer T> ? T : never;

function isAllowedEntityKind(value: string): value is AllowedEntityKind {
  return (allowedEntityKinds as Set<string>).has(value);
}

export const auditRoutes = new Hono<AppEnv>().get("/:entityKind/:entityId", async (c) => {
  const orgId = c.var.organizationId;
  if (!orgId) return c.json({ error: "no_active_org" }, 400);
  // Audit reads are admin-only — V5.3's narrow FGA schema gives admins
  // the implicit right via the organization.admin relation. A dedicated
  // audit:read relation can be added in v1.5 if we need finer control.
  await requireOrgRelation(c.var.user.id, orgId, "org_admin");
  const entityKind = c.req.param("entityKind");
  if (!isAllowedEntityKind(entityKind)) {
    return c.json({ error: "unknown_entity_kind" }, 400);
  }
  const entityId = c.req.param("entityId");
  const events = await auditService.listForEntity(orgId, entityKind, entityId);
  return c.json(events);
});
