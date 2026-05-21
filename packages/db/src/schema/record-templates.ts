import { jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

export const recordTemplateStatusEnum = pgEnum("record_template_status", [
  "draft",
  "published",
  "archived",
]);

export const recordTemplates = pgTable("record_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  // FormSchema JSONB — shape defined by zod in @bgreen/types.
  // GIN-indexable later (V1.5) when we start querying inside form data.
  formSchema: jsonb("form_schema").notNull(),
  status: recordTemplateStatusEnum("status").notNull().default("draft"),
  // XState graph used for every Record submitted against this template.
  // One of: "single-step-submit", "two-step-review", "three-step-certify".
  // Default preserves V4 behaviour (admin reviews submitted records).
  workflowDefinitionId: text("workflow_definition_id").notNull().default("two-step-review"),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RecordTemplateRow = typeof recordTemplates.$inferSelect;
export type NewRecordTemplateRow = typeof recordTemplates.$inferInsert;
