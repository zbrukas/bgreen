-- V7.1 — size classification per (organization, year).
--
-- Adds dimensao + bookkeeping columns to organization_economic_profiles
-- so each year's profile can be classified independently. The EU
-- Recommendation 2003/361/EC bands match the existing organization_size
-- enum used since V3.

-- 1) Source of the classification. Distinguishes the deterministic AI/
-- classifier path from a manual override (PRD §49) and from the V3
-- self-assessment carried through manual entry.
CREATE TYPE "dimensao_source" AS ENUM (
  'ai_classified',
  'user_override',
  'manual_entry'
);
--> statement-breakpoint

-- 2) Per-year columns. All nullable: profiles created in V6 won't have
-- a dimensao until the user runs classification or confirms one.
ALTER TABLE "organization_economic_profiles"
  ADD COLUMN "dimensao" "organization_size",
  ADD COLUMN "dimensao_source" "dimensao_source",
  ADD COLUMN "dimensao_confirmed_at" timestamp with time zone,
  ADD COLUMN "dimensao_rationale" jsonb;
