import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { recordTemplates } from "./record-templates";
import { users } from "./users";

// V5.2 removed the legacy `status` enum column. The authoritative state
// now lives on the matching workflow_instance row (joined on
// entity_kind='record' + entity_id=records.id). submittedAt/reviewedAt/
// reviewComment stay here as denormalisations for sort + display.

export const records = pgTable("records", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  templateId: uuid("template_id")
    .notNull()
    .references(() => recordTemplates.id, { onDelete: "restrict" }),
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
