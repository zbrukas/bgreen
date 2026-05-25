import { jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { recordTemplates } from "./record-templates";
import { users } from "./users";

// V5.2 removed the legacy `status` enum column. The authoritative state
// now lives on the matching workflow_instance row (joined on
// entity_kind='record' + entity_id=records.id). submittedAt/reviewedAt/
// reviewComment stay here as denormalisations for sort + display.
//
// V8.2: score columns. All nullable — only records submitted against a
// template whose FormSchema has a `scoring` block get populated. Drafts
// also stay null (only computed at submit / re-submit).

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
  // V8.2 — ESG score snapshot at submit time. Drizzle returns numeric as
  // string; the repository decodes to JS number at the boundary.
  score: numeric("score", { precision: 20, scale: 2 }),
  scorePercent: numeric("score_percent", { precision: 7, scale: 4 }),
  scoreTier: text("score_tier"),
  // ScoreContribution[] — { fieldId, raw, weight, weighted } per scored field.
  scoreBreakdown: jsonb("score_breakdown"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RecordRow = typeof records.$inferSelect;
export type NewRecordRow = typeof records.$inferInsert;
