-- V5.2 migration: move record.status into workflow_instances + drop the
-- legacy column. Every existing record gets exactly one workflow_instance
-- using the two-step-review graph, with its current_state set to the
-- record's prior status and context seeded from submittedByUserId /
-- reviewedByUserId (so two-step-review's guards behave correctly).
INSERT INTO "workflow_instances" (
  "organization_id",
  "entity_kind",
  "entity_id",
  "definition_id",
  "definition_version",
  "current_state",
  "context"
)
SELECT
  r."organization_id",
  'record',
  r."id",
  'two-step-review',
  1,
  to_jsonb(r."status"::text),
  jsonb_build_object(
    'submitterUserId',
    CASE
      WHEN r."submitted_by_user_id" IS NULL THEN NULL
      ELSE to_jsonb(r."submitted_by_user_id"::text)
    END,
    'reviewerUserId',
    CASE
      WHEN r."reviewed_by_user_id" IS NULL THEN NULL
      ELSE to_jsonb(r."reviewed_by_user_id"::text)
    END
  )
FROM "records" r
WHERE NOT EXISTS (
  SELECT 1 FROM "workflow_instances" wi
  WHERE wi."entity_kind" = 'record' AND wi."entity_id" = r."id"
);
--> statement-breakpoint
ALTER TABLE "records" DROP COLUMN "status";--> statement-breakpoint
DROP TYPE "public"."record_status";
