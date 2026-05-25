-- V10.1 — framework datapoint catalog + admin-edited template ↔ datapoint
-- mapping table.
--
-- framework_datapoints is a reference catalog. Seeded via
-- apps/api/scripts/seed-framework-datapoints.ts from the @bgreen/frameworks
-- package; no per-org data here.
--
-- template_datapoint_mappings is the admin-managed join: which
-- RecordTemplate satisfies which datapoint. Per V10 plan §criteria the
-- mapping is global (CS templates → catalog), so org_id isn't on the
-- key. Authorization (org_admin only) is enforced at the route layer.

CREATE TYPE "framework" AS ENUM ('esrs', 'ghg', 'gri');
--> statement-breakpoint

CREATE TABLE "framework_datapoints" (
  -- Stable internal slug from @bgreen/frameworks. Format: <framework>-<code>.
  -- Acts as the FK target for template mappings, audit rows, AI prompts.
  "id" text PRIMARY KEY,
  "framework" "framework" NOT NULL,
  -- Pillar / topic group ("E1" / "Scope 1" / "GRI 305").
  "topic" text NOT NULL,
  -- Framework-issued code, surfaced verbatim in the UI.
  "code" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  -- SectorApplicability rule. Two shapes today:
  --   { "kind": "all" }
  --   { "kind": "cae3-list", "values": ["351", "352", ...] }
  -- JSONB so future shapes don't need a migration.
  "sector_applicability" jsonb NOT NULL,
  -- Framework revision tag ("esrs-2024", "ghgp-2015", "gri-2021").
  -- New revisions add new rows; old rows stay for historical coverage.
  "version" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "framework_datapoints_framework_idx"
  ON "framework_datapoints" ("framework", "topic");
--> statement-breakpoint

CREATE TABLE "template_datapoint_mappings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL
    REFERENCES "record_templates"("id") ON DELETE CASCADE,
  "framework_datapoint_id" text NOT NULL
    REFERENCES "framework_datapoints"("id") ON DELETE CASCADE,
  "created_by_user_id" uuid NOT NULL
    REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "template_datapoint_mappings_pair_unique"
    UNIQUE ("template_id", "framework_datapoint_id")
);
--> statement-breakpoint

CREATE INDEX "template_datapoint_mappings_template_idx"
  ON "template_datapoint_mappings" ("template_id");
--> statement-breakpoint

CREATE INDEX "template_datapoint_mappings_datapoint_idx"
  ON "template_datapoint_mappings" ("framework_datapoint_id");
