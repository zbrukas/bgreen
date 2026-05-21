-- V5.4a — population split + template ownership move + org-role expansion.
-- Hand-written: Drizzle's interactive prompts can't atomically express
-- the enum reshape + data backfill.

-- 1) users: user_type discriminator + central-services role.
CREATE TYPE "public"."user_type" AS ENUM('central_services', 'organization');
--> statement-breakpoint
CREATE TYPE "public"."central_services_role" AS ENUM('admin', 'maintainer', 'promoter');
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "user_type" "user_type" NOT NULL DEFAULT 'organization';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "central_services_role" "central_services_role";
--> statement-breakpoint

-- 2) central_services_domains: domain-match table for sign-up classification.
CREATE TABLE "central_services_domains" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "domain" text NOT NULL UNIQUE,
  "note" text,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- 3) organization_memberships role enum reshape.
--   Old enum: ('admin', 'member')
--   New enum: ('org_admin', 'org_user_write', 'org_user_read')
--   Mapping:  admin → org_admin, member → org_user_write
ALTER TYPE "public"."membership_role" RENAME TO "membership_role_v1";
--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('org_admin', 'org_user_write', 'org_user_read');
--> statement-breakpoint
ALTER TABLE "organization_memberships"
  ALTER COLUMN "role" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "organization_memberships"
  ALTER COLUMN "role" TYPE "public"."membership_role" USING (
    CASE "role"::text
      WHEN 'admin' THEN 'org_admin'::"public"."membership_role"
      WHEN 'member' THEN 'org_user_write'::"public"."membership_role"
    END
  );
--> statement-breakpoint
ALTER TABLE "organization_memberships"
  ALTER COLUMN "role" SET DEFAULT 'org_user_write';
--> statement-breakpoint
ALTER TABLE "organization_invites"
  ALTER COLUMN "role" TYPE "public"."membership_role" USING (
    CASE "role"::text
      WHEN 'admin' THEN 'org_admin'::"public"."membership_role"
      WHEN 'member' THEN 'org_user_write'::"public"."membership_role"
    END
  );
--> statement-breakpoint
DROP TYPE "public"."membership_role_v1";
--> statement-breakpoint

-- 4) topic_scope placeholder on membership (V5.5 will populate).
ALTER TABLE "organization_memberships"
  ADD COLUMN "topic_scope" text[] NOT NULL DEFAULT '{}'::text[];
--> statement-breakpoint

-- 5) record_templates: drop org FK, add V5.5 placeholder columns.
ALTER TABLE "record_templates"
  DROP CONSTRAINT IF EXISTS "record_templates_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "record_templates" DROP COLUMN "organization_id";
--> statement-breakpoint
ALTER TABLE "record_templates" ADD COLUMN "topic_tag_id" uuid;
--> statement-breakpoint
ALTER TABLE "record_templates" ADD COLUMN "is_sub_template" boolean NOT NULL DEFAULT false;
