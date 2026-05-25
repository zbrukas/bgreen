import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

// One row per workflow instance. v1: every Record has exactly one
// WorkflowInstance, but the model is generalisable — `entity_kind`/
// `entity_id` lets V6+ attach workflows to other entities (e.g.,
// generated reports) without schema churn. No FK on entity_id for that
// reason; integrity is enforced at the service layer.
//
// V12 perf pass:
//   * current_state was previously jsonb (XState `value`). All v1 graphs
//     are flat — only atomic string states — so we narrowed it to text
//     so a btree index actually applies to the CS reviewer inbox
//     (`listByState`) and the cross-template prefill query. Future
//     compound-state graphs need to widen this back or carry their own
//     discriminator.
//   * submitter_user_id is a denormalisation of context.submitterUserId,
//     populated by the repository on every write. Lets the org-side
//     inbox filter pending-for-actor with a composite index instead of
//     loading every workflow row and filtering in JS.
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
    // Atomic XState state name. v1 graphs never produce compound values;
    // see the schema header comment if/when that changes.
    currentState: text("current_state").notNull(),
    // Optional graph context (XState `context` field). Used for guards
    // that need bookkeeping data we don't want on the record itself.
    context: jsonb("context").notNull().default({}),
    // Denormalised from context.submitterUserId; see header comment.
    submitterUserId: uuid("submitter_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    entityIdx: index("workflow_instances_entity_idx").on(t.entityKind, t.entityId),
    orgIdx: index("workflow_instances_org_idx").on(t.organizationId),
    currentStateIdx: index("workflow_instances_current_state_idx").on(t.currentState),
    orgSubmitterIdx: index("workflow_instances_org_submitter_idx").on(
      t.organizationId,
      t.submitterUserId,
    ),
  }),
);

export type WorkflowInstanceRow = typeof workflowInstances.$inferSelect;
export type NewWorkflowInstanceRow = typeof workflowInstances.$inferInsert;
