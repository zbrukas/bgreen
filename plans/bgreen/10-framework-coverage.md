# V10 — Framework Coverage Checker

> **Status:** Not started
> **Depends on:** [V9 — Recommendations](09-recommendations.md)
> **Parent PRD:** [../bgreen-greenfield-rewrite.md](../bgreen-greenfield-rewrite.md)
> **User stories covered:** PRD §71–74 (regulatory framework coverage), supports §65 (PDF report template picker in V11)

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
