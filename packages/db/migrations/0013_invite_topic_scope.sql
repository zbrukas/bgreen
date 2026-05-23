-- V5.6c — invites carry topic scope so a fresh member arrives already
-- restricted. Mirrors organization_memberships.topic_scope semantics:
-- empty array = no restriction.

ALTER TABLE "organization_invites"
  ADD COLUMN "topic_scope" text[] NOT NULL DEFAULT '{}'::text[];
