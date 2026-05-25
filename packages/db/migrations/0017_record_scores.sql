-- V8.2 — per-record ESG score columns.
--
-- All nullable: only records whose template carries a `scoring` block
-- on its FormSchema get populated. Pre-V8 records and any
-- template-without-scoring records stay NULL.
--
-- score:         the raw weighted total, capped at template.scoring.maxScore.
--                numeric(20,2) for headroom — actual values are typically
--                two- or three-digit, but the column matches the other
--                money/score numeric columns' precision.
-- score_percent: total / maxScore × 100, capped at 100. numeric(7,4)
--                holds 999.9999 (overkill but cheap; lets us record raw
--                pre-cap values if v1.5 ever surfaces them).
-- score_tier:    text label of the matched bucket (or '—' when below all).
-- score_breakdown: the per-field contribution array (jsonb).

ALTER TABLE "records"
  ADD COLUMN "score" numeric(20, 2),
  ADD COLUMN "score_percent" numeric(7, 4),
  ADD COLUMN "score_tier" text,
  ADD COLUMN "score_breakdown" jsonb;
