import {
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

// V11.1 — one row per "Gerar relatório PDF" run.
//
// `template_id` is an app-level enum (ghg-inventory | esrs-e1 |
// custom); kept as text so future templates ship without a migration.
// `period_start` / `period_end` are date (not timestamp) — reports are
// always whole-day boundaries.
// `input_data_hash` is the SHA-256 of the canonicalised input JSON;
// auditors re-collect data, re-hash, and compare to verify integrity.
// `commentary_json` stores the AI-generated narrative (V11.3) so the
// PDF can be re-rendered without re-running the AI call.

export const reportStatusEnum = pgEnum("report_status", [
  "pending",
  "running",
  "ready",
  "failed",
  "cancelled",
]);

export const reportInstances = pgTable(
  "report_instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Stable template id chosen at generation time. Free text at the DB
    // layer so new templates don't require a schema change; validated
    // against the in-code registry at the route + service layer.
    templateId: text("template_id").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    status: reportStatusEnum("status").notNull().default("pending"),
    // S3 object key after upload. Null while pending / running, set on
    // ready. Format: organizations/{orgId}/reports/{reportId}.pdf.
    s3Key: text("s3_key"),
    // SHA-256 hex digest (64 chars) of canonicalised input data. Stable
    // across reruns; auditor recomputes to verify.
    inputDataHash: text("input_data_hash").notNull(),
    // AI commentary JSON. Null until the AI step completes. Sections:
    // [{ title, narrative, callouts }].
    commentaryJson: jsonb("commentary_json"),
    // Token + Inngest snapshot for cost roll-ups + audit cross-reference.
    aiInputTokens: integer("ai_input_tokens"),
    aiOutputTokens: integer("ai_output_tokens"),
    inngestRunId: text("inngest_run_id"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index("report_instances_org_idx").on(t.organizationId, t.createdAt),
    statusIdx: index("report_instances_status_idx").on(t.status),
  }),
);

export type ReportInstanceRow = typeof reportInstances.$inferSelect;
export type NewReportInstanceRow = typeof reportInstances.$inferInsert;
