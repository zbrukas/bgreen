-- V7.2 — sector benchmarks keyed by (cae3, dimensao, year, fonte).
--
-- One row = one sector aggregate (median turnover + median EBITDA margin
-- + peer count for the slice). `fonte` distinguishes the data source —
-- the placeholder seed ships as 'placeholder_v1'; future real BdP /
-- INE imports use distinct fonte values so the seeded rows can be
-- swapped out without orphan rows.
--
-- median_ebitda_margin is a ratio in numeric(5,4) — i.e., 0.1500 = 15%.
-- median_turnover uses the same numeric(20,2) convention as the
-- organization_economic_profiles money columns.

CREATE TABLE "sector_aggregates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- 3-digit CAE (NACE-derived). String, not integer — preserves leading zeros.
  "cae3" text NOT NULL,
  -- The dimensao band the aggregate covers. EU 2003/361/EC SME band.
  "dimensao" "organization_size" NOT NULL,
  -- The year of the company exercise the aggregate covers.
  "year" integer NOT NULL,
  -- The vintage year of the underlying source dataset. Often differs
  -- from `year` (BdP Quadros do Setor publishes with a 2-3 year lag).
  "vintage_year" integer NOT NULL,
  -- Data source identifier. UI surfaces this in the vintage badge.
  "fonte" text NOT NULL,
  -- Peer count. UI shows "n=N empresas" — small N degrades user trust
  -- so we surface it rather than hiding behind an average.
  "n_companies" integer NOT NULL,
  -- Median € turnover across the slice. numeric(20,2) matches the
  -- organization_economic_profiles money columns.
  "median_turnover" numeric(20, 2),
  -- Median EBITDA margin (ratio). 5 digits with 4 decimals → -9.9999 to
  -- 9.9999 — plenty for sane sector medians (typically -0.2 to 0.3).
  "median_ebitda_margin" numeric(5, 4),
  -- Optional percentiles for future box-plot UI. Nullable so the
  -- seed-the-medians-only first pass doesn't need to compute them.
  "p25_turnover" numeric(20, 2),
  "p75_turnover" numeric(20, 2),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sector_aggregates_slice_unique" UNIQUE ("cae3", "dimensao", "year", "fonte")
);
--> statement-breakpoint

-- Lookup hot path: SectorBenchmarkLookup(cae3, dimensao, year).
-- Year is third because the year-fallback path filters by (cae3, dimensao)
-- first and orders by year DESC.
CREATE INDEX "sector_aggregates_lookup_idx"
  ON "sector_aggregates" ("cae3", "dimensao", "year" DESC);
