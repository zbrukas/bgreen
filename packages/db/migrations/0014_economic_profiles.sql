-- V6.2 — EconomicProfile schemas land. Two tables + two enums.
--
-- Hand-written (matches the team pattern noted in scripts/migrate.ts;
-- drizzle-kit snapshots have been stale since 0010). Pure additive DDL —
-- no backfills, no enum reshapes, no table rewrites.

-- 1) Status of a single IES extraction attempt. Terminal: confirmed,
-- cancelled, failed_*. Non-terminal: pending, extracting,
-- awaiting_user_confirmation.
CREATE TYPE "ies_extraction_status" AS ENUM (
  'pending',
  'extracting',
  'awaiting_user_confirmation',
  'confirmed',
  'cancelled',
  'failed_not_ies',
  'failed_extraction',
  'failed_validation'
);
--> statement-breakpoint

-- 2) Provenance of an economic-profile row. 'ies_extracted' = AI extracted
-- and user confirmed as-is. 'edited_after_extraction' = AI extracted but
-- user changed at least one field before confirming. 'manual' = no IES
-- ever uploaded.
CREATE TYPE "economic_profile_source" AS ENUM (
  'ies_extracted',
  'manual',
  'edited_after_extraction'
);
--> statement-breakpoint

-- 3) One row per (organization, year). Money columns are numeric(20,2)
-- so €-billions are representable without JS-number precision loss
-- (drizzle returns numeric as strings by default). All money fields
-- nullable — extraction can succeed partially and confirmation can have
-- gaps; UI + validator surface what's missing.
CREATE TABLE "organization_economic_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL
    REFERENCES "organizations"("id") ON DELETE CASCADE,
  "year" integer NOT NULL,
  "employees" integer,
  "turnover" numeric(20, 2),
  "ebitda" numeric(20, 2),
  "balance_sheet_total" numeric(20, 2),
  "cae" text,
  "source" "economic_profile_source" NOT NULL,
  "confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ies_extraction_log_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "org_econ_profile_org_year_unique" UNIQUE ("organization_id", "year")
);
--> statement-breakpoint

CREATE INDEX "org_econ_profile_org_idx"
  ON "organization_economic_profiles" ("organization_id");
--> statement-breakpoint

-- 4) One row per extraction attempt. Kept indefinitely as the operational
-- view (status, timing, raw AI outputs). The regulated record is the
-- audit_log payload from V5; this table is for ops + UI.
--
-- s3_key is null after the post-confirmation cleanup deletes the PDF.
-- The extracted JSON survives in extraction_result; the PDF doesn't.
CREATE TABLE "ies_extraction_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL
    REFERENCES "organizations"("id") ON DELETE CASCADE,
  "uploaded_by_user_id" uuid
    REFERENCES "users"("id") ON DELETE SET NULL,
  "s3_key" text,
  "s3_deleted_at" timestamp with time zone,
  "original_filename" text,
  "file_size_bytes" bigint,
  "status" "ies_extraction_status" NOT NULL DEFAULT 'pending',
  "year" integer,
  "classification_result" jsonb,
  "extraction_result" jsonb,
  "validator_warnings" jsonb,
  "error_message" text,
  "inngest_run_id" text,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "ies_extraction_logs_org_idx"
  ON "ies_extraction_logs" ("organization_id", "created_at");
--> statement-breakpoint

CREATE INDEX "ies_extraction_logs_status_idx"
  ON "ies_extraction_logs" ("status");
--> statement-breakpoint

-- 5) FK from profile back to its source extraction log. Done after both
-- tables exist (forward references aren't supported in CREATE TABLE).
-- ON DELETE SET NULL so purging an extraction log doesn't take the
-- profile row with it — profile rows are authoritative once confirmed.
ALTER TABLE "organization_economic_profiles"
  ADD CONSTRAINT "org_econ_profile_extraction_log_fk"
  FOREIGN KEY ("ies_extraction_log_id")
  REFERENCES "ies_extraction_logs"("id") ON DELETE SET NULL;
