# Plan: Charts & visuals for PDF reports — Phase 1 (landscape "deck" carbon-footprint template)

## Context

bGreen's PDF reports (`apps/pdf`) currently render **text-only A4-portrait** documents (3 templates: `ghg-inventory`, `esrs-e1`, `custom`) via React `renderToStaticMarkup` → inlined CSS → Gotenberg/Chromium. Reference carbon-footprint reports from PT consultancies (Parapedra/CCENERGIA, RENOVA/Get2C) are polished **16:9 landscape decks** with donut/area charts, KPI callout cards, section-divider pages, full-bleed brand color, and multi-level tables. We want generated (templated, not hand-composed) reports of similar visual quality.

The rendering engine (headless Chromium) is already fully capable — it renders any HTML/CSS/SVG. The gap is purely **component/layout authoring**, not infrastructure.

**This plan delivers Phase 1 only: the visual layer in `apps/pdf`, driven by fixture payloads, rendered through real Gotenberg.** It is demoable standalone with **zero `apps/api` changes**. The wire contract (a new zod schema) is the seam; wiring real emissions data from records (`report-data-builder.ts` currently stubs emissions to zero) is a deferred Phase 2.

Decisions confirmed with user: **A4 landscape deck** layout; **visual layer first (fixtures)**.

## Approach

A **new, additive `carbon-footprint` template** (4th registry entry) + a shared visual component library. The 3 existing templates, their schemas, and `index.test.ts` are **not modified** (lowest-risk). Charts are **static inline SVG** generated with `d3-shape` path generators (pure math, no DOM) — recharts/victory are rejected because they require DOM measurement that never happens under `renderToStaticMarkup`.

### Key technical choices
- **Charts**: `d3-shape` (`pie`/`arc`/`area`/`line`/`stack`) emitting `<path>`/`<rect>`/`<text>` SVG, wrapped in thin pure-function React components. Deterministic: all coords rounded via a shared `r()` helper; series colors from theme palette in fixed order; pt-PT number formatting. No `foreignObject`, no canvas, no client JS.
- **Fonts**: base64-embedded `@font-face` (subset woff2) inlined into CSS — no remote font fetch (avoids Gotenberg `waitTimeout` flake → fallback-font pagination drift). Keep `Helvetica Neue` fallback.
- **Orientation**: Chromium `@page` is one size per document — **do not mix orientations in one PDF**. Refactor `styles.ts` to a `buildTemplateCss({orientation})` function; `TEMPLATE_CSS = buildTemplateCss()` keeps the exact current portrait rule for existing callers (snapshot-safe). The deck variant declares `@page { size: A4 landscape; margin: 0 }` and applies content margins via an inner `.page-inner` padding wrapper (so full-bleed colored pages are possible).
- **Theme**: extend `brandTheme()` to a palette while **keeping `.accent` === primaryColor verbatim** (existing callers + snapshot stay green). Add `primary/secondary/surface/onSurface/series[]`, derived deterministically from the org color via a small pure HSL helper + a curated default series palette.

## Files

### New (apps/pdf)
- `src/templates/carbon-footprint.tsx` — the deck template.
- `src/templates/shared/DeckLayout.tsx` — landscape deck shell: full-bleed `CoverPage` → `KpiSummaryPage` → `SectionDivider` + content pages → reused `FooterStrip`. Sibling to `ReportLayout.tsx` (unchanged).
- `src/templates/shared/charts/geometry.ts` — `r()` rounding, `polarToCartesian()`, `ChartSeriesDatum`.
- `src/templates/shared/charts/DonutChart.tsx` — donut w/ center total + % slice labels (`DonutChartProps`: data, size, thickness, centerPrimary/Secondary, palette, minSlicePctForLabel).
- `src/templates/shared/charts/StackedBarChart.tsx` — vertical stacked columns + Y axis.
- `src/templates/shared/charts/AreaChart.tsx` — single/stacked area or line time-series.
- `src/templates/shared/charts/Legend.tsx` — shared swatch+label rows.
- `src/templates/shared/charts/KpiCard.tsx` — big callout card (flex div, not SVG).
- `src/templates/shared/RichTable.tsx` — merged header groups (`colSpan`), zebra, highlighted total/subtotal rows (`RichTableProps`: columns, headerGroups, rows w/ `emphasis`, theme, numberFormat). Per-row backgrounds via inline style (dynamic color), like existing status pills.
- `src/templates/shared/format.ts` — pt-PT `formatNumber`/`formatTco2e` for new code (do NOT touch `ghg-inventory.tsx`'s copy in Phase 1; consolidate later).
- `src/templates/shared/fonts.ts` — `FONT_FACE_CSS` base64 blocks (isolated from `styles.ts`).
- `scripts/render-fixture.ts` — dev-only: build HTML for a checked-in fixture payload, POST to Gotenberg, write PDF to gitignored `tmp/` for eyeballing. Not in CI.
- `src/templates/__fixtures__/carbon-footprint.fixture.ts` — rich sample payload (real-looking breakdown rows, scope split, time-series, KPIs).

### Changed (additive only)
- `src/templates/types.ts` — add `carbonFootprintDataSchema` (rich: per-scope breakdown rows, scope split for donut, optional multi-period time-series, KPI values, intensity). This schema is the contract Phase 2 will fill.
- `src/templates/index.tsx` — register `"carbon-footprint"` entry; thread an optional `orientation` from the registry entry into `wrapDocument` → `buildTemplateCss({orientation})`. Existing entries pass nothing → identical output.
- `src/templates/styles.ts` — introduce `buildTemplateCss({orientation})`; concat `FONT_FACE_CSS`; add static CSS for `.rich-table`, deck pages (`.report-page`, `.page-inner`, `.section-divider`), chart wrappers. Keep `TEMPLATE_CSS` const = `buildTemplateCss()`.
- `src/templates/shared/brand.ts` — palette fields (keep `.accent`).
- `src/templates/index.test.ts` — new structural assertions for the deck entry + a regression assertion that existing templates still emit `size: A4` **without** `landscape`.
- `package.json` — add `d3-shape`, `d3-scale`, `@types/d3-shape`, `@types/d3-scale`.

## Verification

1. `pnpm --filter @bgreen/pdf typecheck` and `pnpm --filter @bgreen/pdf test` (structural + regression assertions; CI gate, no Docker).
   - Assert: deck render `ok:true`; html contains `<svg`, donut `<path>` count == non-zero slices, center total string, legend labels, a `theme.series` color, and `size: A4 landscape`.
   - Regression: existing templates still contain `size: A4` and NOT `landscape`.
   - Optional scoped golden-SVG `toMatchInlineSnapshot` on the donut fragment to catch geometry drift.
2. **Real visual check** (manual): Gotenberg is already up at `:3010`. Run `GOTENBERG_URL=http://localhost:3010 pnpm --filter @bgreen/pdf exec tsx scripts/render-fixture.ts` → open the written PDF and compare against the reference decks (cover, divider, donut + KPI page, rich table).
3. Confirm pt-PT formatting (`1.234,56`), embedded font rendering, and full-bleed color all hold in the actual PDF.

## Risks
- **`@page` refactor** is the only snapshot-breaking risk → mitigated by `buildTemplateCss()` defaulting to the exact current portrait rule; verified by regression assertion.
- **Font payload size** (tens of KB per render) — acceptable.
- **Full-bleed vs page margin** — only solvable per-document; deck uses `margin:0` + inner padding. No mixed orientation in one PDF.
- **Empty charts if mistakenly driven by live data** — Phase 1 is fixture-driven by design; live data is Phase 2.
- `d3-shape`/`d3-scale` are ESM-native; confirm types resolve under `tsc --noEmit`.

## Phase 2 — DELIVERED (real emissions data wired)

- `carbon-footprint` is now first-class end-to-end: `REPORT_TEMPLATE_IDS` (domain), `ReportTemplate` (pdf-engine wire type), `renderBodySchema` enum (apps/pdf route), AI commentary tool enum.
- New `apps/api/.../application/emissions-extractor.ts`: reads scope 1/2/3 totals + coarse sources from a submitted record's `values` by a documented field-id convention (`EMISSION_FIELDS`, matching the seeded ESG template). `templateHasEmissions()` skips non-emissions templates.
- `ReportDataBuilder.extractEmissions()` picks the org's latest submitted emissions record and populates `snapshot.carbonFootprint`. GHG/ESRS stub unchanged (no behaviour/hash change for them).
- `report-service.composePdfPayload` `carbon-footprint` branch maps snapshot → `carbonFootprintDataSchema` (scopes, sources, KPIs, intensity from turnover); synthesises minimal scopes/sources when sparse so it always renders. Template gates the distribution/trend page so a coarse single-total scope doesn't render a 100% donut.
- Tests: api 186/186 (incl. new extraction test), pdf 10/10, typecheck clean. Verified via real Gotenberg render of the rich fixture (8 pages) + sparse real-data shape (5 pages).

### Known limitations / follow-ups
- `EMISSION_FIELDS` convention matches the seeded ESG template — the one assumption affecting customer-facing numbers; confirm/adjust if other templates differ (one-line change).
- Per-source granularity is coarse (one row per scope) because the template collects scope totals, not per-source activity. Rich per-source breakdown + factor table + multi-year trend need a richer emissions template (future).
- Scope 3 source rows show the raw option value (e.g. "c1"); option value→label mapping is a small refinement.

## Out of scope (still deferred)
- Retrofitting charts into the existing `ghg-inventory`/`esrs-e1` templates (would change their snapshots — separate review).
- Per-org custom uploaded fonts; brand-font embedding (woff2 base64 hook ready in `fonts.ts`).

> On approval I'll also copy this plan into the repo at `plans/bgreen/` per project convention before starting.
