-- V12 perf pass — plans/db-performance/README.md
-- H1 + H2 + H3 + H4. H5 is repository-only.
--
-- Hand-written (not drizzle-kit generated) because:
--   1. ALTER COLUMN TYPE with USING is not produced by drizzle-kit.
--   2. The snapshot chain in migrations/meta is broken at 0009 anyway.
-- The schema files in packages/db/src/schema describe the post-migration
-- shape and are the authoritative target.

-- H1. records list/sort paths.
CREATE INDEX "records_org_created_idx" ON "records" USING btree ("organization_id", "created_at" DESC);--> statement-breakpoint
CREATE INDEX "records_template_idx" ON "records" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "records_submitter_idx" ON "records" USING btree ("submitted_by_user_id") WHERE "submitted_by_user_id" IS NOT NULL;--> statement-breakpoint

-- H2. workflow_instances.current_state: jsonb scalar string → text.
-- Every existing row is a jsonb scalar string (V5.2 seed used to_jsonb(text);
-- transitions persist XState atomic value names). #>> '{}' extracts the
-- scalar as text. Defensive guard: fail the migration loudly if any row
-- holds a non-string value rather than silently corrupting state.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "workflow_instances"
    WHERE jsonb_typeof("current_state") <> 'string'
  ) THEN
    RAISE EXCEPTION 'workflow_instances.current_state has non-string jsonb values; refusing to migrate. Inspect before retrying.';
  END IF;
END$$;--> statement-breakpoint

ALTER TABLE "workflow_instances" ALTER COLUMN "current_state" TYPE text USING "current_state" #>> '{}';--> statement-breakpoint
CREATE INDEX "workflow_instances_current_state_idx" ON "workflow_instances" USING btree ("current_state");--> statement-breakpoint

-- H3. workflow_instances.submitter_user_id denormalisation.
-- Backfill from context.submitterUserId; future writes set the column
-- directly from WorkflowContext in the repository.
ALTER TABLE "workflow_instances" ADD COLUMN "submitter_user_id" uuid;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_submitter_user_id_users_id_fk" FOREIGN KEY ("submitter_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "workflow_instances"
  SET "submitter_user_id" = ("context"->>'submitterUserId')::uuid
  WHERE "context"->>'submitterUserId' IS NOT NULL;--> statement-breakpoint
CREATE INDEX "workflow_instances_org_submitter_idx" ON "workflow_instances" USING btree ("organization_id", "submitter_user_id");--> statement-breakpoint

-- H4. organization_memberships per-org listing.
CREATE INDEX "org_memb_org_idx" ON "organization_memberships" USING btree ("organization_id");
