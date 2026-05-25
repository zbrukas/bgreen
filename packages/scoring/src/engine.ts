// ScoringEngine — pure. Given a FormSchema with scoring metadata + a
// RecordValues payload, produces a ScoreResult (or null when the
// template has no `scoring` block).
//
// Rules (V8 plan):
//   - Visit every leaf field. Skip if showIf predicates evaluate to
//     false. Skip if the value is absent.
//   - select         → score = option.score (default 0 if option lacks one).
//   - multi_select   → score = Σ option.score for each selected option.
//   - number/linear  → score = value × per.
//   - number/threshold → first matching upTo bucket's score (sorted asc
//                      by upTo defensively). Above all thresholds → 0.
//   - repeating      → score per sub-row, then aggregate via the field's
//                      `aggregate` setting (default sum). Sub-row scoring
//                      recurses through the leaf fields above.
//   - text / date / calculated → no score (text/date have no inherent
//                      score metadata; calculated fields are derived).
//   - Apply field-level `weight` (default 1) → weighted contribution.
//   - Sum weighted contributions; cap total at maxScore.
//   - percent = total / maxScore × 100, capped at 100.
//   - tier = bucket with the highest minPct ≤ percent.
//
// `maxScore` is admin-set rather than auto-derived. That keeps the
// percent stable when admins reshape weights in-place (within a draft
// template — published templates are immutable in v1).

import type {
  Field,
  FormSchema,
  LeafField,
  MultiSelectField,
  NumberField,
  NumberScoring,
  RecordValues,
  RepeatingField,
  SelectField,
  ShowIfPredicate,
} from "@bgreen/types";
import type { ScoreContribution, ScoreResult } from "./types.js";

// Evaluate showIf predicates against a sibling map. Mirrors the
// form-engine's logic (intentionally re-implemented rather than
// imported — the predicate shape is tiny + stable, and it keeps
// scoring decoupled from interpreter internals).
function isVisible(
  predicates: ShowIfPredicate[] | undefined,
  siblings: RecordValues,
): boolean {
  if (!predicates || predicates.length === 0) return true;
  return predicates.every((p) => {
    const actual = siblings[p.fieldId];
    if (actual === null || actual === undefined) return false;
    return String(actual) === p.equals;
  });
}

// Iterate every leaf field across all rows. Returns a flat list with
// the row container so the caller can reach siblings for showIf eval.
function* iterateRowFields(
  schema: FormSchema,
): Iterable<{ field: Field; siblings: Field[] }> {
  for (const row of schema.rows) {
    for (const field of row.fields) {
      yield { field, siblings: row.fields };
    }
  }
}

// Compute a leaf field's raw score (before weight), or null if there's
// nothing to score (value missing, no scoring metadata, unsupported kind).
function leafScore(field: LeafField, value: unknown): number | null {
  if (value === null || value === undefined) return null;
  switch (field.kind) {
    case "select":
      return selectScore(field, value);
    case "multi_select":
      return multiSelectScore(field, value);
    case "number":
      return numberScore(field, value);
    // text / date / calculated have no scoring metadata in v1.
    case "text":
    case "date":
    case "calculated":
      return null;
  }
}

function selectScore(field: SelectField, value: unknown): number | null {
  if (typeof value !== "string") return null;
  const option = field.options.find((o) => o.value === value);
  if (!option) return null;
  // option.score === undefined → treat as "no score on this option" (0
  // contribution). The engine still emits a breakdown entry so the UI
  // can show "this field scored 0".
  return option.score ?? 0;
}

function multiSelectScore(field: MultiSelectField, value: unknown): number | null {
  if (!Array.isArray(value)) return null;
  const selected = new Set(value.map(String));
  let total = 0;
  let touched = false;
  for (const option of field.options) {
    if (!selected.has(option.value)) continue;
    if (option.score !== undefined) total += option.score;
    touched = true;
  }
  // No selection → null (omit from breakdown). At least one selection,
  // even if all selected options lack a score, → 0 (entry emitted).
  return touched ? total : null;
}

function numberScore(field: NumberField, value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (!field.scoring) return null;
  return computeNumberScore(field.scoring, value);
}

function computeNumberScore(scoring: NumberScoring, value: number): number {
  if (scoring.kind === "linear") return value * scoring.per;
  // Thresholds: first match wins on the SORTED list (asc by upTo).
  // Admin-time ordering shouldn't affect results.
  const sorted = [...scoring.thresholds].sort((a, b) => a.upTo - b.upTo);
  for (const bucket of sorted) {
    if (value <= bucket.upTo) return bucket.score;
  }
  // Above all thresholds → 0 (admin can add a sentinel upTo:Infinity if
  // they want a catch-all score).
  return 0;
}

// One sub-row of a repeating field. Same leaf-iteration logic as the
// top level, scoped to the sub-row's siblings for showIf eval.
function subRowScore(field: RepeatingField, subRow: RecordValues): number {
  let sum = 0;
  for (const child of field.fields) {
    if (!isVisible(child.showIf, subRow)) continue;
    const raw = leafScore(child, subRow[child.id]);
    if (raw === null) continue;
    sum += raw * (child.weight ?? 1);
  }
  return sum;
}

function repeatingScore(field: RepeatingField, value: unknown): number | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const perRow = value
    .filter((r): r is RecordValues => r !== null && typeof r === "object" && !Array.isArray(r))
    .map((r) => subRowScore(field, r));
  if (perRow.length === 0) return null;
  const aggregate = field.aggregate ?? "sum";
  switch (aggregate) {
    case "sum":
      return perRow.reduce((a, b) => a + b, 0);
    case "avg":
      return perRow.reduce((a, b) => a + b, 0) / perRow.length;
    case "min":
      return Math.min(...perRow);
    case "max":
      return Math.max(...perRow);
  }
}

function pickTier(percent: number, buckets: FormSchema["scoring"] extends infer S ? S : never): string {
  // Defensive — caller has already null-checked scoring.
  if (!buckets || !Array.isArray(buckets.buckets) || buckets.buckets.length === 0) {
    return "—";
  }
  // Sort ascending by minPct; pick the LAST bucket whose minPct ≤ percent.
  const sorted = [...buckets.buckets].sort((a, b) => a.minPct - b.minPct);
  let chosen = sorted[0]?.label ?? "—";
  for (const bucket of sorted) {
    if (percent >= bucket.minPct) {
      chosen = bucket.label;
    }
  }
  return chosen;
}

export function computeScore(template: FormSchema, values: RecordValues): ScoreResult | null {
  if (!template.scoring) return null;

  const breakdown: ScoreContribution[] = [];

  for (const { field, siblings } of iterateRowFields(template)) {
    if (!isVisible(field.showIf, values)) continue;
    const weight = field.weight ?? 1;
    let raw: number | null = null;
    if (field.kind === "repeating") {
      raw = repeatingScore(field, values[field.id]);
    } else {
      raw = leafScore(field, values[field.id]);
    }
    if (raw === null) continue;
    breakdown.push({
      fieldId: field.id,
      raw,
      weight,
      weighted: raw * weight,
    });
    // Touch siblings array reference so the compiler doesn't flag it as unused —
    // siblings would be needed if we ever made cross-field rules at the row level.
    void siblings;
  }

  const summed = breakdown.reduce((acc, b) => acc + b.weighted, 0);
  const total = Math.min(summed, template.scoring.maxScore);
  const percent = Math.min(100, (total / template.scoring.maxScore) * 100);
  const tier = pickTier(percent, template.scoring);

  return { total, percent, tier, breakdown };
}
