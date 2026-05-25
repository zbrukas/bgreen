# bGreen Greenfield Verticals — Index

Parent PRD: [`../bgreen-greenfield-rewrite.md`](../bgreen-greenfield-rewrite.md)

Twelve vertical slices. Each independently deployable. Each loadable as a single AI context. Verticals run sequentially — later verticals assume earlier ones live.

| # | Plan | Theme | Status |
|---|---|---|---|
| 1 | [01-foundation.md](01-foundation.md) | Repo scaffold, CI, deploy targets, dev loop | Not started |
| 2 | [02-identity-organizations.md](02-identity-organizations.md) | WorkOS AuthKit, multi-tenancy | Not started |
| 3 | [03-pt-data-onboarding.md](03-pt-data-onboarding.md) | NIF, VIES, CAE seeds, signup wizard | Not started |
| 4 | [04-form-templates-records.md](04-form-templates-records.md) | RecordTemplate / FormSchema + Records submission | Not started |
| 5 | [05-workflows-audit-fga.md](05-workflows-audit-fga.md) | XState workflows, AuditLog, ~~WorkOS FGA~~ row-based authz | Shipped (FGA reversed in V5.8) |
| 6 | [06-ai-foundation-ies.md](06-ai-foundation-ies.md) | AnthropicAiClient, Inngest, S3, IES extraction | Not started |
| 7 | [07-economic-profile-benchmarks.md](07-economic-profile-benchmarks.md) | EconomicProfile, sector benchmarks, size classification | Not started |
| 8 | [08-scoring-dashboards.md](08-scoring-dashboards.md) | ESG scoring engine + record scores + dashboard | Not started |
| 9 | [09-recommendations.md](09-recommendations.md) | AI recommendations with feedback loop | Shipped |
| 10 | [10-framework-coverage.md](10-framework-coverage.md) | ESRS / GHG / GRI gap analysis | Shipped |
| 11 | [11-pdf-reports.md](11-pdf-reports.md) | apps/pdf, Gotenberg, AI commentary, S3 archive | Not started |
| 12 | [12-customer-success-telemetry.md](12-customer-success-telemetry.md) | Internal CS KPIs: required-template coverage, health-score view, workflow stagnation, daily snapshots | Not started |

## Conventions per plan

- **Status / Depends on / User stories** in the header.
- **Acceptance criteria** as a checkbox list — the literal "done" definition.
- **In scope / Out of scope** split — out-of-scope items point at the vertical that owns them.
- **Deep modules** called out with their test surface, since those are the v1 testable cores.
- **Deployable artifact** — the demoable thing at end of vertical.

## How to use

Open one plan at a time. Load it (and the parent PRD if you need a constraint refresher) into AI context. Ship the vertical. Tick acceptance criteria. Move to the next.

Do not let later verticals' concerns bleed into earlier ones — that is exactly the trap the bg1 codebase fell into.
