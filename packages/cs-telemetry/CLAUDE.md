# @bgreen/cs-telemetry — Customer Success health math

Pure-TS leaf package. Consumes signals (counts, dates, scores) from the
`cs_org_health` SQL view (lives in `@bgreen/db`) and produces a composite
health score + tier + per-dimension breakdown.

## Owns
- `CsHealthCalculator.computeHealth(signals)` — pure function.
- `HEALTH_FORMULA` — the single tuneable knob. Weights, tier thresholds,
  per-dimension scoring tables.
- Type aliases for inputs/outputs.

## Does NOT own
- SQL view definition (lives in `packages/db/migrations/0023_*.sql`).
- API endpoints / routes (`apps/api/src/modules/cs-admin`).
- The snapshot-table read path or chart rendering.

## Tuning
Edit `HEALTH_FORMULA` in `src/calculator.ts`. Redeploy. No DB migration
needed — the formula only consumes raw signals.

## Stagnation is intentionally out of the composite
Stagnation count is exposed in the result but does NOT influence the
score or tier. It would double-count signals already captured by
coverage + login recency. CSMs use stagnation directly as an outreach
trigger via the `hasStagnantWork` filter — separate from the score.
