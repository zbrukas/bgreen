-- V12.2 — Customer Success Telemetry: view + snapshot table + helpers.
-- See plans/bgreen/12-customer-success-telemetry.md §V12.2.
--
-- One migration ships:
--   * Performance indexes needed by the view's hot CTEs.
--   * Two SQL helper functions (current_period_start, wf_is_terminal).
--   * cs_health_snapshots table.
--   * cs_org_health view.
--
-- The view runs in a single transaction so partial failures roll back —
-- there is no half-applied state where the view exists without its
-- helpers, or the snapshot table exists without the view.

-- Performance indexes.
CREATE INDEX "records_org_template_submitted_idx"
  ON "records" USING btree ("organization_id", "template_id", "submitted_at" DESC)
  WHERE "submitted_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX "workflow_instances_org_updated_idx"
  ON "workflow_instances" USING btree ("organization_id", "updated_at");--> statement-breakpoint

-- current_period_start(recurrence, first_due_at). Returns the start of
-- the period currently in progress relative to `now()`. The coverage
-- query joins records.submitted_at >= current_period_start(...) to
-- count a template as "fulfilled this period."
CREATE OR REPLACE FUNCTION current_period_start(recurrence text, first_due_at timestamptz)
RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE recurrence
    WHEN 'once' THEN first_due_at
    WHEN 'monthly' THEN date_trunc('month', now())
    WHEN 'quarterly' THEN date_trunc('quarter', now())
    WHEN 'annual' THEN date_trunc('year', now())
    ELSE first_due_at
  END
$$;--> statement-breakpoint

-- wf_is_terminal(definition_id, current_state). Returns true when the
-- workflow instance is in a terminal state under its definition. V12
-- ships exactly one definition (two-step-review) and folds certified
-- into approved per the V5.3 legacy contract. Each new graph adds
-- a WHEN clause in a fresh migration.
CREATE OR REPLACE FUNCTION wf_is_terminal(def_id text, state text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE def_id
    WHEN 'two-step-review' THEN state IN ('approved', 'rejected')
    WHEN 'single-step-submit' THEN state = 'submitted'
    WHEN 'three-step-certify' THEN state IN ('certified', 'rejected')
    ELSE false
  END
$$;--> statement-breakpoint

-- cs_health_snapshots — daily trend store. PK is (org, day) so the
-- daily cron's INSERT ... ON CONFLICT is idempotent for manual backfills.
CREATE TABLE "cs_health_snapshots" (
  "organization_id" uuid NOT NULL,
  "snapshot_date" date NOT NULL,
  "metrics" jsonb NOT NULL,
  "computed_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "cs_health_snapshots_pkey" PRIMARY KEY ("organization_id", "snapshot_date")
);--> statement-breakpoint

ALTER TABLE "cs_health_snapshots"
  ADD CONSTRAINT "cs_health_snapshots_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "cs_health_snapshots_date_idx" ON "cs_health_snapshots" USING btree ("snapshot_date");--> statement-breakpoint

-- cs_org_health view — one row per organisation. Live reads hit this
-- directly (V12.2's /cs/health endpoint); the daily cron INSERTs from
-- here into cs_health_snapshots. At ~10k orgs convert to MATERIALIZED
-- VIEW refreshed by the same cron (single-line migration; no consumer
-- change). For v1 a plain view is fast enough — indexed underlying
-- tables, scalar aggregates only.
CREATE OR REPLACE VIEW cs_org_health AS
WITH
  first_record AS (
    SELECT
      r.organization_id,
      MIN(r.submitted_at) AS first_submitted_at
    FROM records r
    WHERE r.submitted_at IS NOT NULL
    GROUP BY r.organization_id
  ),
  records_quarter AS (
    SELECT
      r.organization_id,
      COUNT(*) FILTER (
        WHERE r.submitted_at >= date_trunc('quarter', now())
      ) AS current_q,
      COUNT(*) FILTER (
        WHERE r.submitted_at >= (date_trunc('quarter', now()) - INTERVAL '3 months')
          AND r.submitted_at < date_trunc('quarter', now())
      ) AS prev_q
    FROM records r
    WHERE r.submitted_at IS NOT NULL
    GROUP BY r.organization_id
  ),
  required_counts AS (
    SELECT
      ort.organization_id,
      COUNT(*) AS required_count,
      COUNT(*) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM records r
          WHERE r.organization_id = ort.organization_id
            AND r.template_id = ort.template_id
            AND r.submitted_at >= current_period_start(ort.recurrence::text, ort.first_due_at)
        )
      ) AS fulfilled_count
    FROM organization_required_templates ort
    GROUP BY ort.organization_id
  ),
  latest_per_template AS (
    SELECT DISTINCT ON (r.organization_id, r.template_id)
      r.organization_id,
      r.template_id,
      r.score_percent::numeric AS pct,
      r.submitted_at
    FROM records r
    WHERE r.score_percent IS NOT NULL
    ORDER BY r.organization_id, r.template_id, r.submitted_at DESC
  ),
  prior_per_template AS (
    SELECT DISTINCT ON (r.organization_id, r.template_id)
      r.organization_id,
      r.template_id,
      r.score_percent::numeric AS pct
    FROM records r
    JOIN latest_per_template lpt
      ON lpt.organization_id = r.organization_id AND lpt.template_id = r.template_id
    WHERE r.score_percent IS NOT NULL
      AND r.submitted_at <= lpt.submitted_at - INTERVAL '11 months'
    ORDER BY r.organization_id, r.template_id, r.submitted_at DESC
  ),
  yoy_delta AS (
    SELECT
      lpt.organization_id,
      AVG(lpt.pct - prior.pct) AS avg_delta
    FROM latest_per_template lpt
    JOIN prior_per_template prior
      ON prior.organization_id = lpt.organization_id
      AND prior.template_id = lpt.template_id
    GROUP BY lpt.organization_id
  ),
  login_recency AS (
    SELECT
      a.organization_id,
      MAX(a.occurred_at) AS last_login_at
    FROM audit_log a
    WHERE a.action = 'user.login'
    GROUP BY a.organization_id
  ),
  wau AS (
    SELECT
      a.organization_id,
      COUNT(DISTINCT a.actor_user_id) AS distinct_users
    FROM audit_log a
    WHERE a.action IN ('user.login', 'record.draft_created', 'record.draft_updated', 'workflow.transition')
      AND a.occurred_at >= now() - INTERVAL '7 days'
      AND a.actor_user_id IS NOT NULL
    GROUP BY a.organization_id
  ),
  mau AS (
    SELECT
      a.organization_id,
      COUNT(DISTINCT a.actor_user_id) AS distinct_users
    FROM audit_log a
    WHERE a.action IN ('user.login', 'record.draft_created', 'record.draft_updated', 'workflow.transition')
      AND a.occurred_at >= now() - INTERVAL '30 days'
      AND a.actor_user_id IS NOT NULL
    GROUP BY a.organization_id
  ),
  stagnant AS (
    SELECT
      wi.organization_id,
      COUNT(*) AS stagnant_count,
      MIN(wi.updated_at) AS oldest_updated_at,
      jsonb_object_agg(definition_id, def_count) AS by_def
    FROM (
      SELECT
        wi.organization_id,
        wi.definition_id,
        wi.updated_at,
        COUNT(*) OVER (PARTITION BY wi.organization_id, wi.definition_id) AS def_count
      FROM workflow_instances wi
      WHERE wi.updated_at < now() - INTERVAL '14 days'
        AND NOT wf_is_terminal(wi.definition_id, wi.current_state)
    ) wi
    GROUP BY wi.organization_id
  )
SELECT
  o.id AS organization_id,
  o.created_at,
  GREATEST(0, EXTRACT(EPOCH FROM (now() - o.created_at))::int / 86400) AS days_since_created,
  fr.first_submitted_at AS first_record_submitted_at,
  CASE WHEN fr.first_submitted_at IS NULL THEN NULL
       ELSE EXTRACT(EPOCH FROM (fr.first_submitted_at - o.created_at))::int / 86400
  END AS days_to_first_record,
  COALESCE(fr.first_submitted_at <= o.created_at + INTERVAL '30 days', false) AS activated_in_30d,
  COALESCE(rq.current_q, 0)::int AS records_current_quarter,
  COALESCE(rq.prev_q, 0)::int AS records_previous_quarter,
  CASE
    WHEN COALESCE(rq.current_q, 0) > COALESCE(rq.prev_q, 0) * 1.2 THEN 'up'
    WHEN COALESCE(rq.current_q, 0) < COALESCE(rq.prev_q, 0) * 0.8 THEN 'down'
    ELSE 'flat'
  END AS engagement_trend,
  COALESCE(rc.required_count, 0)::int AS required_templates_count,
  COALESCE(rc.fulfilled_count, 0)::int AS required_templates_with_current_period_data,
  CASE WHEN rc.required_count IS NULL OR rc.required_count = 0 THEN NULL
       ELSE ROUND((rc.fulfilled_count::numeric / rc.required_count) * 100, 2)
  END AS coverage_percent,
  yoy.avg_delta AS latest_score_yoy_delta,
  lr.last_login_at,
  CASE WHEN lr.last_login_at IS NULL THEN NULL
       ELSE EXTRACT(EPOCH FROM (now() - lr.last_login_at))::int / 86400
  END AS days_since_last_login,
  COALESCE(w.distinct_users, 0)::int AS wau_count,
  COALESCE(m.distinct_users, 0)::int AS mau_count,
  COALESCE(s.stagnant_count, 0)::int AS stagnant_workflows_count,
  CASE WHEN s.oldest_updated_at IS NULL THEN NULL
       ELSE EXTRACT(EPOCH FROM (now() - s.oldest_updated_at))::int / 86400
  END AS oldest_stagnant_workflow_days,
  COALESCE(s.by_def, '{}'::jsonb) AS stagnant_workflows_by_definition,
  now() AS computed_at
FROM organizations o
LEFT JOIN first_record fr ON fr.organization_id = o.id
LEFT JOIN records_quarter rq ON rq.organization_id = o.id
LEFT JOIN required_counts rc ON rc.organization_id = o.id
LEFT JOIN yoy_delta yoy ON yoy.organization_id = o.id
LEFT JOIN login_recency lr ON lr.organization_id = o.id
LEFT JOIN wau w ON w.organization_id = o.id
LEFT JOIN mau m ON m.organization_id = o.id
LEFT JOIN stagnant s ON s.organization_id = o.id;
