# V11 — PDF Reports

> **Status:** Not started
> **Depends on:** [V10 — Framework Coverage Checker](10-framework-coverage.md), [V8 — Scoring + Dashboards](08-scoring-dashboards.md)
> **Parent PRD:** [../bgreen-greenfield-rewrite.md](../bgreen-greenfield-rewrite.md)
> **User stories covered:** PRD §64–70 (PDF reports)

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
