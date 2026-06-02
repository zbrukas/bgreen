// Inline CSS for the report templates. Embedded in the rendered HTML
// document so Gotenberg's Chromium renderer picks it up without
// external stylesheet fetches.
//
// `buildTemplateCss({orientation})` assembles the document CSS. The
// page box is the only orientation-dependent part; everything else is
// shared. `TEMPLATE_CSS` is the portrait default kept byte-identical to
// the pre-deck output so the three existing templates and their
// snapshot assertions are unaffected.

import { FONT_FACE_CSS } from "./shared/fonts.js";

export type PageOrientation = "portrait" | "landscape";

function pageRule(orientation: PageOrientation): string {
  // Portrait keeps the original A4 + 18/16mm margins. Landscape "deck"
  // pages are full-bleed (margin 0); content padding is applied inside
  // each .deck-page instead.
  return orientation === "landscape"
    ? "@page { size: A4 landscape; margin: 0; }"
    : "@page {\n  size: A4;\n  margin: 18mm 16mm;\n}";
}

// Base CSS shared by every template (portrait report bodies). Unchanged
// from the original TEMPLATE_CSS apart from the extracted @page rule.
const BASE_CSS = `
html, body {
  margin: 0;
  padding: 0;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 11pt;
  color: #1f2937;
  background: #ffffff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.report {
  display: flex;
  flex-direction: column;
  gap: 24pt;
}
.cover {
  border-top: 6pt solid #0f6f3e;
  padding-top: 16pt;
}
.cover-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 24pt;
}
.logo {
  max-height: 36pt;
  max-width: 140pt;
}
.logo-fallback {
  font-weight: 700;
  font-size: 14pt;
  color: #6b7280;
  letter-spacing: 0.05em;
}
.title {
  font-size: 22pt;
  font-weight: 700;
  margin: 0 0 6pt 0;
}
.org {
  font-size: 13pt;
  font-weight: 600;
  margin: 0 0 4pt 0;
}
.period {
  margin: 0 0 14pt 0;
  color: #4b5563;
}
.ai-disclosure {
  margin: 0;
  padding: 8pt 12pt;
  background: #eff6ff;
  border-left: 3pt solid #2563eb;
  color: #1e3a8a;
  font-size: 9.5pt;
}
.commentary h2 {
  font-size: 14pt;
  margin: 0 0 10pt 0;
}
.commentary-section {
  margin: 0 0 14pt 0;
  break-inside: avoid;
}
.commentary-section h3 {
  font-size: 11.5pt;
  margin: 0 0 4pt 0;
}
.commentary-section p {
  margin: 0 0 6pt 0;
}
.callouts {
  list-style: none;
  padding: 6pt 10pt;
  margin: 6pt 0 0 0;
  border-left: 3pt solid #0f6f3e;
  background: #f8fafc;
}
.callouts li {
  margin: 0 0 4pt 0;
}
.content section {
  break-inside: avoid-page;
}
.scope, .intensity, .coverage-summary, .datapoints, .custom-rows {
  margin: 0 0 16pt 0;
}
.scope h3, .intensity h3, .coverage-summary h3, .datapoints h3 {
  font-size: 12.5pt;
  margin: 0 0 6pt 0;
}
.scope-total {
  margin: 0 0 6pt 0;
  font-size: 11pt;
}
.scope-total.muted {
  color: #6b7280;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10pt;
}
th, td {
  padding: 5pt 6pt;
  border-bottom: 0.5pt solid #e5e7eb;
  text-align: left;
  vertical-align: top;
}
th {
  background: #f3f4f6;
  font-weight: 600;
}
td.num, th.num { text-align: right; }
td.mono { font-family: "Menlo", "Consolas", monospace; font-size: 9.5pt; }
.muted { color: #6b7280; }
.coverage-counts {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  gap: 24pt;
}
.status-pill {
  display: inline-block;
  padding: 2pt 8pt;
  border-radius: 10pt;
  font-size: 9pt;
  font-weight: 600;
}
.intensity ul {
  margin: 0;
  padding: 0 0 0 16pt;
}
.report-footer {
  margin-top: 24pt;
  padding-top: 8pt;
  border-top: 0.5pt solid #d1d5db;
  font-size: 8.5pt;
  color: #6b7280;
}
.report-footer code {
  font-size: 8pt;
  word-break: break-all;
}
`;

// Rich table (deck): merged header band, zebra, total/subtotal rows.
// Dynamic colors are inline (theme-driven); structural rules here.
const RICH_TABLE_CSS = `
.rich-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
.rich-table caption.rich-table-caption {
  caption-side: top; text-align: left; font-size: 10pt; font-weight: 600; margin-bottom: 4pt;
}
.rich-table th { padding: 5pt 7pt; text-align: left; font-weight: 600; }
.rich-table td { padding: 4pt 7pt; border-bottom: 0.5pt solid #e5e7eb; vertical-align: top; }
.rich-table th.num, .rich-table td.num { text-align: right; }
.rich-table th.center, .rich-table td.center { text-align: center; }
.rich-table td.mono { font-family: "Menlo", "Consolas", monospace; }
.rich-table-group-row th {
  text-align: center; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.03em;
  border-right: 1pt solid rgba(255,255,255,0.25);
}
.rich-table-subtotal td { font-weight: 600; }
.rich-table-total td { border-top: 1pt solid #cbd2d9; }
.rich-table tr { break-inside: avoid; }
`;

// SVG chart primitives + legend.
const CHART_CSS = `
.chart { display: block; width: 100%; height: auto; }
.chart text { font-family: inherit; }
.chart-donut-center-primary { font-size: 26px; font-weight: 800; fill: #111827; }
.chart-donut-center-secondary { font-size: 12px; fill: #6b7280; }
.chart-donut-slice-label { font-size: 11px; font-weight: 700; fill: #ffffff; }
.chart-axis-label { font-size: 10px; fill: #6b7280; }
.chart-axis-unit { font-size: 9px; fill: #9aa3ad; }
.chart-gridline { stroke: #eceef1; stroke-width: 1; }
.chart-axis { stroke: #cbd2d9; stroke-width: 1; }
.chart-legend { list-style: none; margin: 8pt 0 0 0; padding: 0; display: grid; gap: 3pt 12pt; width: 100%; }
.chart-legend-item { display: flex; align-items: center; gap: 6pt; font-size: 9.5pt; }
.chart-legend-swatch { width: 9pt; height: 9pt; border-radius: 2pt; flex: 0 0 auto; }
.chart-legend-label { flex: 1 1 auto; color: #374151; }
.chart-legend-value { font-weight: 600; color: #111827; }
.kpi-card {
  flex: 1 1 0; min-width: 120pt; border-top: 3pt solid #cccccc;
  background: #f8fafc; padding: 10pt 12pt; display: flex; flex-direction: column; gap: 3pt;
}
.kpi-card-hero { border-top: none; }
.kpi-card-hero .kpi-label, .kpi-card-hero .kpi-value, .kpi-card-hero .kpi-unit { color: #ffffff; }
.kpi-label { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; }
.kpi-value { font-size: 19pt; font-weight: 800; color: #111827; line-height: 1.05; }
.kpi-unit { font-size: 10pt; font-weight: 600; }
.kpi-delta { font-size: 9pt; font-weight: 600; }
.kpi-delta-up { color: #b91c1c; }
.kpi-delta-down { color: #15803d; }
.kpi-delta-flat { color: #6b7280; }
`;

// Landscape "deck" pages.
const DECK_CSS = `
.report.deck { display: block; gap: 0; }
.deck-page {
  box-sizing: border-box; width: 100%; height: 100vh; overflow: hidden;
  position: relative; background: #ffffff;
}
.deck-page + .deck-page { break-before: page; }

.deck-cover { color: #ffffff; }
.deck-cover-body {
  box-sizing: border-box; height: 100%; padding: 18mm 22mm;
  display: flex; flex-direction: column; justify-content: center;
}
.deck-cover-logo { max-height: 60pt; max-width: 220pt; margin-bottom: 22pt; }
.deck-cover-logo-fallback { font-size: 26pt; font-weight: 800; color: #ffffff; margin-bottom: 22pt; }
.deck-cover-title { font-size: 34pt; font-weight: 800; line-height: 1.1; margin: 0 0 10pt 0; max-width: 72%; color: #ffffff; }
.deck-cover-org { font-size: 16pt; font-weight: 600; margin: 0 0 4pt 0; color: rgba(255,255,255,0.94); }
.deck-cover-subtitle { font-size: 13pt; margin: 0 0 14pt 0; color: rgba(255,255,255,0.85); }
.deck-cover-period { font-size: 12pt; color: rgba(255,255,255,0.82); }

.deck-divider { color: #ffffff; }
.deck-divider-body { height: 100%; display: flex; align-items: center; gap: 28pt; padding: 0 22mm; }
.deck-divider-index {
  display: flex; align-items: center; justify-content: center;
  width: 84pt; height: 84pt; border-radius: 50%; background: #ffffff;
  font-size: 34pt; font-weight: 800; flex: 0 0 auto;
}
.deck-divider-title {
  font-size: 32pt; font-weight: 300; letter-spacing: 0.02em; margin: 0;
  color: #ffffff; text-transform: uppercase;
}

.deck-content { display: flex; flex-direction: column; }
.deck-content-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12mm 16mm 0 16mm; flex: 0 0 auto;
}
.deck-content-title { font-size: 20pt; font-weight: 700; margin: 0; }
.deck-content-logo { max-height: 28pt; max-width: 120pt; }
.deck-content-body { flex: 1 1 auto; padding: 10pt 16mm 0 16mm; overflow: hidden; }
.deck-footer {
  flex: 0 0 auto; display: flex; justify-content: space-between;
  padding: 6pt 16mm; font-size: 8pt; color: #9aa3ad; border-top: 0.5pt solid #e5e7eb;
}
.deck-footer code { font-size: 8pt; }

.cf-summary { display: flex; gap: 28pt; height: 100%; }
.cf-summary-chart { flex: 0 0 42%; display: flex; flex-direction: column; align-items: center; }
.cf-summary-chart .chart-donut { max-width: 280pt; }
.cf-summary-side { flex: 1 1 auto; display: flex; flex-direction: column; gap: 12pt; }
.kpi-row { display: flex; gap: 10pt; flex-wrap: wrap; }
.cf-intensity { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2pt; }
.cf-intensity li { display: flex; justify-content: space-between; font-size: 10pt; border-bottom: 0.5pt solid #eef0f2; padding: 3pt 0; }
.cf-intensity-label { color: #4b5563; }
.cf-highlights { list-style: disc; margin: 4pt 0 0 0; padding: 8pt 10pt 8pt 24pt; background: #f8fafc; border-left: 3pt solid #0f6f3e; font-size: 10pt; }
.cf-highlights li { margin-bottom: 4pt; }

.cf-charts-row { display: flex; gap: 24pt; height: 100%; align-items: flex-start; }
.cf-chart-block { flex: 1 1 0; display: flex; flex-direction: column; align-items: center; }
.cf-chart-block-wide { flex: 1.4 1 0; }
.cf-chart-title { font-size: 12pt; font-weight: 700; margin: 0 0 6pt 0; align-self: flex-start; }
.cf-chart-block .chart-donut { max-width: 240pt; }
.cf-chart-block .chart-bars, .cf-chart-block .chart-area { max-height: 300pt; }

.cf-notes { font-size: 9.5pt; color: #374151; margin: 10pt 0 0 0; padding-left: 18pt; }
.cf-notes li { margin-bottom: 3pt; }
`;

export function buildTemplateCss(opts?: { orientation?: PageOrientation }): string {
  const orientation = opts?.orientation ?? "portrait";
  return [
    pageRule(orientation),
    FONT_FACE_CSS,
    BASE_CSS,
    RICH_TABLE_CSS,
    CHART_CSS,
    DECK_CSS,
  ].join("\n");
}

// Back-compat: existing callers import the portrait default constant.
export const TEMPLATE_CSS = buildTemplateCss();
