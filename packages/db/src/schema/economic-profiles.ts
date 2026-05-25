import {
  bigint,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { organizationSizeEnum } from "./organization-size";
import { users } from "./users";

// One row per (organization, year). Two channels write here:
//   1) IES extraction confirmed by the user → source='ies_extracted' (or
//      'edited_after_extraction' if any field was overridden).
//   2) Manual entry from the dashboard fallback → source='manual'.
// Either way the row is IAuditable: AuditWriter records inserts/updates so
// regulators can reconstruct what bGreen claimed about the company over time.
//
// Money columns use numeric(20, 2) — drizzle returns these as strings to
// avoid JS-number precision loss on €-amounts in the billions. EBITDA is
// signed (loss-making companies are real). All money fields are nullable
// because extraction can succeed partially and the user can confirm with
// gaps; the validator + UI surface what's missing.
export const economicProfileSourceEnum = pgEnum("economic_profile_source", [
  "ies_extracted",
  "manual",
  "edited_after_extraction",
]);

// V7.1: how the dimensao classification was decided. 'ai_classified'
// means DimensaoClassifier (with optional AI narrative) ran and the
// user accepted the proposal as-is; 'user_override' means the user
// changed it; 'manual_entry' covers a profile set during manual entry
// (the V3 self-assessment flow eventually feeding through this column).
export const dimensaoSourceEnum = pgEnum("dimensao_source", [
  "ai_classified",
  "user_override",
  "manual_entry",
]);

export const organizationEconomicProfiles = pgTable(
  "organization_economic_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // Fiscal year (e.g., 2024). PRD #19 talks about multi-year trends — one
    // row per year is the unit the rest of the product reasons about.
    year: integer("year").notNull(),
    employees: integer("employees"),
    turnover: numeric("turnover", { precision: 20, scale: 2 }),
    ebitda: numeric("ebitda", { precision: 20, scale: 2 }),
    balanceSheetTotal: numeric("balance_sheet_total", { precision: 20, scale: 2 }),
    // CAE captured at extraction time. May differ from organizations.cae_code
    // (companies' primary CAE can change between filings); we preserve the
    // historical value here rather than rewriting the org row.
    cae: text("cae"),
    source: economicProfileSourceEnum("source").notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Back-reference to the extraction that produced this row. Null for
    // manual entries. Set null on extraction-log delete so a hard-purged
    // log doesn't take the profile with it.
    iesExtractionLogId: uuid("ies_extraction_log_id"),
    // V7.1 — size classification. Independent of the (org, year) values
    // so a profile can exist without a confirmed dimensao yet (created
    // pre-classification in V6, or pending the user's confirmation).
    dimensao: organizationSizeEnum("dimensao"),
    dimensaoSource: dimensaoSourceEnum("dimensao_source"),
    dimensaoConfirmedAt: timestamp("dimensao_confirmed_at", { withTimezone: true }),
    // Array of {rule, message} entries. Persisted alongside dimensao so
    // the UI can show "porque tem N funcionários e €X de turnover" even
    // months after the original confirmation without re-running the
    // classifier.
    dimensaoRationale: jsonb("dimensao_rationale"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // One profile per (org, year). Re-extraction updates the existing row;
    // chronology lives in audit_log.
    orgYearUnique: unique("org_econ_profile_org_year_unique").on(t.organizationId, t.year),
    orgIdx: index("org_econ_profile_org_idx").on(t.organizationId),
  }),
);

export type OrganizationEconomicProfileRow = typeof organizationEconomicProfiles.$inferSelect;
export type NewOrganizationEconomicProfileRow = typeof organizationEconomicProfiles.$inferInsert;

// Status field tracks where the extraction sits in the V6 Inngest pipeline.
// Terminal states: 'confirmed', 'cancelled', and any 'failed_*'. Non-terminal:
// 'pending' (PDF in S3, function queued), 'extracting' (function running),
// 'awaiting_user_confirmation' (results returned, user reviewing).
export const iesExtractionStatusEnum = pgEnum("ies_extraction_status", [
  "pending",
  "extracting",
  "awaiting_user_confirmation",
  "confirmed",
  "cancelled",
  "failed_not_ies",
  "failed_extraction",
  "failed_validation",
]);

// One row per extraction attempt. Kept indefinitely — the AuditLog payload
// (V5) is the regulated record; this table is the operational view (status,
// timing, classifier/extractor outputs, error messages for the user).
//
// `s3_key` is null after S3 deletion completes (post-confirmation cleanup).
// The PDF data itself doesn't survive; only what the AI extracted does.
export const iesExtractionLogs = pgTable(
  "ies_extraction_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    s3Key: text("s3_key"),
    s3DeletedAt: timestamp("s3_deleted_at", { withTimezone: true }),
    originalFilename: text("original_filename"),
    // bigint because S3 supports objects up to 5 GiB; we cap at ~25 MB but
    // the column shouldn't bottleneck.
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
    status: iesExtractionStatusEnum("status").notNull().default("pending"),
    // Extracted fiscal year, copied here for quick lookups without parsing
    // the extractionResult JSONB.
    year: integer("year"),
    // Raw output of classifyDocument tool — kind + confidence.
    classificationResult: jsonb("classification_result"),
    // Raw output of extractEconomicProfile tool — per-field {value, confidence}.
    extractionResult: jsonb("extraction_result"),
    // Output of PerfilEconomicoValidator — array of {field, rule, severity}.
    validatorWarnings: jsonb("validator_warnings"),
    // pt-PT message surfaced to the user when status starts with failed_.
    errorMessage: text("error_message"),
    // Inngest run identifier — lets us cross-reference Inngest logs from
    // a failed extraction without juggling correlation IDs.
    inngestRunId: text("inngest_run_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index("ies_extraction_logs_org_idx").on(t.organizationId, t.createdAt),
    statusIdx: index("ies_extraction_logs_status_idx").on(t.status),
  }),
);

export type IesExtractionLogRow = typeof iesExtractionLogs.$inferSelect;
export type NewIesExtractionLogRow = typeof iesExtractionLogs.$inferInsert;
