import { Hono } from "hono";
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
  // Audit reads are admin-only for now. V5.3 replaces this with a
  // can(user, "audit:read", organization) FGA check.
  if (c.var.membershipRole !== "admin") {
    return c.json({ error: "forbidden" }, 403);
  }
  const entityKind = c.req.param("entityKind");
  if (!isAllowedEntityKind(entityKind)) {
    return c.json({ error: "unknown_entity_kind" }, 400);
  }
  const entityId = c.req.param("entityId");
  const events = await auditService.listForEntity(orgId, entityKind, entityId);
  return c.json(events);
});
