// Wire shape of a per-record score. Persisted in chunks on `records`
// (numeric for total/percent + jsonb for breakdown) and surfaced as-is
// to the dashboard.
//
// `breakdown` carries one entry per scored field that contributed
// (whether positively or as a zero). Hidden / missing fields are NOT
// in the breakdown — they get no entry, which matches what V8 plan
// requires for show-if and missing-value paths.

import type { FieldId } from "@bgreen/types";

export interface ScoreContribution {
  fieldId: FieldId;
  // Raw score before applying the field-level weight. For a select
  // this is the chosen option's score; for multi_select the sum of
  // selected options' scores; for number it's the result of the
  // linear/threshold strategy; for a repeating group it's the
  // aggregated sub-score.
  raw: number;
  // Multiplier applied (default 1, can be 0).
  weight: number;
  // raw × weight. The total is sum(weighted) across all entries.
  weighted: number;
}

export interface ScoreResult {
  // Sum of weighted contributions, capped at maxScore.
  total: number;
  // total / maxScore × 100, capped at 100.
  percent: number;
  // Bucket label whose minPct is the highest one ≤ percent.
  tier: string;
  breakdown: ScoreContribution[];
}
