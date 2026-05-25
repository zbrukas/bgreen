# V11 — PDF Reports

> **Status:** In progress — V11.1 + V11.2 + V11.3 shipped.
> **Depends on:** [V10 — Framework Coverage Checker](10-framework-coverage.md), [V8 — Scoring + Dashboards](08-scoring-dashboards.md)
> **Parent PRD:** [../bgreen-greenfield-rewrite.md](../bgreen-greenfield-rewrite.md)
> **User stories covered:** PRD §64–70 (PDF reports)

## Sub-slice progress

- **V11.1 (shipped):** Foundation. New `@bgreen/pdf-engine` package ships `PdfRenderer` interface + `HttpPdfRenderer` adapter (POSTs to apps/pdf with `X-Internal-Token`) + `InMemoryPdfRenderer` test double + discriminated `PdfRenderError` (auth | transient | template_not_found | render_failed). `apps/pdf` gains zod-validated `POST /render` route, internal-token auth (rejects requests without `PDF_INTERNAL_TOKEN`); responds 501 with `render_not_implemented` until V11.2 wires templates + Gotenberg. New `reports` module at `apps/api/src/modules/reports/`: `ReportTemplateId` registry, `ReportInstance` domain shape, `InputDataHasher` (pure: canonicalise + SHA-256, 11 tests covering ordering invariance, number serialisation, NaN/Infinity rejection, undefined-drops, Date normalisation, known-hash anchor), Drizzle repository with tenant scope + Inngest-friendly findAnyById. Migration 0020: `report_instances` table (status enum, free-text template_id, period_start/end dates, s3_key, input_data_hash, commentary_json, token + Inngest snapshot) + `organizations.logo_url` + `organizations.brand_primary_color`. `Organization` zod shape updated. apps/api wires `pdfRenderer` (HTTP when configured, InMemory otherwise). 164 tests in apps/api (11 new); full monorepo typecheck green. Boot smoke: apps/pdf 200 on /health, 403 without token, 501 with token.
- **V11.2 (shipped):** Three React templates + Gotenberg integration end-to-end. `apps/pdf` gains `react` + `react-dom` + `@types/react(-dom)` + `react-jsx` in tsconfig. Per-template zod data schemas (`ghgInventoryDataSchema`, `esrsE1DataSchema`, `customDataSchema`) extend a shared base (period + commentary + footer with hash). `ReportLayout` shared cover/footer/commentary block applies brand accent + logo; `brand.ts` defaults to bGreen green when no primary color is set. `ghg-inventory.tsx` (Scope 1/2/3 totals + breakdown tables + intensity), `esrs-e1.tsx` (coverage counts + datapoint status pills), `custom.tsx` (free-form rows + free-text title). Inline CSS embeds A4 print rules + status-pill colors + footer hash. `renderTemplate()` registry validates payload, calls `renderToStaticMarkup`, wraps in self-contained HTML doc with inline CSS — returns `{ ok: true, html }` or typed errors (`template_not_found`, `invalid_payload`). New `gotenberg/client.ts`: `HttpGotenbergClient` POSTs `multipart/form-data` to `/forms/chromium/convert/html` with `files=index.html` + waitTimeout; `InMemoryGotenbergClient` returns a `%PDF-stub-1.4\n` placeholder so `pnpm dev` works without Docker. `POST /render` validates envelope, resolves logo URL from `PDF_LOGO_BASE_URL` + S3 key, renders → Gotenberg → returns `application/pdf` bytes. 7 template tests (ghg + esrs + custom happy paths, brand accent propagation, missing-logo wordmark fallback, unknown template, invalid payload). Boot smoke: `/health` 200, `/render` 403 without token, 200 + application/pdf with valid payload, 400 on unknown/invalid payload.
- **V11.3 (shipped):** ReportService + generateReportCommentary AI tool + Inngest pipeline + email + audit. `generateReportCommentaryTool` (3-6 pt-PT sections; each `title` 5-80 chars, `narrative` 40-800 chars, `callouts` 0-4; system prompt forbids invented numbers and regulatory citations beyond framework name; structure branches by template). `ReportDataBuilder` composes EconomicProfile + SectorBenchmark + Records + CoverageService into a canonical `ReportDataSnapshot` (used both as AI input and as the SHA-256 hash source — hash is stable across reruns even when AI commentary differs). `ReportService.start` builds + hashes + persists pending + fires `report.generation.started` event + writes `report.generate_started` audit. `runGeneration` (called by Inngest): re-builds snapshot, calls AI (failure → `commentary: null`, still ships PDF), renders via `PdfRenderer`, uploads to S3 (`organizations/{orgId}/reports/{reportId}.pdf`), updates row to `ready`, writes `report.generate_completed` audit, sends "Relatório pronto" email (best-effort). PDF / S3 failures fail the row hard + write `report.generate_failed` audit. `downloadUrl` presigns S3 download URL (10-min TTL) + writes `report.downloaded` audit. Tenant isolation: cross-org downloadUrl returns `not_found`. New AuditEntityKind `report_instance`; audit observer + AI metadata propagate it. New `report.generation.started` Inngest function (concurrency 5, retries 2). Routes: `POST /reports` (org admin), `GET /reports`, `GET /reports/:id`, `GET /reports/:id/download` (302 to presigned URL; all org members). `@bgreen/emails` ships `sendReportReadyEmail`. 10 service tests cover start (audit + Inngest + queue_failed), runGeneration (happy, AI failure → commentary null, PDF failure → audit + status=failed, idempotency, context metadata), downloadUrl (presigned, not_ready, tenant isolation). monorepo: 18 typecheck targets clean; 174 tests in apps/api (10 new). Boot smoke: `/reports` routes all mount + 401 without auth.
- **V11.4 (next):** UI — reports list, Gerar CTA, template picker, period selector, coverage warning.

## Goal

Ship the third deployed pillar: `apps/pdf`. Users pick a report template, kick off generation, get an emailed link to a regulator-ready PDF with AI-written commentary, on-brand styling, and a tamper-evidence hash. This is the end of the v1 product surface.

## Acceptance criteria

### Service & infrastructure

- [ ] `apps/pdf` — Hono on Node 22, exposes:
  - `POST /render` — takes `{ template, data, organizationId }`, returns PDF bytes.
  - `/health`.
- [ ] Gotenberg Docker image running in production (separate Fly app or sidecar). EU region.
- [ ] `apps/pdf` is **only reachable from `apps/api`** (internal network or auth header on private route). Not exposed publicly.
- [ ] `PdfRenderer` interface in `packages/ai` or new `packages/pdf-engine`: `render(template: ReportTemplateId, data: ReportData): Promise<Buffer>`. Implementation:
  1. Server-render React Server Component for the chosen template → HTML + inline CSS.
  2. POST HTML to Gotenberg → receive PDF bytes.

### Reports module

- [ ] `Reports` module owns `ReportTemplate` (in-code, like XState graphs in V5) + `ReportInstance` (persisted).
- [ ] Drizzle migration: `report_instances` with `template_id`, `period_start`, `period_end`, `status`, `s3_key`, `input_data_hash`, `generated_at`, `commentary_json`.
- [ ] Three report templates ship in `apps/pdf/templates/`:
  - `ghg-inventory.tsx` — Scope 1/2/3 emissions report.
  - `esrs-e1.tsx` — CSRD ESRS E1 climate disclosure.
  - `custom.tsx` — user-selected datapoints, lighter framing.

### Generation pipeline (Inngest)

- [ ] Inngest event `report.generate` triggers a step pipeline:
  1. Collect data from Records + EconomicProfile + SectorBenchmark + Coverage for the chosen period.
  2. AI tool `generateReportCommentary(input: { framework, profile, records, benchmarks, coverage }) → { sections: Array<{ title, narrative, callouts }> }` — produces year-over-year analysis, trend highlights, recommendations summary. pt-PT.
  3. Render React template to HTML with collected data + commentary embedded.
  4. POST HTML to `apps/pdf` `/render` → Gotenberg → PDF bytes.
  5. Store PDF in S3 EU: `organizations/{orgId}/reports/{reportId}.pdf`.
  6. Compute SHA-256 of the input-data JSON; store with Postgres timestamp on `ReportInstance.input_data_hash`.
  7. Send Resend email "Relatório pronto" with a presigned download link.

### Branding

- [ ] Organization can upload a logo (PNG/SVG) + pick brand primary color in a settings screen.
- [ ] Logo appears on PDF cover + headers; brand color drives accent (titles, callout borders).

### UI

- [ ] Reports page lists past `ReportInstance`s with status (`pending / ready / failed`) and download link.
- [ ] "Gerar relatório PDF" CTA opens:
  - Template picker (GHG / ESRS E1 / custom).
  - Period selector (year / quarter / custom range).
  - For ESRS E1: warning panel surfaced from V10 if coverage is incomplete ("Atenção: 12 datapoints obrigatórios estão em falta — gerar mesmo assim?").
  - Submit → Inngest fires → UI shows "em geração" status.
- [ ] Notification on completion: in-app toast + Resend email.

### Audit & tamper evidence

- [ ] `ReportInstance.input_data_hash` is SHA-256 of canonicalized input JSON. Auditor can verify by re-collecting data and re-hashing.
- [ ] AuditLog rows for: report generation start, completion, regeneration, download.
- [ ] FGA gates: only `admin` (or future `report_generator` role) can trigger generation; all members can download org's reports.

## In scope

- `apps/pdf` service + Gotenberg pipeline.
- Three report templates (GHG, ESRS E1, custom).
- `generateReportCommentary` AI tool.
- Branding (logo + primary color).
- Reports list + generation UI.
- Tamper-evidence hash + AuditLog rows.
- Resend email notification.

## Out of scope

- HTML preview of the rendered report inside the app → defer (Gotenberg generates the canonical PDF; click to download).
- Multi-language report output → pt-PT only in v1.
- Editable commentary (user can't rewrite AI sections inline before generation) → defer; user can regenerate the whole report.
- Snapshot-restore / point-in-time data reproduction beyond the hash → out of scope; hash + AuditLog cover compliance.
- Scheduled report generation → defer.
- Watermarking / signing PDFs cryptographically (PAdES, etc.) → defer; SHA-256 on `ReportInstance` + Postgres timestamp suffice for v1 audit story.

## Module map

| Module | Status | Notes |
|---|---|---|
| Reports | **new** | Owns `ReportTemplate` (in-code), `ReportInstance`. |
| `apps/pdf` | **new app** | Hono wrapper around Gotenberg. |
| `packages/pdf-engine` *(or in `packages/ai`)* | **new or extended** | `PdfRenderer` interface + Gotenberg adapter. |
| Organizations | **extended** | `logo_url`, `brand_primary_color` columns + upload flow. |
| `packages/ai` | **extended** | Registers `generateReportCommentary` tool. |
| `packages/emails` | **extended** | "Relatório pronto" template (React-Email). |
| Audit | **extended** | Captures report lifecycle events. |

## Deep modules introduced

- **`PdfRenderer`** — interface. Implementation tests are integration-flavored (real Gotenberg in compose). Pure unit tests for the React template components (rendering with specific data shapes, no exceptions, expected sections present). Visual snapshot tests deferred to v1.5.
- **`InputDataHasher`** — pure: deterministic canonicalization (sorted keys, fixed number serialization) + SHA-256. Tests: ordering invariance, number serialization, nested objects. ~5 cases.

## Open questions / risks

- **Gotenberg memory at scale:** large reports with charts can blow memory. Mitigation: cap Gotenberg's request body size; Inngest retries with smaller payloads on failure; alert in PostHog if generation latency p95 > 30s.
- **Chart rendering:** React → HTML → PDF means charts need to be server-renderable. Use Recharts SSR or pre-render to inline SVG. Test with the ESRS E1 template specifically.
- **Brand color contrast:** users might pick illegible color combinations. Mitigation: clamp to WCAG-acceptable lightness when used on white backgrounds; show preview swatch in settings.
- **Commentary hallucination:** Claude could invent numbers in the narrative. Mitigation: prompt explicitly forbids invented figures — narrative cites the collected data by ID. v1.5 eval suite verifies. Banner on every report cover: "Comentário gerado por IA com base nos dados submetidos."
- **PDF storage growth:** S3 cost. Acceptable at zero customers; retention policy revisited when paying customers land.

## Deployable artifact

End of vertical (and end of v1): user picks "ESRS E1" + year 2025 → coverage warnings shown → confirms → ~60 seconds later receives email "Relatório pronto" → opens link → downloads a branded PDF with cover, executive-summary AI commentary, datapoint tables sourced from their records, sector-comparison appendix, and a footer noting "Gerado a 2026-MM-DD. Hash de integridade: a1b2c3...". The PDF lives in S3 indefinitely under the org's prefix.

## After v1

v1 closes here. The v1.5 backlog (per parent PRD): eval suites, curated recommendation library, full ESRS catalogue, automated benchmark refresh, monitoring dashboards, feature flags, rate limits, cost budgets, closed-beta rollout.
