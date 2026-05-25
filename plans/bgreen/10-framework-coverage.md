# V10 — Framework Coverage Checker

> **Status:** Shipped (V10.1 + V10.2 + V10.3 + V10.4).
> **Depends on:** [V9 — Recommendations](09-recommendations.md)
> **Parent PRD:** [../bgreen-greenfield-rewrite.md](../bgreen-greenfield-rewrite.md)
> **User stories covered:** PRD §71–74 (regulatory framework coverage), supports §65 (PDF report template picker in V11)

## Sub-slice progress

- **V10.1 (shipped):** Seeds + migrations + package. New `packages/frameworks` ships three TypeScript datapoint catalogs (ESRS E1: 30 datapoints, GHG Protocol: 15, GRI: 20) + `SectorApplicability` rule + `evaluateSectorApplicability` predicate. Migration 0019 adds `framework_datapoints` (text PK, `framework` enum, jsonb applicability rule, version tag) + `template_datapoint_mappings` (UUID PK + UNIQUE on (template, datapoint)). `seed-framework-datapoints` script upserts the catalog by id. 10 catalog tests assert id uniqueness across frameworks, framework-prefix invariants, expected counts, and applicability evaluation.
- **V10.2 (shipped):** CoverageCalculator + admin mapping service/routes + datapoint catalog routes. `framework-coverage` module ships `CoverageCalculator` (pure: `(framework, datapoints, mappings, records, cae3, includeNonApplicable?) → CoverageMatrix`) with deterministic status rules (missing = no template mapped; partial = mapped but no submitted record; covered = ≥1 submitted/approved/certified record). Drafts + changes_requested are ignored for evidence rollup. Repos for catalog read + mapping CRUD (ON CONFLICT DO NOTHING for idempotent re-add). `CoverageService` orchestrates catalog + mappings + records + latest profile (CAE-3 derived via `extractCae3`). Routes: `GET /framework-datapoints` (any authed user), `GET /framework-coverage/:framework?includeNonApplicable=true|false` (org member), `GET/POST/DELETE /template-datapoint-mappings` (read open; mutations require `canCsWrite` per V5.4 CS-owned templates). Audit rows: `record_template.datapoint_mapped` / `datapoint_unmapped` against CS workspace. 13 calculator tests cover status rules, evidence rollup, applicability filter (default + override), framework filtering, counts summary. Full monorepo typecheck green; 147 tests in apps/api (13 new). Boot smoke confirms all three routes mount and 401 without auth.
- **V10.3 (shipped):** AI tool + checkFrameworkCoverage service + coverage-check runs. `checkFrameworkCoverageTool` (zod 1-60 explanations per call; each item echoes status, datapointId + 2-3 sentence explanation + 1-2 sentence suggestedNextStep; pt-PT system prompt forbids regulatory citations beyond the framework's own code per v1.5 anti-hallucination posture; tone branches by status). `CoverageService.checkCoverage` composes `getMatrix` + AI call + drift-guarded merge: rejects explanations whose status disagrees with the deterministic matrix (V9.2 mode-mismatch pattern). Synchronous (~10s typical, capped at 12K output tokens). Empty matrix short-circuits without AI. AI failures degrade gracefully — matrix still returned, `aiError` carries the pt-PT message, route returns 200. Route: `POST /framework-coverage/:framework/check?includeNonApplicable=...` (org member). New audit entity kind `framework_coverage_check`; service writes `framework_coverage.check` with framework + counts + explanationCount; the per-AI-call observer writes `ai.tool_call.check_framework_coverage` against the same correlation id. 6 service tests cover happy-path merge, AI context propagation, status-drift guard, empty-matrix short-circuit, transient + parse failures degrading to bare matrix + aiError. Full monorepo typecheck green; 153 tests in apps/api (6 new). Boot smoke confirms the new route mounts + 401 without auth.
- **V10.4 (shipped):** UI — `/coverage` server-renders the deterministic matrix for the active framework (search-param: `framework=esrs|ghg|gri`, `includeNonApplicable=true|false`); `FrameworkPicker` tab-row swaps frameworks via URL state. Client `CoverageMatrixView` owns status filter chips (Todos / Coberto / Parcial / Em falta with counts), an "Apenas aplicáveis ao meu setor" toggle (default on; flipping it navigates with `includeNonApplicable=true` so the SSR boundary stays the source of truth), and an "Explicar cobertura" mutation that calls POST `/framework-coverage/:framework/check`. Per-row expansion surfaces the AI `explanation` + `Próximo passo`; missing rows label the toggle as "Como começar". `AiBanner` ("Explicações geradas por IA — valide com o seu consultor.") is permanent. `/coverage/mappings` is the CS-only mapping editor: lists every template with chip-row of mapped datapoints (× removes) + add-datapoint picker scoped by framework. CS users see the editor; non-CS users see a forbidden-notice banner and route-level CS enforcement still rejects writes. Header gains a "Cobertura" link. Web routes: `/coverage` and `/coverage/mappings` both compile + redirect 307 without a session. Full monorepo typecheck green.

## Goal

Tell a user, for a chosen reporting framework (CSRD/ESRS, GHG Protocol, GRI), which datapoints they cover from their records, which are partial, and which are missing — with AI-generated explanations grounded in their sector. This is the "what do I still need to collect before I can hit `Gerar relatório`?" surface that V11 leans on.

## Acceptance criteria

- [ ] `ReferenceData` module extended with datapoint maps:
  - **ESRS** subset (start with ESRS E1 climate; cover the ~30 most-applicable datapoints). Each entry: `id`, `framework`, `topic`, `datapoint`, `sector_applicability` (CAE-3 ranges or "all").
  - **GHG Protocol** Scope 1/2/3 datapoints (~15).
  - **GRI** disclosure subset relevant to PT mid-caps (~20).
- [ ] Drizzle migration: `framework_datapoint` table seeded from `packages/pt-data` (or a sibling `packages/frameworks` if the data grows large).
- [ ] **`CoverageCalculator`** deep module — pure: `(framework, org_profile, records, sector) → Array<{ datapoint, status: 'covered' | 'partial' | 'missing', evidence: { recordIds: string[] } }>`. Pure mapping of records to datapoints by a `record_template → datapoint` configuration table seeded alongside templates.
- [ ] AI tool: `checkFrameworkCoverage(input: { framework, profile, sector, coverageRows }) → { explanations: Array<{ datapoint, status, explanation, suggestedNextStep }> }` — adds plain-language explanations and suggested next steps. Deterministic coverage status comes from `CoverageCalculator`; AI explains.
- [ ] Datapoint-to-record-template mapping: org admins can map their `RecordTemplate`s to framework datapoints (one template can satisfy multiple datapoints; a datapoint can require multiple templates). Stored in a join table.
- [ ] UI:
  - Framework picker (CSRD/ESRS, GHG, GRI) — default to ESRS for v1.
  - Coverage matrix: list of datapoints with status badge (verde/amarelo/vermelho) + per-row explanation panel.
  - Filter by status. Filter to "applicable to my sector only" (default on).
  - For each `missing` datapoint, "Como começar" link opens an explanation panel + "criar RecordTemplate sugerido" CTA (creates a template stub from a known shape).
- [ ] Explainability: when a datapoint is flagged as applicable, the explanation cites the org's CAE-3 and dimensao. E.g., "E1-6 aplica-se porque o seu CAE-3 = 35.11 está na lista de setores energo-intensivos."
- [ ] FGA gates: only org members can see; only org admins can edit datapoint→template mappings.
- [ ] AuditLog captures: framework picker switch, mapping edit, coverage-check generation runs.
- [ ] All UI in pt-PT.

## In scope

- Framework datapoint seeds (ESRS subset, GHG, GRI).
- CoverageCalculator deep module.
- checkFrameworkCoverage AI tool for explanations.
- Datapoint↔template mapping table + admin UI.
- Coverage matrix UI with filters + explanations.

## Out of scope

- Full ESRS coverage (all topics, all sectors) → v1.5 (start with E1 + most-applicable).
- Auto-suggested mappings (AI infers which template covers which datapoint) → deferred; user maps explicitly.
- Generating compliance-grade reports from coverage → that's V11.
- Sector-specific deep dives beyond CAE-3 applicability rules → deferred.
- Country-specific frameworks beyond EU/PT context → not in v1.
- Live tracking of framework changes / version bumps → manually update seeds; no automation.

## Module map

| Module | Status | Notes |
|---|---|---|
| ReferenceData | **extended** | Framework datapoint catalogue. |
| `packages/frameworks` *(or stay in pt-data)* | **new or extended** | Seed JSON for ESRS / GHG / GRI subsets. |
| FormTemplates | **extended** | Adds `datapoint_mappings` join table on templates. |
| `packages/ai` | **extended** | Registers `checkFrameworkCoverage` tool. |

## Deep modules introduced

- **`CoverageCalculator`** — pure. Tests: applicability rule (sector match), evidence rollup (multiple records mapping to one datapoint), partial-coverage (template mapped but no records submitted), missing-coverage (no template mapped), datapoint not applicable to sector (excluded from output). ~10 cases.

## Open questions / risks

- **Datapoint seed quality:** the ESRS catalogue is long and dense; v1 ships a subset. Risk: pilot customers find their critical datapoint missing. Mitigation: explicit "v1 covers a subset — request additions via [feedback channel]" in UI.
- **Mapping burden on admins:** mapping templates to datapoints is admin work. Mitigation: ship reasonable defaults for common templates (energy, water, emissions) baked into the seed.
- **AI explanation drift:** Claude might explain why a datapoint is missing differently each run. Mitigation: deterministic status from `CoverageCalculator`; AI only writes the narrative. The status badge is authoritative.
- **Framework version drift:** ESRS will revise. Mitigation: seed file is versioned; migrations introduce new revisions without overwriting old ones; UI shows "Baseado em ESRS v2024".

## Deployable artifact

End of vertical: a user picks framework "ESRS E1", sees a matrix of ~30 datapoints — most are red ("missing"), a few green ("covered") because they've submitted Energy Consumption records → user clicks a red row → AI explains the applicability and suggests next step → admin maps the existing "Monthly Energy Consumption" template to E1-5 and the row goes green.

## Notes for the next vertical (V11)

V11's PDF reports lean on this vertical: the report template picker (GHG / ESRS E1 / custom) will pre-filter by framework; missing-datapoints can be surfaced as warnings before generation. Keep `CoverageCalculator` consumable by V11's pipeline.
