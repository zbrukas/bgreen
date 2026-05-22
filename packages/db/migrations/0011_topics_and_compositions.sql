-- V5.5a — topic catalogue + sub-template composition.
-- Hand-written: pure additive DDL; no enum reshapes, but kept consistent
-- with 0010's style.

-- 1) topics: CS-managed flat catalogue. Slug is the stable identifier
-- referenced by membership.topic_scope and (eventually) FGA warrants.
CREATE TABLE "topics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- 2) record_templates.topic_tag_id becomes a real FK now that topics exist.
-- ON DELETE SET NULL so deleting a topic doesn't cascade into templates.
ALTER TABLE "record_templates"
  ADD CONSTRAINT "record_templates_topic_tag_id_topics_id_fk"
  FOREIGN KEY ("topic_tag_id") REFERENCES "topics"("id") ON DELETE SET NULL;
--> statement-breakpoint

-- 3) template_compositions: ordered list of sub-templates embedded in a
-- main template. position is a stable integer (10, 20, 30, …) to allow
-- cheap re-ordering without renumbering everything; uniqueness on
-- (main, position) is intentionally NOT enforced — order ties resolve by
-- sub_template_id and we can compact lazily.
CREATE TABLE "template_compositions" (
  "main_template_id" uuid NOT NULL REFERENCES "record_templates"("id") ON DELETE CASCADE,
  "sub_template_id"  uuid NOT NULL REFERENCES "record_templates"("id") ON DELETE CASCADE,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("main_template_id", "sub_template_id")
);
--> statement-breakpoint
CREATE INDEX "template_compositions_main_idx"
  ON "template_compositions" ("main_template_id", "position");
--> statement-breakpoint

-- 4) Self-composition guard: a template cannot embed itself.
ALTER TABLE "template_compositions"
  ADD CONSTRAINT "template_compositions_no_self"
  CHECK ("main_template_id" <> "sub_template_id");
