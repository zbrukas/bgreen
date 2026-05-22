import { boolean, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { topics } from "./topics";
import { users } from "./users";

export const recordTemplateStatusEnum = pgEnum("record_template_status", [
  "draft",
  "published",
  "archived",
]);

// V5.4 moved templates from org-owned to central-services-owned. Every
// template now belongs to the singleton CS catalogue; `created_by_user_id`
// references a users.user_type='central_services' row (enforced at the
// service layer).

export const recordTemplates = pgTable("record_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  formSchema: jsonb("form_schema").notNull(),
  status: recordTemplateStatusEnum("status").notNull().default("draft"),
  workflowDefinitionId: text("workflow_definition_id").notNull().default("two-step-review"),
  topicTagId: uuid("topic_tag_id").references(() => topics.id, { onDelete: "set null" }),
  isSubTemplate: boolean("is_sub_template").notNull().default(false),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RecordTemplateRow = typeof recordTemplates.$inferSelect;
export type NewRecordTemplateRow = typeof recordTemplates.$inferInsert;
