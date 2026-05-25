# DB Performance Audit — bGreen

> **Status:** Not started.
> **Scope:** SQL/Drizzle perf only — not a feature vertical. Tracks index gaps, query shape problems, and round-trip waste found in the current `apps/api` repositories and `packages/db` schema.
> **Parent PRD:** [../bgreen-greenfield-rewrite.md](../bgreen-greenfield-rewrite.md)
> **Source:** Audit performed 2026-05-25.

Each task below is a checkbox. Tackle HIGH before MEDIUM before LOW. Most fixes are small (one migration + repo edit). Group HIGH-1, HIGH-2, HIGH-4 into a single migration if shipping together.

## HIGH — will hurt as soon as records grow past trivial counts

- [x] **H1. Add indexes to `records`.** Shipped in migration 0021. `records_org_created_idx (organization_id, created_at DESC)` + `records_template_idx (template_id)` + partial `records_submitter_idx (submitted_by_user_id) WHERE NOT NULL` (partial — most rows are pre-submit and have null here).

- [x] **H2. Make `workflow_instances.current_state` btree-indexable.** Shipped in migration 0021 — picked **option 1** (replace JSONB with text). All v1 graphs are flat, every reader already guards `typeof === "string"`, and the V5.2 backfill stored scalar strings. `ALTER COLUMN ... USING current_state #>> '{}'` + new `workflow_instances_current_state_idx`. Dropped the `::text` cast in both `workflow-repository.listByState` and `record-repository.findLatestSubmitted`.

- [x] **H3. Push `listPendingForActor` filtering into SQL.** Shipped — denormalized `submitter_user_id uuid` column on `workflow_instances`, backfilled from `context->>'submitterUserId'`, composite index `workflow_instances_org_submitter_idx (organization_id, submitter_user_id)`. Repository writes set the column from `WorkflowContext.submitterUserId` on every insert/update. `WorkflowService.listPendingForActor` now delegates directly to a SQL-side `repo.listPendingForActor()`.

- [x] **H4. Index `organization_memberships.organizationId`.** Shipped — `org_memb_org_idx (organization_id)`.

- [x] **H5. Batch template lookup in dashboard score grouping.** Shipped — added `RecordTemplateRepository.findByIds(ids)` (inArray), replaced the per-id loop in `RecordService.listScoresGroupedByTemplate` with one round-trip + a `Map` lookup.

## MEDIUM — extra round trips or known-small tables today

- [x] **M1. Replace write-then-reselect with `.returning()`.** Shipped. `record-repository`'s `updateValues` and `recordReview` now use `.returning()` plus a tiny indexed lookup on `workflow_instances(entity_kind, entity_id)` instead of the full `recordsWithStatus()` LEFT JOIN. `economic-profile-repository.setDimensao` returns the updated row directly. Net: small dedicated lookups replace a wide JSONB-pulling join per write.

- [x] **M2. Narrow projection on `recordsWithStatus()`.** Shipped. Added `RecordSummary` in `@bgreen/types` (zod `RecordSchema.omit({ values, scoreBreakdown })`), plus `recordSummariesWithStatus()` + `rowToSummary()` in the repo. `listForOrganization` / `listForUserInOrg` now return `RecordSummary[]`. Wide `Record` stays for `findById`, `findAnyById`, `findLatestSubmitted`. Audit of consumers (coverage-service, profile-gatherer, report-data-builder, record-service.listScoresGroupedByTemplate, web list view) confirmed none read `values` or `scoreBreakdown` on the list path — repointed their port types to `RecordSummary[]`.

- [ ] **M3. Index `record_templates.status` and `is_sub_template`.** **Deferred.** Re-audit (2026-05-25) confirms no current SQL predicate touches these columns — `RecordTemplateRepository.listAll()` returns everything; filters happen in JS. No scanning to fix. Revisit when a status-scoped or sub-template-scoped list endpoint lands.

- [ ] **M4. Index `organization_invites.organizationId`.** **Deferred.** `InviteRepository` only has `insert / findByToken / markAccepted`; no per-org listing exists yet. Add when the listing UI lands.

## LOW — cleanup, not load-bearing

- [ ] **L1. Move composition sort to SQL.** `apps/api/src/modules/form-templates/infrastructure/composition-repository.ts:23,38` sorts in JS after the query. Use `ORDER BY position ASC, sub_template_id ASC` so the planner can use index order. Composite PK already covers the predicate.

- [ ] **L2. Paginate audit history.** `apps/api/src/modules/audit/infrastructure/audit-repository.ts:43-54` returns the full audit trail for an entity unbounded. `audit_log_entity_idx` covers the WHERE+ORDER BY, but a long-lived record will accumulate rows. Add `.limit()` + cursor before exposing in a customer-facing screen.

- [ ] **L3. GIN on `records.values` / `scoreBreakdown` (deferred).** No JSONB predicates today. Add when a feature lands that filters on JSONB fields.

## Top three to fix first

1. **H1** — `records` indexes. Removes the worst cliff.
2. **H2** — btree-indexable `current_state`. Unblocks the CS reviewer inbox.
3. **H3** — SQL-side `listPendingForActor`. Stops the org-side inbox from loading every workflow row.

## Audited and clean

- `audit_log`, `workflow_instances` (existing indexes match predicates), `ies_extraction_logs`, `sector_aggregates`, `organization_economic_profiles`, `pt_cae`, `pt_postal_codes`.
- `composition-repository.listForMains` — batched via `inArray`, covered by the composite PK.
- `drizzle-sector-benchmark-lookup` — single query, well-indexed.
- `user-repository`, `topic-repository`, `invite-repository.findByToken`, `organization-repository.findById/listForUser`, `central-services-domains-repository` — PK/unique lookups or small static lists.
- Seed scripts (`seed-cae`, `seed-postal-codes`, `seed-sector-aggregates`) use 1k-row chunked inserts.
- `apps/web` server components hit the API via Hono RPC — no direct DB use.
