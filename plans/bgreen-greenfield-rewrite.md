# PRD: bGreen Greenfield Rewrite — TypeScript Edition

> **Status:** Draft for PM approval
> **Phase:** 0 (foundation — supersedes [`migration-to-dotnet.md`](./migration-to-dotnet.md))
> **Author:** Heber (with Claude) — design captured via a full grilling session
> **Target repo:** new `bgreen` repo (bg1 frozen as reference)
> **Related:** [PRD #19 — AI-Powered Company Intelligence](https://github.com/NOMAD-Consulting/bg1/issues/19) (Phase 4 content, ported to TS in this rewrite)

## Problem Statement

bGreen (BG1) was forked from `dgav-gesfito` — a Portuguese phytosanitary-inspection product unrelated to ESG. The current Spring Boot 3.2 + Angular 13 codebase carries the architectural weight of three prior projects (SITA, SISA, GESFITO) plus its own bg1 evolution:

- **62 KB `RegistosController.java`**, decorator/annotation soup, six-files-per-feature pattern.
- **`FichasDeCampo`** offline Excel roundtrip — vestigial for ESG.
- **GIS / SIG** (OpenLayers, proj4) — no clear ESG use case yet.
- **Field-level write permission engine** (`@WritePermissionByRole`, `@UserRoleReadAccess`) — overkill for the new product shape.
- **Hibernate Envers** revisions, **HAL `_links`** payloads from Spring Data REST, Portuguese domain identifiers throughout — every one of these inflates the LLM context window required to make a change.

From the developer's perspective:
- "Every small change touches a wide context window. AI-assisted dev is wasteful."
- "Backend rebuilds go through `eclipse-temurin:21-jdk` Docker. Even `compileJava` cold is multi-minute."
- "We already started two competing rewrite tracks (`frontend-v2/` Angular 21 port and `plans/migration-to-dotnet.md`). Neither is the right answer for an AI-efficient ESG SaaS."

From the product perspective:
- The actual product is narrow: **collect ESG data from Portuguese companies → produce AI-driven recommendations → emit PDF reports**. The current codebase has ~80% scaffolding around an ~20% product surface.
- AI is the new core (per PRD #19), and Spring AI + Java is not where the ecosystem momentum lives.

From the customer's perspective (future): bGreen needs to be ready for CSRD compliance pressure on Portuguese mid-caps from 2025/2026, with credible AI-generated commentary, sector benchmarks, and printable regulator-ready PDFs.

**The opportunity:** zero customers, zero data to migrate, two failed rewrite starts to learn from. Maximum freedom, won't reopen.

## Solution

A new `bgreen` repository, TypeScript end-to-end, designed from scratch for AI-pair-programming efficiency and the narrow ESG product shape.

Three deployed services in a single monorepo:
1. **`apps/web`** — Next.js (UI, thin BFF, auth callbacks, server actions for fast reads).
2. **`apps/api`** — Hono on Node (heavy API, AI calls, IES extraction, public API for partners/agents, Inngest event handlers).
3. **`apps/pdf`** — Hono wrapper around Gotenberg (HTML+CSS → PDF, isolated scaling).

Shared `packages/` for DB schema (Drizzle), zod schemas (single source of truth driving validation + OpenAPI + Hono RPC + Anthropic tool definitions), AI client wrappers, WorkOS auth helpers, email templates (React-Email), PT reference data, and the form-builder engine.

The previous form-builder concept (`RecordTemplate → FormSchema → RowSchema → FieldSchema`) is **kept conceptually but rebuilt simpler**: Postgres JSONB columns + zod schemas + a thin editor UI. Companies still define their own ESG forms; the implementation drops the multi-table matrix in favor of a single JSONB-per-schema model with cross-template mapping rules.

Workflows are modeled via **XState** state-machine graphs, defined in TypeScript, persisted as `current_state` + `context` JSONB on each workflow instance. AI agents read XState graphs natively.

AI is **Claude Sonnet 4.x via the official `@anthropic-ai/sdk`**, with strict tool-use JSON contracts. The features specified in PRD #19 (IES PDF extraction, sector benchmarks, recommendations with feedback loop) are ported to TypeScript in this rewrite — same product behavior, new implementation surface.

Authentication is **WorkOS AuthKit** (replaces Auth0); fine-grained authorization is **WorkOS FGA**; audit logging stays in-house in a Postgres `audit_log` table for regulatory paper-trail integrity.

From the developer's perspective:
- "I open a feature folder, the whole vertical slice is right there: schema, route, service, test. No grep across packages."
- "One zod schema drives request validation, OpenAPI emission, RPC type inference, AI tool-use definition, and DB shape inference via Drizzle. I write it once."
- "When Claude writes code, it reads small files with no decorator magic and produces working diffs on the first pass."

From the user's perspective (carried over from PRD #19):
- "I uploaded my IES, confirmed a few fields the AI pre-filled, and now the system knows my business."
- "I see how my margins and turnover compare to peers in my sector."
- "The recommendations I see are about *my* situation, with a clear explanation of why each one applies."
- "I get a regulator-ready PDF with AI commentary embedded — generated in seconds."

## User Stories

### Developer experience (the rewrite's primary surface in v0)

1. As a developer, I want a single `pnpm install && pnpm dev` to bring up Next.js, Hono API, Gotenberg, and Postgres locally, so onboarding takes minutes not hours.
2. As a developer, I want each feature module to live in one folder with `{schema, routes, service, test}` files, so I can load one folder into AI context and make a complete change without grepping the repo.
3. As a developer, I want zod to be the single source of truth for request validation, response shape, OpenAPI emission, RPC type inference, AI tool-use definitions, and Drizzle column types, so contracts never drift.
4. As a developer, I want `pnpm typecheck` to fail when any contract diverges across the three services, so I catch drift before runtime.
5. As a developer, I want `drizzle-kit generate` to produce reviewable SQL migrations, so I never commit a migration I haven't read.
6. As a developer, I want a `CLAUDE.md` per module describing its bounded context, so an AI agent loads only the relevant brief.
7. As a developer, I want a single `Justfile` (or `package.json` scripts) with the same command names on macOS and Windows, so cross-platform parity isn't a config exercise.
8. As a developer, I want Vercel preview deploys per PR for `apps/web` and Fly preview machines for `apps/api`, so reviewers click a link instead of running locally.
9. As a developer, I want Inngest's local dev server bundled into `pnpm dev`, so I can step through job pipelines without deploying.
10. As a developer, I want to swap Anthropic-direct for Bedrock EU later by changing one env var and one adapter file, so the GDPR posture is reversible.

### Authentication and authorization

11. As a new user, I want to sign in via WorkOS AuthKit (social + email magic link), so I don't manage a password.
12. As an organization admin, I want to invite colleagues to my organization and assign them roles, so my team can collaborate on ESG data entry.
13. As a user belonging to multiple organizations, I want to switch organizations from the header, so my session context is unambiguous.
14. As a user, I want my role-based and FGA-based permissions to determine what UI I see and what actions I can perform, so the system prevents me from acting outside my scope.
15. As a regulator-facing operator, I want every authenticated action persisted to an in-house Postgres `audit_log` (not the auth vendor's log), so regulatory paper trail integrity doesn't depend on an external service.

### Organization onboarding (ports Phase 3)

16. As a new user, I want the system to validate my NIF format as I type it, so I get immediate feedback on typos.
17. As a new user, I want the system to pre-fill my company name and address from the EU VIES registry when available, so I type less.
18. As a new user, I want signup to complete even if VIES is down or my NIF isn't in VIES, so external outages never block account creation.
19. As a new user, I want to see a "Verificado via VIES" badge when data came from an official source, so I know which fields I can trust.
20. As a new user, I want to pick my company's CAE from a searchable dropdown, so I don't have to memorize codes.
21. As a new user, I want to pick my legal form from a dropdown, so I don't mistype it.
22. As a new user, I want to self-assess my company size (micro / pequena / média / grande) at signup, so the system can show preliminary recommendations before I upload documents.

### Form builder (`RecordTemplate` → `FormSchema` → row/field, simplified)

23. As an organization admin, I want to define a new `RecordTemplate` (e.g., "Monthly Energy Consumption"), so my team has a structured place to log specific ESG data.
24. As an organization admin, I want each `RecordTemplate` to contain typed fields — number with unit, date, select, **multi-select**, text, file, calculated — **and to compose them via repeating sub-row groups (e.g., "list of meters" with name + reading each) plus conditional show-if rules** (e.g., "show 'gas type' only when 'fuel = gas'"), so the data captured matches the real-world shape of the metric.
25. As an organization admin, I want to set cross-template mapping rules (this month's "closing meter reading" auto-fills next month's "opening meter reading"), so users don't retype known values.
26. As an organization admin, I want to publish or unpublish templates, so users only see active forms.
27. As an organization admin, I want to clone an existing template and modify it, so I can iterate without starting from scratch.
28. As a data filler, I want the system to validate field constraints (numeric ranges, required fields, unit consistency) before allowing submission, so I catch errors early.
29. As a data filler, I want the system to compute derived fields (CO₂e = activity × emission factor) automatically and read-only, so I can't introduce arithmetic errors.

### Records (ESG data submission)

30. As a data filler, I want to submit a new `Record` against a published template, so my organization's ESG data accumulates over time.
31. As a data filler, I want to attach supporting documents (invoices, meter photos) to a record, so the record is auditable.
32. As a data filler, I want to save a record as draft and return to it later, so I don't lose work.
33. As a data filler, I want to see all records I've submitted with their workflow status, so I know what's pending review.
34. As a reviewer, I want to see records submitted within my organization awaiting my review, so I can act on the queue.
35. As a reviewer, I want to approve, request changes, or reject a record with a comment, so the data filler knows why.

### Workflows (XState-driven approval cycles)

36. As an organization admin, I want to choose from pre-defined workflow templates (single-step, two-step review, three-step certify) per `RecordTemplate`, so I can match the rigor to the data type.
37. As a workflow participant, I want my dashboard to show all instances waiting on my action, so I never miss a step.
38. As an auditor, I want to see the full state-transition history for any record (who acted, when, with what comment), so I can reconstruct the approval chain.
39. As an organization admin, I want workflows to be defined in code (XState graphs) initially, so the v1 surface is predictable.

### Economic profile and IES extraction (ports PRD #19)

40. As a user with a confirmed account, I want a dashboard call-to-action to upload my IES and unlock targeted recommendations, so I know why I should.
41. As a user, I want to upload a PDF of my IES (one year at a time) and have the system extract employees, turnover, EBITDA, balance-sheet total, and CAE automatically, so I don't have to retype data.
42. As a user, I want the system to tell me quickly when my uploaded file isn't an IES, so I don't wait through a long process to learn I uploaded the wrong doc.
43. As a user, I want to see which extracted fields the AI is confident about (HIGH) vs unsure about (MEDIUM / LOW), so I know where to focus my review.
44. As a user, I want to edit any extracted field inline before saving, so the final data is what I stand behind.
45. As a user, I want my uploaded IES to be deleted from S3 after extraction completes, so my financial document isn't stored on bGreen's servers.
46. As a user, I want to know my click to upload the document also authorizes AI processing, so consent is explicit.
47. As a user, I want to come back later and upload a second year (e.g., IES-2024) to build a multi-year profile, so trend analysis becomes possible over time.

### Size classification and benchmarking (ports PRD #19)

48. As a user, I want to see the system's proposed SME classification (MICRO/PEQUENA/MÉDIA/GRANDE) with a plain-language rationale, so I understand why.
49. As a user, I want to override the proposed classification if I disagree, so the system respects my judgment.
50. As a user, I want the classification to remain stable once confirmed, so my benchmarks and recommendations are reproducible.
51. As a user, I want to see how my turnover and EBITDA margin compare to sector peers of similar size, so I know where I stand.
52. As a user in a sector where benchmark data isn't available, I want a clear message ("dados setoriais insuficientes") rather than a misleading comparison, so I'm not misled.
53. As a user, I want the benchmark vintage disclosed ("Comparação baseada em dados de 2022"), so I understand the time lag.

### Recommendations (ports PRD #19, generated by Claude tool-use)

54. As a user, I want a "Gerar recomendações" button that produces a targeted list of ecological measures for my company, so I have a starting point for action.
55. As a user, I want each recommendation to show estimated impact, implementation effort, and time horizon, so I can prioritize.
56. As a user, I want a per-recommendation rationale referencing my specific profile and sector peers, so I trust it's not generic.
57. As a user, I want recommendations generated entirely in pt-PT, so the output is usable by me and my team.
58. As a user, I want to see a clear "Recomendações geradas por IA — valide com o seu consultor" banner, so I understand this is AI output.
59. As a user, I want a one-click feedback button per recommendation (útil / já implementada / não aplicável / irrelevante / incorreta), so I can signal which suggestions matter.
60. As a user, I want to regenerate the entire recommendation set if I'm unsatisfied, so I'm not stuck with a bad first draft.
61. As a user, I want previous recommendation sets preserved in history, so I can see how suggestions evolved.
62. As a user without an IES uploaded yet, I want preliminary recommendations based only on my sector and self-reported size, so I get value immediately and have an incentive to upload IES later.
63. As a user, I want recommendations to factor in any environmental Records I've already filled (energy, water, emissions), so the suggestions build on what the system knows.

### PDF reports (the third pillar of the product)

64. As a user, I want a "Gerar relatório PDF" button on my reports page, so I can produce a regulator-ready document.
65. As a user, I want to pick a report template (GHG inventory, CSRD ESRS E1 disclosure, custom) before generation, so the output matches the framework I need.
66. As a user, I want the AI to write commentary paragraphs embedded in the PDF (year-over-year analysis, trend highlights, recommendations), so the report tells a story.
67. As a user, I want my organization's logo and brand colors to appear on the PDF cover and headers, so the output is on-brand.
68. As a user, I want generated PDFs to be archived in my account for re-download, so I don't need to regenerate them.
69. As a user, I want to see when a PDF generation job is in progress vs ready (notification on completion via Resend email), so I don't watch a spinner.
70. As an auditor, I want generated PDFs to include a cryptographic hash + timestamp of the underlying data snapshot, so I can verify a report wasn't tampered with after the fact.

### Regulatory framework coverage (the AI "regulatory checker" feature)

71. As a user preparing a CSRD/ESRS E1 report, I want the system to highlight missing datapoints required by my sector, so I know what to collect before generating.
72. As a user, I want to see which ESRS datapoints I'm covering, which are partial, and which are unfilled, so my completeness is transparent.
73. As a user reporting under GRI, I want the same coverage check against GRI disclosure requirements, so framework switching is supported.
74. As a user, I want the checker output explainable ("E1-6 datapoint X is missing for your sector because your CAE-3 = 35.11 falls in the energy-intensive sectors list"), so I trust the gaps it flags.

### Failure modes (ports PRD #19)

75. As a user, I want manual entry to always be available as an alternative to AI extraction, so I'm never blocked by an AI failure.
76. As a user, I want clear, pt-PT error messages when something goes wrong, so I know what to do next.
77. As a user, I want cross-validation to flag implausible extracted values (e.g., EBITDA margin > 500%) as low-confidence, so obvious errors don't silently make it into my profile.
78. As a user, I want VIES failures to fall back silently to manual entry, so external dependencies never block me.

### Admin and right to erasure

79. As an internal bGreen operator, I want to query which recommendations the AI keeps producing and which users flag as incorrect, so I can curate a recommendation library for v1.5.
80. As a user, I want to delete all AI-derived data about my company on request (right to erasure), so I can exit cleanly.
81. As an organization admin, I want to delete my organization and all data within it, so GDPR right to be forgotten is respected.

### ESG scoring + dashboards (V8)

82. As an organization admin, I want to attach scores to my template field options (e.g., select "Sim" = 10, "Em desenvolvimento" = 5, "Não" = 0), so each submitted record produces a quantifiable ESG score.
83. As an organization admin, I want to weight fields within a template, so material questions count more than ancillary ones toward the final score.
84. As an organization admin, I want to define score buckets (e.g., 0–50 "C", 50–80 "B", 80–100 "A"), so the result reads as a tier instead of a raw number.
85. As a data filler, I want to see my submitted record's score, tier, and per-field contribution breakdown, so I understand what drove the result.
86. As a user, I want a dashboard with the latest score per template and a trend sparkline of the last few entries, so I see progress at a glance.
87. As a user in a sector with available benchmark data, I want my organization's score compared to peers (e.g., "P50: 62 / your: 71"), so I know where I stand.
88. As a user, I want fields hidden by show-if predicates to be excluded from the score, so conditional questions never penalise me.
89. As a user, I want previously-submitted record scores to remain stable even if a published template is later archived and replaced, so historical comparisons are defensible.
90. As a user, I want AI-generated recommendations and PDF reports to surface my lowest-scoring areas, so the rest of the product points me at what to improve.

## Implementation Decisions

### Repository structure

- New repo `bgreen` (bg1 frozen as reference; `frontend-v2/` Angular port and `plans/migration-to-dotnet.md` superseded).
- pnpm workspaces + Turborepo monorepo.
- Three apps: `apps/web` (Next.js), `apps/api` (Hono), `apps/pdf` (Hono + Gotenberg).
- Shared packages: `packages/db`, `packages/types`, `packages/ai`, `packages/auth`, `packages/pt-data`, `packages/form-engine`, `packages/emails`.
- Root `CLAUDE.md` overrides bg1's G-1 (Portuguese-only domain names) to **English for generic concepts, Portuguese for jurisdiction terms only** (`Nif`, `Cae`, `Freguesia`, `NaturezaJuridica` values, `CodigoPostal`).

### Stack lock

| Concern | Pick |
|---|---|
| Frontend | Next.js 15+ (App Router) + React + shadcn/ui + Tailwind |
| Backend API | Hono on Node 22 LTS |
| PDF service | Gotenberg (Docker image) + thin Hono wrapper to compose HTML and call Gotenberg |
| Database | Postgres 16 + Drizzle ORM |
| Auth | WorkOS AuthKit (replaces Auth0) |
| Fine-grained authorization | WorkOS FGA (relationship-based, Zanzibar-style) |
| Audit log | In-house Postgres `audit_log` table (NOT WorkOS) |
| AI client | `@anthropic-ai/sdk` direct (Claude Sonnet 4.x) |
| AI transport | Anthropic direct + signed DPA (Bedrock EU reserved for first enterprise ask) |
| API contract | `@hono/zod-openapi` for OpenAPI emission + Hono RPC for internal type-safe calls |
| Background jobs | Inngest (EU region) |
| File storage | AWS S3 EU (Frankfurt/Ireland) |
| Email | Resend + React-Email |
| Observability | PostHog (errors + logs + product analytics, single vendor) |
| Workflows | XState (state-machine graphs in TS, current state persisted as JSONB) |
| Hosting | Vercel (web) + Fly.io EU (api + pdf) + Neon Postgres EU |
| Local orchestration | Docker Compose for Gotenberg + Postgres; `pnpm dev` for app processes |
| Tests | Vitest unit-only in v1 (Playwright E2E deferred) |
| Lint/format | Biome (single tool replaces ESLint + Prettier) |
| Cross-platform | `.gitattributes` + `.editorconfig` enforce LF defaults; scripts mirrored in bash and PowerShell where needed |

### Module map

Every module is a folder with `domain/ application/ infrastructure/ api/ module.ts CLAUDE.md` shape. Cross-module reads via typed Application Ports (interfaces); no cross-module ORM navigations.

| Module | Owns (domain) | Notes |
|---|---|---|
| **Identity** | `User`, `Role`, WorkOS sync | Thin adapter over WorkOS AuthKit |
| **Organizations** | `Organization`, `OrganizationMembership`, `LegalForm` | Replaces `Entidade` + `AssociacaoEntidade` + `NaturezaJuridica` |
| **EconomicProfile** | `OrganizationEconomicProfile`, `IesExtractionLog` | Per-year economic data + extraction audit; replaces `EntidadePerfilEconomico` |
| **SectorBenchmark** | `SectorAggregate` | BdP/INE seed; keyed `(cae3, dimensao, year, fonte)` |
| **FormTemplates** | `RecordTemplate`, `FormSchema`, `RowSchema`, `FieldSchema`, `TemplateMapping`, `RecordType` | The matrix form-builder, simplified to JSONB |
| **Records** | `Record`, `Execution`, `Aggregator` | Replaces `Registo`, `Execucao`, `Agregador` |
| **Workflows** | `WorkflowDefinition`, `WorkflowInstance` | XState graphs + persisted state |
| **Recommendations** | `GeneratedRecommendation`, `RecommendationFeedback` | Ports `RecomendacaoGerada` + `FeedbackRecomendacao` |
| **Reports** | `ReportTemplate`, `ReportInstance` | PDF generation pipeline + AI commentary embed |
| **Geography** | `Pais`, `CodigoPostal`, `Distrito`, `Concelho`, `Freguesia` | PT seeds, names stay PT (jurisdiction terms) |
| **ReferenceData** | `Cae`, `LegalForm` values | CAE Rev.3 catalogue (~800 rows), legal form enum |
| **Audit** | `AuditLog` | In-house JSONB-payload audit table |

### Deep modules to extract (testable in isolation, simple interface, rarely changes)

These are the modules where TDD pays off and tests are non-negotiable:

- **`NifValidator`** — pure Portuguese mod-11 checksum. Same as PRD #19 spec.
- **`DimensaoClassifier`** — pure EU Recommendation 2003/361/EC arithmetic. Same as PRD #19 spec.
- **`PerfilEconomicoValidator`** — pure cross-validation rules (employees range, turnover non-negative, EBITDA ratio plausibility, year range).
- **`ViesClient`** — REST/SOAP + cache + timeout + graceful-degrade, exposed as `lookup(nif): Promise<ViesResult | null>`.
- **`SectorBenchmarkLookup`** — pure join `(cae3, dimensao, year)` → aggregate row, with "insufficient data" fallback.
- **`FormSchemaInterpreter`** — given a `FormSchema` definition + raw values, returns validated/normalized output or typed errors. Pure.
- **`WorkflowEngine`** — XState wrapper exposing `start(definitionId, context)`, `transition(instanceId, event)`, `currentState(instanceId)`. Persistence injected via port.
- **`AnthropicAiClient`** — typed facade over `@anthropic-ai/sdk` with tool registrations, retry, prompt caching, and pt-PT system-prompt enforcement. Exposes `call<TInput, TOutput>(tool, input)` returning `Result<TOutput, AiError>`.
- **`IesExtractionService`** — composes doc classification + Claude tool-use + `PerfilEconomicoValidator` + writes `IesExtractionLog`. Stateful at the orchestration level, pure at the step level.
- **`RecommendationsService`** — composes prompt build + Claude call + parse + persist. Adapts to FULL / PARTIAL / INCOMPLETE profile completeness.
- **`PdfRenderer`** — interface `render(template: ReportTemplate, data: ReportData): Promise<Buffer>`. Implementation composes React Server Component HTML and calls Gotenberg.
- **`S3Uploader`** — typed wrapper exposing `upload`, `presignedUrl`, `delete`. Hides AWS SDK shape.
- **`PostHogTelemetry`** — typed wrapper for events + errors with org-scoped properties baked in.

### Data model highlights

- All aggregates carry `organization_id` (multi-tenancy). Drizzle global query helper enforces tenant scope by default; admin reads opt out explicitly.
- `RecordTemplate` carries `form_schema` as a single JSONB column (was four tables in bg1). Indexed via GIN where queryable.
- `WorkflowInstance.current_state` is JSONB (XState `StateValue`); `context` is JSONB.
- `GeneratedRecommendation.output` is JSONB (the full structured recommendation array).
- `AuditLog` is one row per change, JSONB payload with old/new field-level deltas + actor + correlation id.
- `pgvector` extension installed but unused in v1 (v1.5 will index recommendations text and report narrative chunks).

### API contract

- `@hono/zod-openapi` decorates each route with its zod request/response schemas.
- Same schemas exported to FE for forms + Hono RPC client type inference.
- Same schemas converted via `zod-to-json-schema` to Anthropic tool-use definitions.
- OpenAPI spec served at `/openapi.json` for partner consumption and codegen.
- Internal calls (`apps/web` → `apps/api`) use Hono RPC client (no codegen, full type inference).
- External / partner calls hit the same routes via standard REST.

### AI plumbing

- All AI calls originate from `apps/api`. API key server-side only, set via Fly secrets.
- `AnthropicAiClient` wraps the SDK with: prompt caching for system + tool definitions, retry with backoff, per-tool input/output types, and a pt-PT system-prompt prefix.
- Tool definitions: `classifyDocument`, `extractEconomicProfile`, `classifyOrganizationSize`, `generateRecommendations`, `generateReportCommentary`, `checkFrameworkCoverage`. Each defined once via zod + registered via `AnthropicAiClient.registerTool(...)`.
- Long-running flows (IES extraction = 15–30s) run inside Inngest step functions: classify → extract → validate → persist → notify. Each step independently retryable.
- GDPR: Anthropic direct + signed DPA + click-through consent on IES upload. Bedrock EU adapter scaffolded but disabled (one env var to flip).

### Workflow engine

- Workflow definitions are XState `setup({ types, actions }).createMachine({...})` graphs co-located with their module (Records workflows in `modules/records/workflows/`, Reports workflows in `modules/reports/workflows/`).
- `WorkflowEngine` persists `WorkflowInstance.{current_state, context}` after each transition. State snapshots written to `AuditLog`.
- v1 ships 2–3 hardcoded workflow shapes (single-step submit, two-step review, three-step certify). DB-driven custom workflows deferred.

### Permissions

- WorkOS AuthKit handles login + session. JWT validated by Hono middleware on every API request.
- WorkOS FGA stores relationships: `user:alice belongs_to organization:acme as reviewer`. Authorization checks query FGA: "can user:alice review record:42?" Cached per request.
- Org-scope enforced via Drizzle query helper on every aggregate query.
- No field-level write permissions in v1 (overkill; revisit only if a specific customer ask).

### Audit

- `AuditLog` table: `id, occurred_at, actor_user_id, organization_id, entity_kind, entity_id, action, payload (JSONB)`.
- Drizzle interceptor writes audit rows on insert/update/delete for entities marked `IAuditable` (a const list, not a decorator).
- Read API: `GET /audit?entityKind=record&entityId=42` returns the time-ordered change log.
- Retention: indefinite in v1 (regulatory data); GDPR right-to-erasure tombstones the actor reference but keeps the change row.

### PDF generation pipeline

- User clicks "Gerar relatório PDF" → Inngest event fired.
- Step 1: collect data from Records + EconomicProfile + Benchmarks for the selected period.
- Step 2: call Claude `generateReportCommentary` with collected data → structured JSON commentary blocks.
- Step 3: server-render React component (`apps/pdf/templates/<framework>.tsx`) to HTML.
- Step 4: POST HTML to Gotenberg → receive PDF bytes.
- Step 5: store PDF in S3 EU under `organizations/{orgId}/reports/{reportId}.pdf`.
- Step 6: Resend email notifies user "Relatório pronto."
- Cryptographic hash of the input-data JSON + Postgres timestamp stored on `ReportInstance` for tamper-evidence.

### Greenfield operational scope

Mirroring PRD #19's posture:

- **Deferred until users exist:** feature flags, kill-switch env vars, formal eval suite, extensive resilience (circuit breaker *on Anthropic itself*), rate limiting, cost budgets, monitoring dashboards, phased rollout, closed beta.
- **Kept in v1 (correctness, not ops):** cross-validation rules, doc-classification pre-check, manual-entry fallback path, standard HTTP timeout defaults, in-house audit log, tenant scope enforcement.
- **Rationale:** operational machinery is justified *by users*. Build it when they arrive.

### Migration from bg1

**None.** bg1 stays operational and untouched; this is a parallel greenfield build. No data migration, no API compatibility layer, no shared library. `nomad-base` is not pulled in; useful patterns get ported per-module as we go.

## Testing Decisions

Good tests check external behavior, not implementation details. Greenfield, no customers → we lean on **Vitest unit tests for deep pure modules** and **defer integration + E2E to v1.5** when shape stabilizes and customer pain motivates coverage.

What is tested in v1:
- **`NifValidator`** — valid NIFs, invalid checksums, wrong length, non-numeric input. ~10 cases.
- **`DimensaoClassifier`** — each SME band boundary (249 vs 250 employees; €49.9M vs €50.1M turnover); group rollup; missing-input cases. ~15 cases.
- **`PerfilEconomicoValidator`** — each rule (out-of-range employees, negative turnover, implausible EBITDA ratio, future year). Confirms LOW-confidence override. ~10 cases.
- **`SectorBenchmarkLookup`** — happy path join; missing-row → "insufficient data" path; year-fallback behavior.
- **`FormSchemaInterpreter`** — required-field enforcement, type coercion (string→number with unit), derived-field arithmetic, validation error shape.
- **`WorkflowEngine`** — for each pre-defined XState graph, exhaustive state/event coverage that the graph accepts/rejects events as expected.
- **`ViesClient`** — one happy-path test with stubbed HTTP response. Full resilience tests (circuit breaker trip, cache TTL) deferred.

What is **deferred** in v1:
- **`AnthropicAiClient`, `IesExtractionService`, `RecommendationsService`** — tests require an eval suite (5–10 real IES PDFs + ground-truth JSON), which is v1.5 work.
- **`PdfRenderer`** — visual diff snapshot testing is high-effort; defer until report templates stabilize.
- **End-to-end (Playwright)** — deferred. Single-developer velocity wins until UI churn slows.
- **Integration tests with Testcontainers Postgres** — deferred. Drizzle's type guarantees + Vitest unit coverage of the deep modules carry v1.

Prior art: PRD #19 already established this testing posture for the same modules in Spring; pattern carries over verbatim into Vitest. The deep-modules-first discipline is the testable surface; AI behavior testing waits for the eval suite.

## Out of Scope

Explicitly **not** in v1 of `bgreen`:

- **Data migration from bg1.** bg1 stays parallel. Greenfield assumption is firm.
- **Backwards compatibility with bg1's REST surface.** New OpenAPI, new clients. No HAL `_links`, no Spring Data REST projections.
- **GIS / SIG / maps.** Facility records carry optional `lat`/`lng` columns; no map UI. OpenLayers, proj4, custom projections not ported.
- **FichasDeCampo (Excel offline roundtrip).** Vestigial from gesfito; not relevant for ESG. PWA offline capture can be revisited if real demand surfaces.
- **Field-level write permissions.** Org-scope + role + FGA relationships suffice; no per-field allow/deny rules.
- **Conversational AI advisor (chatbot).** PRD #19 explicitly excludes; same here. Form-based UX preferred for compliance product.
- **XML IES ingestion.** PDF only in v1 (same as PRD #19).
- **OCR on scanned image PDFs.** Hard-rejected; users upload digital PDFs (same as PRD #19).
- **Paid company-data registry integrations** (Racius, Informa D&B, Iberinform). Deferred (same as PRD #19).
- **Multi-CAE / secondary sector handling.** Single primary CAE in v1.
- **Weighted sector splits in benchmarking.**
- **Automated ETL from BdP Quadros do Setor / INE.** Static seed only in v1.
- **Regulatory citations in recommendations.** Hallucination risk too high without verified reference library (v1.5 work).
- **Curated recommendation library.** v1.5; v1 ships pure-AI generation + feedback capture.
- **Bedrock EU adapter.** Scaffolded but not enabled. First enterprise customer ask flips the env var.
- **Real-time collaboration on the form-builder UI.** Single-editor sessions in v1.
- **Multi-language UI.** pt-PT only in v1; i18n scaffolding via `next-intl` is in place for future en-US bundle.
- **Mobile native app.** Web responsive only.
- **Playwright E2E suite, formal AI eval suite, monitoring dashboards, rate limiting, cost budgets, phased rollout, closed beta** — all deferred until real users justify the ops machinery.
- **Backfill / replay of any bg1 data.** None.

## Further Notes

### Sequencing proposal

v1 ships in vertical-slice phases. Each phase ends with a working deploy:

1. **Foundation** — repo scaffold (Turborepo + pnpm + Biome + tsconfig), `apps/web` + `apps/api` skeleton, Drizzle schema baseline, Vercel + Fly + Neon wired up, CI green.
2. **Identity + Organizations** — WorkOS AuthKit integrated, sign-in working, `Organization` + `OrganizationMembership` aggregates, org switcher.
3. **PT reference data + onboarding** — `packages/pt-data` seeds, NIF validator, VIES client, CAE picker, signup wizard (Phase 3 port).
4. **Deep modules + FormTemplates** — `FormSchemaInterpreter`, `WorkflowEngine`, basic template editor, Records submission, default workflow shape.
5. **Audit + FGA** — `AuditLog` writes on entity changes, WorkOS FGA relationships seeded, authorization middleware live.
6. **AI groundwork** — `AnthropicAiClient`, Inngest setup, S3 upload pipeline, `IesExtractionService` end-to-end (per PRD #19).
7. **EconomicProfile + SectorBenchmark** — schemas, IES extraction UI, size classification flow (per PRD #19).
8. **Scoring + dashboards** — FormSchema gains scoring metadata (per-option scores, field weights, template-level buckets), `ScoringEngine` computes per-record score on submit, `/dashboard` surfaces trend + tier + peer-rank. Feeds V9 and V11.
9. **Recommendations** — generation service, feedback capture, history (per PRD #19); prompt builder reads scores from V8.
10. **Framework coverage checker** — ESRS / GHG / GRI datapoint maps seeded, AI-explained gap analysis.
11. **PDF reports** — `apps/pdf` service, Gotenberg, report templates (GHG + ESRS E1 + custom), AI commentary embed, scoring section, S3 archive, email notification.

Each phase independently deployable. Phases 1–5 are infrastructure; phases 6–11 are the ESG product surface.

### Hard blockers (carried from PRD #19, still apply)

1. **Anthropic API account + production key**, est. €100–€500/month at low dev volume. Server-side via Fly secret.
2. **Anthropic DPA signed** (PRD #19 hard blocker, still applies).
3. **Privacy policy + click-through consent** drafted by legal/PM in pt-PT.

### Soft blockers (carried from PRD #19)

4. **Sample IES PDFs** with owner permission (2–3 to start).
5. **BdP Quadros do Setor + INE seed data** for `SectorAggregate` (~80 rows).
6. **Official CAE Rev.3 reference data** download from INE.

### Decisions superseding existing artifacts

- **`plans/migration-to-dotnet.md`** — superseded by this document. .NET 9 + Vue 3 + Postgres + QuestPDF is replaced by Next.js + Hono + Postgres + Gotenberg in TypeScript.
- **`frontend-v2/`** (Angular 21 port) — abandoned. Sunk cost; Angular is not the AI-efficient choice. Domain knowledge from the port (form layouts, screen flows) ports forward into Next.js + React.
- **`plans/frontend-v2-angular21.md`** — stale; archive.
- **`plans/auth0-authentication.md`** — partially superseded; auth flow concepts port to WorkOS AuthKit but the Auth0-specific bits are dropped.
- **`plans/flyway-migrations.md`** — superseded; Drizzle migrations replace Flyway.
- **`plans/phase3-company-onboarding.md`** — kept as conceptual reference for the signup wizard; reimplementation lives in `bgreen` repo.
- **PRD #19 (AI Phase 4)** — **kept as authoritative for AI feature behavior**. This rewrite ports its content to TypeScript: entity names translate to English where generic (`OrganizationEconomicProfile` instead of `EntidadePerfilEconomico`), implementation switches from Spring AI / Java to `@anthropic-ai/sdk` / TypeScript, but every product decision (size classification arithmetic, feedback enum, FULL/PARTIAL/INCOMPLETE prompt modes, cross-validation thresholds, v1.5 curated library path) carries over verbatim.

### Naming policy

**English** for everything generic in domain/code/DB:
- `Organization`, `Record`, `RecordTemplate`, `FormSchema`, `RowSchema`, `FieldSchema`, `FieldType`, `FieldProperties`, `User`, `Role`, `OrganizationMembership`, `Workflow`, `Execution`, `Aggregator`, `LegalForm`, `Attachment`, `Notification`, `Report`, `OrganizationEconomicProfile`, `SectorAggregate`, `GeneratedRecommendation`, `RecommendationFeedback`, `IesExtractionLog`, `Cae`.

**Portuguese** for jurisdiction-specific concepts (precision lost if translated):
- `Nif` (PT tax ID)
- `Cae` (PT industry classification, NACE-derived) — the table/column name stays `cae`, the entity is `Cae`
- `NaturezaJuridica` values (the type itself = `LegalForm`, enumerated values stay PT)
- `Concelho`, `Freguesia`, `Distrito`, `CodigoPostal` (PT admin divisions)

**UI copy** stays pt-PT. `next-intl` loads `pt-PT.json` by default; `en-US.json` scaffolded for future.

### Why now

- Zero customers. Maximum freedom, won't reopen.
- Two prior rewrite tracks (`frontend-v2/` Angular port, `migration-to-dotnet.md` .NET plan) gave us decision data without sunk-cost lock-in.
- AI-pair-programming is now the dominant development mode; the stack must be optimized for small context windows, end-to-end types, and zero magic.
- CSRD compliance pressure on Portuguese mid-caps from 2025/2026 sets a real-world calendar for "v1 must work by then."

### Risk posture

The biggest v1 risks:
- **IES extraction accuracy** on real-world contabilista-generated PDFs (carried from PRD #19). Mitigated by doc-classification pre-check, deterministic cross-validation, per-field confidence UI, and manual-entry fallback. An eval suite is the v1.5 insurance policy.
- **WorkOS FGA learning curve.** Relationship-based authorization is unfamiliar to most TS developers. Mitigated by keeping the FGA model narrow in v1 (org-scope + role only; no nested relationships) and growing only on customer demand.
- **Three-service operational overhead** (web + api + pdf). Mitigated by Inngest absorbing async coordination, Gotenberg being a stateless Docker container, and each service having an independently runnable `pnpm dev` mode.

### Decision provenance

Full grilling-session decision tree (24 locked questions across scope, stack, infra, and meta) preserved in the conversation that produced this PRD. Each decision recorded with its rationale; reversal cost noted where high. Rationale available on request.
