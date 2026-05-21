import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

// Tamper-evident append-only log. One row per privileged action (entity
// CRUD on IAuditable types + workflow transitions + auth-relevant events).
// `entity_kind`/`entity_id` are application-level discriminators (not FKs)
// so the row survives entity hard-delete; right-to-erasure tombstones the
// actor reference but keeps the diff payload (see V5 plan).
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    entityKind: text("entity_kind").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(),
    // Shape varies by action — typically { before, after, changedFields[] }
    // for entity diffs, { event, fromState, toState, comment } for workflow
    // transitions. The AuditWriter helper produces canonical shapes.
    payload: jsonb("payload").notNull(),
    // Groups multiple rows produced by one request together for the history
    // view. Null for events not originating from a single request.
    correlationId: uuid("correlation_id"),
  },
  (t) => ({
    entityIdx: index("audit_log_entity_idx").on(t.entityKind, t.entityId, t.occurredAt),
    orgIdx: index("audit_log_org_idx").on(t.organizationId, t.occurredAt),
  }),
);

export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;
