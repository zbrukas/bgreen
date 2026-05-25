-- V12.1 — Customer Success Telemetry foundation.
-- Adds the organization_required_templates mapping table the cs_org_health
-- view (V12.2) joins for `coveragePercent`. Also adds the composite
-- audit_log index that makes login + WAU/MAU action filters cheap.
--
-- See plans/bgreen/12-customer-success-telemetry.md §V12.1.

CREATE TYPE "requirement_recurrence" AS ENUM ('annual', 'quarterly', 'monthly', 'once');--> statement-breakpoint

CREATE TABLE "organization_required_templates" (
  "organization_id" uuid NOT NULL,
  "template_id" uuid NOT NULL,
  "recurrence" "requirement_recurrence" NOT NULL,
  "first_due_at" timestamp with time zone NOT NULL,
  "assigned_by_user_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "organization_required_templates_pkey" PRIMARY KEY ("organization_id", "template_id")
);--> statement-breakpoint

ALTER TABLE "organization_required_templates"
  ADD CONSTRAINT "organization_required_templates_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_required_templates"
  ADD CONSTRAINT "organization_required_templates_template_id_record_templates_id_fk"
  FOREIGN KEY ("template_id") REFERENCES "public"."record_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_required_templates"
  ADD CONSTRAINT "organization_required_templates_assigned_by_user_id_users_id_fk"
  FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "org_required_templates_org_idx" ON "organization_required_templates" USING btree ("organization_id");--> statement-breakpoint

-- Composite audit_log index for V12 WAU/MAU + login-recency queries.
-- Existing audit_log_org_idx can't push down the action filter once
-- login + workflow rows accumulate. Worth shipping in V12.1 so the
-- table never sees a moment of unindexed action lookups.
CREATE INDEX "audit_log_action_org_idx" ON "audit_log" USING btree ("action", "organization_id", "occurred_at");
