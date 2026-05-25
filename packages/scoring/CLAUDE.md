# packages/scoring — ESG ScoringEngine

Bounded context: turn a `RecordValues` payload + a scoring-enabled
`FormSchema` into a per-record `ScoreResult` (total, percent, tier,
per-field breakdown).

## Owns
- `ScoringEngine.computeScore(template, values)` — pure.
- `ScoreResult` shape (re-exported from `@bgreen/types` is the wire
  shape; the engine produces it).

## Does NOT own
- FormSchema interpretation / show-if evaluation (lives in
  `@bgreen/form-engine`; this package depends on it for predicate eval).
- Score persistence (records table — that's `packages/db` + the
  Records module in apps/api).
- Aggregation across records / time-series (V8.2 dashboard layer).

## Rule
- No I/O. No DB access. No exceptions: every branch returns a
  `ScoreResult` (templates without `scoring` return `null`).
- Hidden fields (`showIf` predicate false) are not scored. Missing
  values are not scored. Both behave the same: their contribution is
  omitted from `breakdown` and the total.

## Determinism
- Same (template, values) → same `ScoreResult`. The engine sorts
  threshold ladders before evaluation so admin-time ordering doesn't
  affect results.
