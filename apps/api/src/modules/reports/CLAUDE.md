# modules/reports

Bounded context: V11 PDF report lifecycle. Reads data from Records +
EconomicProfile + SectorBenchmark + FrameworkCoverage, asks Claude
for narrative commentary, calls apps/pdf to render the React template,
uploads PDF to S3, emails the user.

## Owns
- `ReportInstance` aggregate (one row per generation run).
- `ReportTemplateId` registry (in-code; ghg-inventory | esrs-e1 |
  custom) per V11 plan §criteria.
- `InputDataHasher` — pure: canonicalise input JSON, SHA-256.
- `ReportService` — orchestration over ProfileGatherer + AI +
  PdfRenderer + S3 + email + AuditLog (V11.3).
- `/reports` routes (V11.3).

## Does NOT own
- PDF rendering / Gotenberg. Lives in `apps/pdf`.
- React templates. Live in `apps/pdf/templates/`.
- AI transport. Lives in `@bgreen/ai`.
- S3 / email transport. Live in `@bgreen/storage` + `@bgreen/emails`.

## Scope this vertical (V11.1)
- Drizzle schema lives in `@bgreen/db`.
- `InputDataHasher` ships here with tests.
- Domain types + repository shell.
- No service / routes yet — V11.3 lands those.
