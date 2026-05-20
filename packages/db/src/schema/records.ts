import { jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { recordTemplates } from "./record-templates";
import { users } from "./users";

// Flat status field for v4.1; V5 replaces this with WorkflowInstance.
export const recordStatusEnum = pgEnum("record_status", [
  "draft",
  "submitted",
  "approved",
  "changes_requested",
  "rejected",
]);

export const records = pgTable("records", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  templateId: uuid("template_id")
    .notNull()
    .references(() => recordTemplates.id, { onDelete: "restrict" }),
  status: recordStatusEnum("status").notNull().default("draft"),
  // Field id → value map, validated against the template's FormSchema
  // by FormSchemaInterpreter before insert/update.
  values: jsonb("values").notNull(),
  reviewComment: text("review_comment"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  submittedByUserId: uuid("submitted_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RecordRow = typeof records.$inferSelect;
export type NewRecordRow = typeof records.$inferInsert;
