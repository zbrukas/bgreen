# bGreen Greenfield Verticals — Index

Parent PRD: [`../bgreen-greenfield-rewrite.md`](../bgreen-greenfield-rewrite.md)

This folder now tracks only plans that still need an acceptance audit or closeout. Completed verticals live under [`../archived/bgreen/`](../archived/bgreen/).

| # | Plan | Theme | Status |
|---|---|---|---|
| 1 | [01-foundation.md](01-foundation.md) | Repo scaffold, CI, proprietary-server deploy target, dev loop | Needs closeout |
| 2 | [02-identity-organizations.md](02-identity-organizations.md) | WorkOS AuthKit, multi-tenancy | Needs acceptance audit |
| 3 | [03-pt-data-onboarding.md](03-pt-data-onboarding.md) | NIF, VIES, CAE seeds, signup wizard | Needs acceptance audit |
| 4 | [04-form-templates-records.md](04-form-templates-records.md) | RecordTemplate / FormSchema + Records submission | Needs acceptance audit |

## Archived Verticals

| # | Plan | Theme | Status |
|---|---|---|---|
| 5 | [../archived/bgreen/05-workflows-audit-fga.md](../archived/bgreen/05-workflows-audit-fga.md) | XState workflows, AuditLog, row-based authz after WorkOS FGA reversal | Shipped / archived |
| 6 | [../archived/bgreen/06-ai-foundation-ies.md](../archived/bgreen/06-ai-foundation-ies.md) | AnthropicAiClient, Inngest, S3, IES extraction | Shipped / archived |
| 7 | [../archived/bgreen/07-economic-profile-benchmarks.md](../archived/bgreen/07-economic-profile-benchmarks.md) | EconomicProfile, sector benchmarks, size classification | Shipped / archived |
| 8 | [../archived/bgreen/08-scoring-dashboards.md](../archived/bgreen/08-scoring-dashboards.md) | ESG scoring engine + record scores + dashboard | Shipped / archived |
| 9 | [../archived/bgreen/09-recommendations.md](../archived/bgreen/09-recommendations.md) | AI recommendations with feedback loop | Shipped / archived |
| 10 | [../archived/bgreen/10-framework-coverage.md](../archived/bgreen/10-framework-coverage.md) | ESRS / GHG / GRI gap analysis | Shipped / archived |
| 11 | [../archived/bgreen/11-pdf-reports.md](../archived/bgreen/11-pdf-reports.md) | apps/pdf, Gotenberg, AI commentary, S3 archive | Shipped / archived |
| 12 | [../archived/bgreen/12-customer-success-telemetry.md](../archived/bgreen/12-customer-success-telemetry.md) | Internal CS KPIs and health snapshots | Complete / archived |

## Conventions per plan

- **Status / Depends on / User stories** in the header.
- **Acceptance criteria** as a checkbox list — the literal "done" definition.
- **In scope / Out of scope** split — out-of-scope items point at the vertical that owns them.
- **Deep modules** called out with their test surface, since those are the v1 testable cores.
- **Deployable artifact** — the demoable thing at end of vertical.

## How to use

Open one active plan at a time. Load it and the parent PRD if you need a constraint refresher. For V1-V4, treat the next task as an acceptance audit: verify the current code, update checkboxes, and archive each plan only after the evidence is written down.

Do not let later verticals' concerns bleed into earlier ones — that is exactly the trap the bg1 codebase fell into.
