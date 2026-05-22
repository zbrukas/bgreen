-- V5.7a — CS app drops WorkOS in favour of local email+password auth.
-- users.workos_user_id becomes nullable; password_hash + last_login_at
-- are added for the new flow. Org users still use WorkOS so the unique
-- constraint stays (NULL values don't conflict under uniqueness).

ALTER TABLE "users" ALTER COLUMN "workos_user_id" DROP NOT NULL;
--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN "password_hash" text;
--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp with time zone;
--> statement-breakpoint

-- Defensive guard: only CS users may have a password_hash. Org users
-- still authenticate through WorkOS, so a non-null password_hash on an
-- organization row would be a sync bug.
ALTER TABLE "users"
  ADD CONSTRAINT "users_password_hash_only_for_cs"
  CHECK ("password_hash" IS NULL OR "user_type" = 'central_services');
