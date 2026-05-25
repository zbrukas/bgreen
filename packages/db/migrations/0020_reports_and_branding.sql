-- V11.1 — reports persistence + org branding columns.
--
-- report_instances is the single-row-per-run table backing the PDF
-- reports surface. status starts at 'pending'; the Inngest pipeline
-- (V11.3) walks pending → running → ready (or failed). recommendations
-- + framework_coverage have the same status-enum + jsonb-payload
-- shape; reports differ by carrying a tamper-evidence hash
-- (input_data_hash, SHA-256 of canonicalised input JSON) and an S3
-- key once the PDF is uploaded.
--
-- The branding columns (logo_url, brand_primary_color) extend
-- organizations so the PDF service can read brand on every render
-- without an extra join.

CREATE TYPE "report_status" AS ENUM (
  'pending',
  'running',
  'ready',
  'failed',
  'cancelled'
);
--> statement-breakpoint

CREATE TABLE "report_instances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL
    REFERENCES "organizations"("id") ON DELETE CASCADE,
  "requested_by_user_id" uuid
    REFERENCES "users"("id") ON DELETE SET NULL,
  -- Stable template id chosen at generation time. Free text at the DB
  -- layer so new templates don't require a schema change; validated
  -- against the in-code registry at the route + service layer.
  "template_id" text NOT NULL,
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "status" "report_status" NOT NULL DEFAULT 'pending',
  -- S3 object key once the PDF is uploaded. Null while pending /
  -- running. Format: organizations/{orgId}/reports/{reportId}.pdf.
  "s3_key" text,
  -- SHA-256 hex digest (64 chars) of canonicalised input data. Stable
  -- across reruns; auditors recompute by re-collecting + re-hashing.
  "input_data_hash" text NOT NULL,
  -- AI-generated commentary. Null until V11.3's pipeline writes it.
  -- Shape: { sections: [{ title, narrative, callouts }] }.
  "commentary_json" jsonb,
  -- Cost roll-up + Inngest cross-reference.
  "ai_input_tokens" integer,
  "ai_output_tokens" integer,
  "inngest_run_id" text,
  "error_message" text,
  "started_at" timestamp with time zone,
  "generated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "report_instances_org_idx"
  ON "report_instances" ("organization_id", "created_at" DESC);
--> statement-breakpoint

CREATE INDEX "report_instances_status_idx"
  ON "report_instances" ("status");
--> statement-breakpoint

-- Branding columns on organizations. Both nullable; orgs without a
-- brand fall back to the bGreen default palette at render time.
ALTER TABLE "organizations" ADD COLUMN "logo_url" text;
--> statement-breakpoint

ALTER TABLE "organizations" ADD COLUMN "brand_primary_color" text;
