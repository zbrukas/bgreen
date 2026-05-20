# V7 — Economic Profile + Sector Benchmarks

> **Status:** Not started
> **Depends on:** [V6 — AI Foundation + IES Extraction](06-ai-foundation-ies.md)
> **Parent PRD:** [../bgreen-greenfield-rewrite.md](../bgreen-greenfield-rewrite.md)
> **User stories covered:** PRD §48–53 (size classification + benchmarking), §47 (multi-year profile)

## Goal

Turn the raw `OrganizationEconomicProfile` (written in V6) into user-visible insight: classified SME size with rationale, sector benchmark comparison vs peers, and graceful "insufficient data" fallbacks where benchmarks don't exist. Multi-year profiles support trend tracking.

## Acceptance criteria

### Size classification

- [ ] **`DimensaoClassifier`** deep module — pure EU Recommendation 2003/361/EC arithmetic. Inputs: employees, turnover, balance sheet total, group rollup flag. Output: `{ dimensao: 'MICRO' | 'PEQUENA' | 'MEDIA' | 'GRANDE'; rationale: string[] }`.
- [ ] AI tool: `classifyOrganizationSize(input) → { proposedDimensao, rationale, confidence }` — uses Claude where heuristics + free-text rationale need narrative quality; deterministic `DimensaoClassifier` is the source of truth, the AI explains.
- [ ] UI: "Classificação proposta: PEQUENA — porque tem 32 funcionários e €4.8M de volume de negócios" with override dropdown.
- [ ] User can override; override persisted with `source = 'user_override'`. Stable once confirmed.
- [ ] Confirmation locks `dimensao` for the year; subsequent extraction proposals do not silently overwrite.

### Sector benchmarks

- [ ] `SectorBenchmark` module owns `SectorAggregate`. Drizzle migration creates `sector_aggregate (cae3, dimensao, year, fonte, n_companies, median_turnover, median_ebitda_margin, …)` with composite key.
- [ ] Seed: ~80 rows from BdP Quadros do Setor + INE for top-priority CAE-3 codes (covers ESG-relevant sectors). Loaded via Drizzle seed script. Vintage disclosed in payload.
- [ ] **`SectorBenchmarkLookup`** deep module — pure: `(cae3, dimensao, year) → SectorAggregate | InsufficientData`. Falls back to prior year if current missing; emits `InsufficientData` if no rows in 3-year window.
- [ ] UI: benchmark page shows org's turnover and EBITDA margin alongside the matched aggregate, with peer count + vintage badge ("Comparação baseada em dados de 2022, n=147 empresas").
- [ ] Insufficient-data state shows pt-PT message ("Dados setoriais insuficientes para CAE-3 = X em empresas PEQUENA"); does NOT show a misleading partial comparison.

### Multi-year profile

- [ ] User can upload a second IES (different year) and produce a multi-year `OrganizationEconomicProfile` view.
- [ ] Trend chart: turnover and EBITDA margin per year, with peer median overlaid where available.
- [ ] Year picker lets user switch the "active" year for recommendations / reports.

## In scope

- DimensaoClassifier + classifyOrganizationSize tool.
- SectorBenchmark schema + seed + lookup.
- Benchmark comparison UI.
- Multi-year profile view + trend chart.
- Insufficient-data states.

## Out of scope

- Weighted sector splits / multi-CAE handling → not in v1.
- Automated ETL from BdP/INE → static seed only.
- Cross-country benchmarks → PT-only in v1.
- Recommendations (next vertical) → V8.

## Module map

| Module | Status | Notes |
|---|---|---|
| EconomicProfile | **extended** | Adds size classification override flow, year picker. |
| SectorBenchmark | **new** | `SectorAggregate` + seed + lookup. |
| `packages/ai` | **extended** | Registers `classifyOrganizationSize` tool. |

## Deep modules introduced

- **`DimensaoClassifier`** — pure. Tests at every EU Recommendation 2003/361/EC threshold: 249 vs 250 employees; €49.9M vs €50.1M turnover; €43M vs €44M balance sheet; group-rollup activation; missing-input degrades to single-criterion classification. ~15 cases.
- **`SectorBenchmarkLookup`** — pure. Tests: happy-path join; missing-row → InsufficientData; year-fallback (current missing, prior present); both years missing → InsufficientData; dimensao mismatch → InsufficientData. ~6 cases.

## Open questions / risks

- **Seed data sourcing:** BdP Quadros do Setor + INE may have licensing constraints on redistribution. Mitigation: ship aggregates only (no per-company data); cite source per row in `fonte` column.
- **Sector mismatch on user-input CAE:** user's self-selected CAE may not match their actual operations. Acceptable for v1; trust user input + provide override mechanism in a settings screen (not in v1 UI surface unless cheap).
- **Vintage staleness:** benchmark data is 2-3 years lagged by nature. Mitigated by explicit vintage disclosure in UI per PRD.

## Deployable artifact

End of vertical: user with one or more IES uploads sees: classified dimensao + plain-language rationale + override option; sector benchmark page with peer comparison or honest "insufficient data" message; multi-year trend chart.

## Notes for the next vertical (V8)

V8 consumes the consolidated profile (size + sector + benchmarks + records data) as input to AI-generated recommendations. The cleaner the structured profile here, the better the recommendation prompts there.
