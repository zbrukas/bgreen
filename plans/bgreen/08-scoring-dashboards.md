# V8 — ESG Scoring + Dashboards

> **Status:** In progress — V8.1 shipped (FormSchema scoring metadata + ScoringEngine).
> **Depends on:** [V4 — Form Templates + Records](04-form-templates-records.md), [V7 — Economic Profile + Sector Benchmarks](07-economic-profile-benchmarks.md)
> **Parent PRD:** [../bgreen-greenfield-rewrite.md](../bgreen-greenfield-rewrite.md)
> **User stories covered:** PRD §82–90 (scoring + dashboards); feeds V9 (recommendations) and V11 (PDF reports)

## Sub-slice progress

- **V8.1 (shipped):** FormSchema zod gains optional `score` on select/multi-select options, `scoring: linear | thresholds` on number fields, `aggregate: sum|avg|min|max` on repeating, per-field `weight`, and template-level `scoring: {maxScore, buckets: [{minPct, label}]}`. New package `@bgreen/scoring` with pure `computeScore(template, values) → ScoreResult | null` — handles select/multi-select/number/repeating/showIf skip/missing-value skip/weight/tier classification with maxScore cap. 15 unit tests.
- **V8.2 (shipped):** Persistence + compute-on-submit + scores API. Migration 0017 adds `score numeric(20,2)`, `score_percent numeric(7,4)`, `score_tier text`, `score_breakdown jsonb` to `records` (all nullable). @bgreen/types Record gets the four fields + a `ScoreBreakdownEntry` schema. RecordRepository accepts an optional `ScoreSnapshotInput` on insert and updateValues; numeric round-trip through `numeric.toFixed(4)` ↔ `parseNumeric`. RecordService computes via `@bgreen/scoring.computeScore(template.formSchema, validated.values)` on submit (when !asDraft) and on update (when action='submit'); drafts and save-as-draft leave the columns alone. Templates without `scoring` produce an explicit all-null snapshot. New endpoint `GET /records/scores` returns per-template grouped score history (drafts and score-less records filtered, ascending by submittedAt) — feeds the V8.3 dashboard. 7 new RecordService tests covering submit/draft/update paths + filter behavior. Side-effect: `record-service.ts` now imports `defaultWorkflowDefinitionId` from the workflows deep-export rather than the barrel, so test files don't transitively load `services.ts`.

## Goal

Turn raw `Record` data into a per-template ESG score per organization, classify into tiers, surface trend lines on a dashboard, and feed both Recommendations (V9) and PDF Reports (V11). This is the layer that makes bGreen feel like an ESG **measurement** product, not just a data collector.

## Acceptance criteria

### FormSchema extensions

- [ ] `select` / `multi_select` field options gain optional `score: number`. Sum across selected options for multi-select.
- [ ] `number` field gains optional `scoring`: `{ kind: "linear", per: number }` (score = value × per) **or** `{ kind: "thresholds", thresholds: Array<{ upTo: number; score: number }> }`.
- [ ] `repeating` group aggregates: `{ aggregate: "sum" | "avg" | "min" | "max" }` over per-sub-record sub-scores. Default: sum.
- [ ] Field-level optional `weight: number` (multiplier on the field's score, default 1).
- [ ] Template-level `scoring`: `{ buckets: Array<{ minPct: number; label: string }>, maxScore: number }` — defines tier names (e.g., 0–50 "C", 50–80 "B", 80–100 "A").
- [ ] zod schemas in `@bgreen/types` extended; FormSchemaInterpreter unchanged (scoring is computed separately).

### Scoring engine

- [ ] **`ScoringEngine`** deep module in `packages/form-engine` (or a sibling `@bgreen/scoring` package):
  - `computeScore(template, recordValues) → ScoreResult { total, percent, tier, breakdown: Array<{ fieldId, raw, weighted, contribution }> }`
  - Pure. ~12 vitest cases: select / multi-select / number-linear / number-thresholds / repeating aggregates / weighted field / missing field skip / hidden field skip (show-if false) / bucket classification / maxScore cap / empty record / explicit zero.

### Persistence

- [ ] `records` gains `score numeric`, `score_percent numeric`, `score_tier text`, `score_breakdown jsonb` columns (nullable; populated when the template has scoring).
- [ ] Score computed at submission time (and on re-submit after `changes_requested`). Template-edit + recompute is **out of scope** for v1 — published templates are immutable (V4 rule), so existing record scores remain valid against the template version they were submitted against.

### API

- [ ] `GET /organizations/me/scores` — returns per-template score history (org's records, grouped by template, sorted by submittedAt).
- [ ] `GET /records/:id` already returns the full record incl. score fields when present.

### Dashboard surface

- [ ] New `/dashboard` route (signed-in users): cards per published template showing latest score + tier + trend sparkline (last 6 entries).
- [ ] Header link "Painel" (or fold into existing home if simpler).
- [ ] Peer-rank surface when `SectorBenchmark` data is available for the org's CAE-3 + dimensão (extends V7) — show "P50: 62 / your: 71".
- [ ] All UI in pt-PT.

### Cross-vertical hooks (executed in V9 / V11)

- [ ] V9 RecommendationsService prompt builder reads the latest score per template; prompt mode FULL gains a "low-scoring areas" hint.
- [ ] V11 ReportInstance commentary input includes scores per template; ESRS / GHG report templates surface the tier banner on the cover.

## In scope

- FormSchema scoring metadata.
- ScoringEngine deep module.
- Record score persistence (computed at submit / re-submit).
- `/dashboard` org-level surface with trend + peer rank.
- Touch-points in V9 and V11 to consume the score.

## Out of scope

- Real-time score recalc when an admin edits a published template — published templates are immutable in v1; no recalc needed.
- Custom org-specific scoring algorithms beyond what the template defines.
- Score export to external systems (CSV/API for partners).
- Score-based access control (e.g., "hide poor scores").
- AI-suggested scoring weights — v1 admins set scores manually.
- Cross-template composite scores (e.g., "overall ESG" weighted across multiple templates).

## Module map

| Module | Status | Notes |
|---|---|---|
| FormTemplates | **extended** | FormSchema zod gets scoring metadata. |
| Records | **extended** | score / score_percent / score_tier / score_breakdown columns. |
| Scoring | **new** (or absorbed into `@bgreen/form-engine`) | `ScoringEngine.computeScore`. |
| Recommendations | **extended** | reads score in prompt build. |
| Reports | **extended** | renders score section in PDF. |
| Dashboard | **new** | new `/dashboard` route on `apps/web`. |

## Deep modules introduced

- **`ScoringEngine`** — pure. Tests outlined above (~12 cases).

## Open questions / risks

- **Score comparability when templates evolve:** if a published template is archived and replaced by a new version with different scoring, historical record scores are still valid against their original template but cannot be directly compared to new-template records. Mitigation: surface the template version next to the score on the dashboard.
- **Tier inflation:** admins set their own buckets, which makes inter-org comparison meaningless without normalization. Mitigation: peer-rank surfaces the raw percentile so users can sanity-check against sector benchmarks; v1.5 introduces a curated "standard ESG questionnaire" template with shared buckets.
- **`show-if` interaction:** hidden fields don't score. The engine must filter them out by re-evaluating predicates before summing.

## Deployable artifact

End of vertical: an admin publishes a template with scored select options. Members submit records. The dashboard shows: "Modelo X — 72/100 (Tier B), tendência ↑" with a 6-entry sparkline. When V11 ships, a generated PDF will open with "Resultado geral: 72/100 (Tier B)"; when V9 ships, recommendations will emphasise the lowest-scoring fields.

## Notes for v1.5

- Real-time recalculation when an admin clones-and-edits a template — record cohort migration tooling.
- Curated reference templates with industry-standard scoring (ESRS E1 minimum-disclosure, GHG inventory) shipping pre-seeded.
- Cross-template composite scores per organization.
