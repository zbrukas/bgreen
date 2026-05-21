import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

// One row per workflow instance. v1: every Record has exactly one
// WorkflowInstance, but the model is generalisable — `entity_kind`/
// `entity_id` lets V6+ attach workflows to other entities (e.g.,
// generated reports) without schema churn. No FK on entity_id for that
// reason; integrity is enforced at the service layer.
export const workflowInstances = pgTable(
  "workflow_instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    entityKind: text("entity_kind").notNull(),
    entityId: uuid("entity_id").notNull(),
    // XState graph identifier (e.g., "two-step-review"). Code-only, not FK.
    definitionId: text("definition_id").notNull(),
    // Bumped when a graph's shape changes incompatibly so old instances
    // continue under their original definition.
    definitionVersion: integer("definition_version").notNull().default(1),
    // XState StateValue — a string for atomic states, or a nested object
    // for compound/parallel states. Always JSON-serialisable.
    currentState: jsonb("current_state").notNull(),
    // Optional graph context (XState `context` field). Used for guards
    // that need bookkeeping data we don't want on the record itself.
    context: jsonb("context").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    entityIdx: index("workflow_instances_entity_idx").on(t.entityKind, t.entityId),
    orgIdx: index("workflow_instances_org_idx").on(t.organizationId),
  }),
);

export type WorkflowInstanceRow = typeof workflowInstances.$inferSelect;
export type NewWorkflowInstanceRow = typeof workflowInstances.$inferInsert;
