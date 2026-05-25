// Inline CSS for all three templates. Embedded in the rendered HTML
// document so Gotenberg's Chromium-driven renderer can pick it up
// without external stylesheet fetches.
//
// Print-oriented: A4 page, conservative type, status pills + table
// rules. Targets Chromium since that's what Gotenberg drives.

export const TEMPLATE_CSS = `
@page {
  size: A4;
  margin: 18mm 16mm;
}
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
