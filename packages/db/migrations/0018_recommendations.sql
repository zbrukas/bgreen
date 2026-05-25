-- V9.1 — recommendations persistence.
--
-- generated_recommendations: one row per "Gerar recomendações" run. The
-- recommendations array is stored as JSONB — the V8 plan calls this the
-- "output blob" so the rest of the product reads it without joining a
-- per-item table. Per-item feedback joins on (generation_id, recommendation_index).
--
-- recommendation_feedback: one row per (generation, recommendation_index,
-- user). Switching feedback (e.g., útil → não aplicável) updates the
-- existing row rather than inserting a new one; the UNIQUE constraint
-- enforces the cardinality.

-- 1) status enum. terminal: ready, failed, cancelled.
CREATE TYPE "recommendations_status" AS ENUM (
  'pending',
  'running',
  'ready',
  'failed',
  'cancelled'
);
--> statement-breakpoint

-- 2) completeness mode (per V9 plan §FULL/PARTIAL/INCOMPLETE). Recorded
-- so the dashboard history can show "this run was on a PARTIAL profile".
CREATE TYPE "recommendations_completeness" AS ENUM (
  'FULL',
  'PARTIAL',
  'INCOMPLETE'
);
--> statement-breakpoint

-- 3) per-recommendation feedback kinds (V9 plan §criteria: útil,
-- já implementada, não aplicável, irrelevante, incorreta).
CREATE TYPE "recommendation_feedback_kind" AS ENUM (
  'util',
  'ja_implementada',
  'nao_aplicavel',
  'irrelevante',
  'incorreta'
);
--> statement-breakpoint

CREATE TABLE "generated_recommendations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL
    REFERENCES "organizations"("id") ON DELETE CASCADE,
  "requested_by_user_id" uuid
    REFERENCES "users"("id") ON DELETE SET NULL,
  "status" "recommendations_status" NOT NULL DEFAULT 'pending',
  "completeness_mode" "recommendations_completeness" NOT NULL,
  -- Array of {title, description, estimatedImpact, implementationEffort,
  -- timeHorizon, rationale}. Null until the AI call returns; populated by
  -- the Inngest function in V9.2.
  "recommendations" jsonb,
  -- pt-PT message for the user when status starts with failed.
  "error_message" text,
  -- Token usage snapshot for cost roll-ups in the dashboard / audit.
  "ai_input_tokens" integer,
  "ai_output_tokens" integer,
  "inngest_run_id" text,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "generated_recommendations_org_idx"
  ON "generated_recommendations" ("organization_id", "created_at" DESC);
--> statement-breakpoint

CREATE INDEX "generated_recommendations_status_idx"
  ON "generated_recommendations" ("status");
--> statement-breakpoint

CREATE TABLE "recommendation_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "generated_recommendation_id" uuid NOT NULL
    REFERENCES "generated_recommendations"("id") ON DELETE CASCADE,
  -- Index into the JSONB recommendations array. The pair (generation,
  -- index) addresses one specific item; the UNIQUE below caps per-user
  -- feedback at one row per recommendation.
  "recommendation_index" integer NOT NULL,
  "user_id" uuid NOT NULL
    REFERENCES "users"("id") ON DELETE CASCADE,
  "kind" "recommendation_feedback_kind" NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "recommendation_feedback_unique"
    UNIQUE ("generated_recommendation_id", "recommendation_index", "user_id")
);
--> statement-breakpoint

-- Fast lookup for "how many útil/já implementada flags has this run
-- received" — feeds the dashboard history view.
CREATE INDEX "recommendation_feedback_gen_idx"
  ON "recommendation_feedback" ("generated_recommendation_id", "kind");
