# V12 — Customer Success Telemetry

> **Status:** Complete (2026-05-25). Archived.
> **Depends on:** [V2 — Identity + Organizations](02-identity-organizations.md), [V4 — Form Templates + Records](04-form-templates-records.md), [V5 — Workflows + AuditLog](05-workflows-audit-fga.md) (workflow_instances, audit_log), [V8 — Scoring + Dashboards](08-scoring-dashboards.md)
> **Parent PRD:** [../bgreen-greenfield-rewrite.md](../bgreen-greenfield-rewrite.md)
> **User stories covered:** internal CS team — not in PRD §user-stories. Operational vertical: gives the CS team the metrics needed to detect silent churn, prioritise outreach, and measure activation of paying organisations.
>
> **Outcome:** Shipped in three commits.
> - V12.1 (`8e2a12e`): migration `0022` added `organization_required_templates` + `requirement_recurrence` enum + `audit_log_action_org_idx` composite index. New `apps/api/src/modules/cs-admin` module owns required-template CRUD. `POST /identity/login-event` writes `user.login` audit rows with 60s dedup; `apps/web/setActiveOrgId()` fires it on org change.
> - V12.2 (`fa92352`): migration `0023` added two SQL helper functions, the `cs_org_health` view, the `cs_health_snapshots` trend table, plus the records and workflow_instances perf indexes. New `@bgreen/cs-telemetry` package with `computeHealth()` (15 tests). `/cs/health/*` and `/cs/cohorts/activation` endpoints behind canCsRelation/canCsWrite. Inngest `cs.snapshot.daily` cron at 04:00 UTC with 18-month prune.
> - V12.3: `/health` route in `apps/cs` with top strip, filter chips, Carbon DataTable, per-org drawer (signals + 90d sparkline + stagnant items panel), 6-month activation cohort chart. Nav entry added to `AppShell`.
>
> **Deviations from plan literal.**
> - Routes mount under `/cs/*` (CS namespace), not `/admin/*` — matches the existing CS API surface.
> - UI lives in `apps/cs` (existing CS console), not `apps/web/admin/cs`. The plan was drafted before the V5.4 CS-app split.
> - `recordLogin()` goes via `POST /identity/login-event` instead of a direct DB write inside `apps/web` — apps/web has no DB access by design.
> - Migrations renumbered (0022 + 0023 instead of plan's 0023–0030) — current state was at 0021.
> - IP-hash audit payload deferred — requires client-IP plumbing through the API; harmless to add later.
> - M3 (`record_templates(status, is_sub_template)`) and M4 (`organization_invites(organization_id)`) indexes from `plans/archived/db-performance` are still deferred — no scanning predicates exist today.

## Goal

Give the Customer Success team a small, well-defined set of KPIs that detect **silent churn** (orgs that pay but don't engage) and **stuck activation** (orgs that signed up but never reached first value). The CS surface is internal-only (admin-scoped), reads from existing tables where possible, and adds the minimum new instrumentation needed — one new mapping table (`organization_required_templates`) and one event source (login audit entries).

The KPIs converge into a single per-org **CS health score** that drives a CS-only `/admin/cs` dashboard and a daily-snapshot table for cohort/trend analysis.

## Sub-slice plan

V12 ships in three sequential sub-slices. Each is independently deployable and adds standalone value — no slice requires a later slice to be useful in production. Mirrors the V8.1 / V8.2 / V8.3 rhythm.

### V12.1 — Foundation: required-templates + login telemetry

**Goal.** Start collecting the two signals the rest of the vertical depends on, and let CS manage required-template assignments via API. No dashboard, no view, no composite score yet.

**Ships.**
- `organization_required_templates` table + `requirement_recurrence` enum + Drizzle schema + migration `0023`.
- `@bgreen/types` zod schemas for assignment + recurrence.
- `POST /admin/organizations/:id/required-templates` and `DELETE /admin/organizations/:id/required-templates/:templateId` on `apps/api`.
- `recordLogin()` helper in `apps/web/src/server/auth/post-login.ts` writing `audit_log.user.login` rows once active org is resolved (skips CS users; null-safe on org-pickers without selection).
- New composite audit-log index `(action, organization_id, occurred_at)` — migration `0025` (CONCURRENTLY in prod).
- Service-layer CS-admin authz check (`users.userType='central_services'` AND `centralServicesRole IN ('admin','maintainer')`) + first `adminBypassScope()` call site under `apps/api/src/modules/cs-admin/`.

**Why first.** Ship the data collection before the UI consumes it. The composite audit-log index is shipped alongside the writer so login rows never accumulate against an unindexed table at production scale. Three weeks after V12.1 lands, V12.3 will have a meaningful WAU/MAU window to display.

**Defers.** The SQL view, the calculator, the snapshot table, all UI.

**Ticks from §Acceptance criteria.** All "Required-templates mapping" + "Login audit events" bullets.

**Deployable artifact.** A CS staffer can `curl POST /admin/organizations/:id/required-templates` and assign a template. Production starts accumulating `user.login` audit rows.

### V12.2 — Calculator + view + snapshots

**Goal.** Compute the composite health score, stagnation signals, and cohort metrics. Expose them via admin API. No `/admin/cs` UI yet — `curl` works end-to-end.

**Ships.**
- New package `@bgreen/cs-telemetry` with `CsHealthCalculator.computeHealth(signals) → CsHealthResult` + the `HEALTH_FORMULA` constants + ≥15 vitest cases (including the two stagnation-specific cases).
- SQL function `current_period_start(recurrence, first_due_at)` — migration `0028`.
- SQL function `wf_is_terminal(definition_id, current_state)` — migration `0029`.
- `cs_org_health` view — migration `0030`. Hand-written `CREATE VIEW`.
- `cs_health_snapshots` table + `(snapshot_date)` index — migration `0024`.
- New `records` partial index (`organization_id, template_id, submitted_at DESC` WHERE not null) — migration `0026`.
- New `workflow_instances (organization_id, updated_at)` composite index — migration `0027`.
- Inngest cron `cs.snapshot.daily` at 04:00 UTC with 18-month prune step.
- `GET /admin/cs/health`, `GET /admin/cs/health/:organizationId`, `GET /admin/cs/cohorts/activation` on `apps/api`. All gated by the V12.1 authz check, all reading via `adminBypassScope()`.

**Why second.** Depends on V12.1 data; nothing downstream depends on V12.2 except the UI. Calculator is pure TS — can be developed and unit-tested while V12.1 is still in code review.

**Defers.** The dashboard UI; the per-org drawer; the "Itens parados" panel rendering (the data is exposed via API in V12.2, just not visualised yet).

**Ticks from §Acceptance criteria.** All "Health-score view (deep module)", "Daily snapshot table", and "API (admin-scoped)" bullets.

**Deployable artifact.** `curl /admin/cs/health?tier=red` returns a JSON list of red-tier orgs with health rows. The first nightly snapshot lands at 04:00 UTC the day after deploy.

### V12.3 — `/admin/cs` dashboard

**Goal.** The CS team's day-to-day surface. Consumes V12.2's API exclusively.

**Ships.**
- `/admin/cs` route in `apps/web`, gated by the V12.1 authz check (server-side redirect on miss).
- Top strip: total orgs, % green / yellow / red, login-cold count (>30d), stagnant-work count.
- Filterable list with chips: `tier`, `hasStagnantWork`, `daysSinceLastLogin` range. Default sort: red first, then by `daysSinceLastLogin` desc.
- Per-org drawer:
  - Timeline of records-submitted vs required-template due dates (90d horizontal scroll).
  - Login history sparkline (90d, re-uses V8.3 `Sparkline`).
  - Score trend (re-uses V8.3 `Sparkline` again).
  - Overdue required-templates list with `firstDueAt` + recurrence.
  - **"Itens parados" panel** — each stagnant `workflow_instance` with definition, current state, days idle, deep-link to the underlying record.
- Activation cohort chart: stacked bars per cohort month, % activated-in-30d.
- All UI copy in pt-PT (G-2).

**Why last.** Pure consumer of V12.2. Snapshot trend visualisations have meaningful data because V12.2 has been running for at least a few days.

**Defers.** Anything in §"Notes for v1.5".

**Ticks from §Acceptance criteria.** All "CS dashboard surface" bullets + the cross-vertical hooks documentation.

**Deployable artifact.** A CS staffer opens `/admin/cs`, sees orgs sorted by health tier, filters to "tem trabalho parado ≥14d", drills into one, sees the stagnant-items list, and schedules an outreach. The activation cohort chart shows recent cohort performance.

### Parallelism opportunities

The dependency chain is strict (V12.1 → V12.2 → V12.3), but two streams can run alongside:

- `@bgreen/cs-telemetry` is a pure-TS package with no DB dependency — write it from unit tests while V12.1 is in PR.
- The V12.3 design + zod-types-driven mockup can be drafted against V12.2's response schemas before V12.2 endpoints are wired.

Skip the temptation to ship V12.2 + V12.3 together. The snapshot table benefits enormously from running silently for a few weeks before the trend chart goes live, otherwise day-one sparklines are all single-point.

## Acceptance criteria

### Required-templates mapping (new)

- [ ] New table `organization_required_templates` in `packages/db/src/schema/`:
  - `organizationId uuid not null references organizations(id)`
  - `templateId uuid not null references record_templates(id)`
  - `recurrence text not null` — enum `'annual' | 'quarterly' | 'monthly' | 'once'`
  - `firstDueAt timestamptz not null` (when the first period for this template was expected)
  - `assignedBy uuid references users(id)` (CS user or system)
  - `createdAt`, `updatedAt`
  - Unique on `(organizationId, templateId)`
  - Drizzle migration with `organization_id` tenant index.
- [ ] zod schema + types in `@bgreen/types`.
- [ ] CS-admin-only endpoint `POST /admin/organizations/:id/required-templates` and `DELETE` to manage assignments. No tenant-self-service in v1 — CS owns the assignment.
- [ ] Tenant scope in `packages/db` extended to scope reads to the org as usual.

### Login audit events

- [ ] WorkOS post-login callback in `apps/web` writes one `audit_log` row per successful login **once organization context is resolved**, with `entityKind='user'`, `action='user.login'`, `actorUserId=<user>`, `organizationId=<active-org>`, `occurredAt=now()`. No new table — extend the V5 audit log.
- [ ] `audit_log.organizationId` is `NOT NULL` (V5 schema), so login rows are only emitted after the org-context handshake. Org-pickers exited without selection produce no event — acceptable since CS engagement is per-org.
- [ ] Org-switch within a single session emits one row per new org. CS-user logins (`users.userType='central_services'`) are **not** written to `audit_log` — they're internal and would skew customer engagement metrics; `users.lastLoginAt` already tracks them.
- [ ] New composite index `audit_log (action, organization_id, occurred_at)` — required for the WAU/MAU queries to be cheap (the existing `(organization_id, occurred_at)` index doesn't cover `action='user.login'` filters at scale).

### Health-score view (deep module)

- [ ] New SQL view `cs_org_health` materialised nightly (Inngest cron) in `packages/db/src/schema/cs-views.ts`, exposing one row per organization with columns:
  - `organizationId`
  - `createdAt` (org)
  - `daysSinceCreated`
  - `firstRecordSubmittedAt` (nullable)
  - `daysToFirstRecord` (nullable)
  - `activatedIn30d boolean` — submitted ≥1 record in first 30 days
  - `recordsCurrentQuarter int`
  - `recordsPreviousQuarter int`
  - `engagementTrend text` — `'up' | 'flat' | 'down'` based on the two columns above
  - `requiredTemplatesCount int`
  - `requiredTemplatesWithCurrentPeriodData int`
  - `coveragePercent numeric(5,2)` — the headline CS number
  - `latestScoreYoyDelta numeric(7,4)` (nullable) — joined off V8.2 `records.score_percent`
  - `lastLoginAt timestamptz` (nullable, max of audit_log user.login rows)
  - `daysSinceLastLogin int` (nullable)
  - `wauCount int` — distinct users active (any audit_log action) in last 7d
  - `mauCount int` — distinct users active in last 30d
  - `stagnantWorkflowsCount int` — non-terminal `workflow_instances` for this org with `updated_at < now() - INTERVAL '14 days'`. The "user is doing the work but it's stuck" signal that none of the other dimensions catch.
  - `oldestStagnantWorkflowDays int` (nullable) — days since the oldest stagnant instance last transitioned; null when count is zero.
  - `stagnantWorkflowsByDefinition jsonb` — `{ "<definitionId>": <count> }` for drill-down in the drawer.
  - `healthScore int` — 0–100, composite. See "Composite formula" below.
  - `healthTier text` — `'green' | 'yellow' | 'red'`
  - `computedAt timestamptz`
- [ ] **`CsHealthCalculator`** deep module in new package `@bgreen/cs-telemetry`:
  - Pure function `computeHealth(orgRow, signals) → { score, tier, breakdown }`.
  - Composite formula (v1 — easily tuneable, ship as constants):
    - Coverage 40% (capped at 100%)
    - Engagement trend 20% (up=100, flat=60, down=20)
    - Login recency 20% (≤7d=100, ≤30d=70, ≤90d=30, >90d=0)
    - Activation 10% (`activatedIn30d` ? 100 : 50 if eventually activated : 0)
    - Score YoY 10% (positive=100, flat=70, negative=30, missing=70)
  - **Stagnation is NOT in the composite formula.** Rationale: it is largely downstream of coverage + login recency (users not logging in → workflows don't transition), so folding it in double-counts. Exposed as raw signals + a filter (`hasStagnantWork=true`) and a per-org drawer badge — CSMs use it as a direct outreach trigger.
  - Tiers: green ≥75, yellow 50–74, red <50.
  - ≥15 vitest cases covering: fresh org (no signals), activated-then-stalled, fully-engaged, score-trending-down, no-required-templates (coverage skipped, weight redistributed), missing latest score, never-logged-in-but-records-via-API, stagnant-but-otherwise-green (proves stagnation does NOT touch the composite score), stagnant-and-red (separate signals coexist correctly).

### Daily snapshot table (trend history)

- [ ] New table `cs_health_snapshots` — one row per (org, day): `organizationId`, `snapshotDate date`, plus a `metrics jsonb` of the `cs_org_health` row at that point. Primary key `(organizationId, snapshotDate)`.
- [ ] Inngest job `cs.snapshot.daily` runs at 04:00 UTC — recomputes the view, inserts a row per org. Idempotent on `(organizationId, snapshotDate)`.
- [ ] 18-month retention. Older snapshots pruned monthly.

### API (admin-scoped)

- [ ] `GET /admin/cs/health` — paginated list of orgs with health rows; supports `?tier=red&sortBy=daysSinceLastLogin&hasStagnantWork=true`. `sortBy` accepts `stagnantWorkflowsCount` and `oldestStagnantWorkflowDays`.
- [ ] `GET /admin/cs/health/:organizationId` — full row + last 90 snapshot points for trend chart.
- [ ] `GET /admin/cs/cohorts/activation?cohortMonth=2026-04` — % of orgs created in that month that hit `activatedIn30d`.
- [ ] All endpoints behind a service-layer check on `users.userType='central_services'` AND `users.centralServicesRole IN ('admin','maintainer')`. No new WorkOS role — the V5.4 hard population split already separates CS staff from customer users. Queries use `adminBypassScope()` from `packages/db/tenant-scope.ts` so cross-tenant reads are explicitly grep-able.

### CS dashboard surface

- [ ] New `/admin/cs` route on `apps/web`, gated by `admin:cs` role:
  - Top strip: total orgs, % green / yellow / red, count of orgs without a login in 30d, **count of orgs with stagnant work**.
  - Filterable list (default: red and yellow first); filter chips include "tem trabalho parado ≥14d".
  - Per-org drawer with: timeline of records vs required-template due dates, login history sparkline (90d), score trend (re-uses V8.3 `Sparkline`), list of overdue required templates, **"Itens parados" panel listing each stagnant workflow_instance with its definition, current state, days idle, and a deep-link to the underlying record**.
- [ ] Activation cohort chart: stacked bars per cohort month, % activated-in-30d.
- [ ] UI in pt-PT (matches G-2) — but copy targets internal CS staff, so technical terms are acceptable.

### Cross-vertical hooks

- [ ] V9 RecommendationsService — no integration in v1. CS health is internal-only.
- [ ] V11 PDF reports — no integration. Health is not customer-facing.
- [ ] V8 dashboard — unaffected; CS health lives in `/admin/cs`, not `/dashboard`.

## In scope

- `organization_required_templates` mapping table + admin endpoints.
- Login event capture in `audit_log` (no new table).
- `cs_org_health` view + `cs_health_snapshots` history table + nightly Inngest job.
- `@bgreen/cs-telemetry` package with `CsHealthCalculator` deep module.
- `/admin/cs` route + admin API endpoints.

## Out of scope

- **NPS / CSAT surveys.** Belongs in an external tool (Intercom, Delighted); CS team can hand-correlate.
- **Support-ticket integration** (Intercom, Zendesk). Read-only embed at most; defer to v1.5.
- **Predictive churn ML.** v1 ships a hand-tuned composite; ML on top of the snapshot table is v1.5.
- **Customer-facing health surface.** Orgs do not see their own CS health score — it's an internal CS construct, not a product feature.
- **CS user-action tracking** (calls logged, emails sent, playbooks). Belongs in CRM, not the product DB.
- **Real-time push** alerts when an org tips red. Daily snapshot is enough; alerts are v1.5.
- **Custom KPI builder** for CS staff. v1 hard-codes the formula; tune via constants and a redeploy.
- **Per-feature engagement** (which forms, which fields). Aggregate counts only in v1.
- **Multi-product / multi-tenant CS** beyond bGreen. NOMAD-org scope is hard-coded.
- **Self-service required-template management** by org admins — CS owns assignment in v1.

## Module map

| Module | Status | Notes |
|---|---|---|
| `@bgreen/db` schema | **extended** | `organization_required_templates`, `cs_health_snapshots`, `cs_org_health` view, audit-log index, `wf_is_terminal` SQL helper. |
| `workflow_instances` (V5) | **read-only consumer** | View joins on it for stagnation signals; no schema change. |
| `@bgreen/types` | **extended** | zod for required-template assignment, health row, snapshot. |
| `@bgreen/cs-telemetry` | **new** | `CsHealthCalculator` pure module + formula constants. |
| Audit log | **extended** | `user.login` action emitted from `apps/web` post-login callback. |
| Inngest jobs | **extended** | `cs.snapshot.daily` cron. |
| `apps/api` | **extended** | `/admin/cs/*` and `/admin/organizations/:id/required-templates` routes. |
| `apps/web` | **extended** | `/admin/cs` route + drawer + cohort chart. |
| Authz | **reused** | `users.userType='central_services'` + `centralServicesRole` from V5.4. No new WorkOS surface. |

## Deep modules introduced

- **`CsHealthCalculator`** — pure. Inputs: org row + signals object (counts, dates, scores). Output: `{ score, tier, breakdown[] }`. ~15 vitest cases. The formula is the only place tier thresholds and weights live, so tuning is a one-file change.

## Technical analysis

### Data model deltas

`packages/db/src/schema/organization-required-templates.ts`:

```ts
export const requirementRecurrenceEnum = pgEnum("requirement_recurrence", [
  "annual", "quarterly", "monthly", "once",
]);

export const organizationRequiredTemplates = pgTable(
  "organization_required_templates",
  {
    organizationId: uuid("organization_id").notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").notNull()
      .references(() => recordTemplates.id, { onDelete: "restrict" }),
    recurrence: requirementRecurrenceEnum("recurrence").notNull(),
    firstDueAt: timestamp("first_due_at", { withTimezone: true }).notNull(),
    assignedByUserId: uuid("assigned_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.organizationId, t.templateId] }),
    orgIdx: index("org_required_templates_org_idx").on(t.organizationId),
  }),
);
```

`packages/db/src/schema/cs-health-snapshots.ts`:

```ts
export const csHealthSnapshots = pgTable(
  "cs_health_snapshots",
  {
    organizationId: uuid("organization_id").notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    snapshotDate: date("snapshot_date").notNull(),
    metrics: jsonb("metrics").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.organizationId, t.snapshotDate] }),
    dateIdx: index("cs_health_snapshots_date_idx").on(t.snapshotDate),
  }),
);
```

The snapshot `metrics` column is intentionally schemaless JSONB — the V12 contract is the `CsHealthRow` zod type in `@bgreen/types`, parsed on read. Lets the formula evolve without snapshot migrations.

### View vs materialised view

Ship `cs_org_health` as a plain SQL view (hand-written migration; Drizzle does not introspect views).

- Live reads (`GET /admin/cs/health`) hit the view directly. With ~1k orgs and the indexes below, p95 budget is <500 ms.
- Historical reads (per-org drawer trend) hit `cs_health_snapshots`.
- When org count exceeds ~10k, convert to `MATERIALIZED VIEW` refreshed by the same cron. Single-line migration; no consumer changes.

Drizzle access is via `db.execute(sql\`SELECT ... FROM cs_org_health WHERE ...\`)` then zod-validated — same pattern as the score-history endpoint from V8.2.

### Headline query patterns

**activatedIn30d** (the binary cohort flag):

```sql
EXISTS (
  SELECT 1 FROM records r
  WHERE r.organization_id = o.id
    AND r.submitted_at IS NOT NULL
    AND r.submitted_at <= o.created_at + INTERVAL '30 days'
)
```

**coveragePercent** (the headline number — needs a `current_period_start(recurrence, first_due_at)` SQL function defined in the same migration):

```sql
WITH required AS (
  SELECT template_id, recurrence, first_due_at
  FROM organization_required_templates WHERE organization_id = o.id
),
fulfilled AS (
  SELECT DISTINCT r.template_id FROM records r
  JOIN required req USING (template_id)
  WHERE r.organization_id = o.id
    AND r.submitted_at >= current_period_start(req.recurrence, req.first_due_at)
)
SELECT CASE WHEN COUNT(req.template_id) = 0 THEN NULL
            ELSE (COUNT(f.template_id)::numeric / COUNT(req.template_id)) * 100 END
FROM required req LEFT JOIN fulfilled f USING (template_id);
```

NULL coverage (org has no assignments yet) signals "skip dimension, redistribute weight" to `CsHealthCalculator`. Not zero — zero would mean "assigned but nothing submitted", which is the worst possible CS signal.

**latestScoreYoyDelta** (averaged across templates with both this-year and prior-year scored records):

```sql
WITH latest AS (
  SELECT DISTINCT ON (template_id) template_id,
         score_percent::numeric AS pct, submitted_at
  FROM records WHERE organization_id = o.id
    AND score_percent IS NOT NULL
  ORDER BY template_id, submitted_at DESC
),
prior AS (
  SELECT DISTINCT ON (r.template_id) r.template_id,
         r.score_percent::numeric AS pct
  FROM records r JOIN latest USING (template_id)
  WHERE r.organization_id = o.id
    AND r.score_percent IS NOT NULL
    AND r.submitted_at <= latest.submitted_at - INTERVAL '11 months'
  ORDER BY r.template_id, r.submitted_at DESC
)
SELECT AVG(latest.pct - prior.pct) FROM latest JOIN prior USING (template_id);
```

Mirrors V8.3's per-template grouping. NULL when no template has 2+ scored years.

**stagnantWorkflowsCount** + **oldestStagnantWorkflowDays** + **stagnantWorkflowsByDefinition**:

`workflow_instances` has no `is_terminal` column — terminal state is encoded in `current_state` jsonb per `definition_id`. V12 ships a tiny SQL helper that the view calls:

```sql
-- 0028_wf_is_terminal_fn.sql
CREATE OR REPLACE FUNCTION wf_is_terminal(def_id text, state jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE def_id
    -- v1 ships exactly one definition (V5: record_templates.workflowDefinitionId default 'two-step-review')
    WHEN 'two-step-review' THEN state::text IN ('"approved"', '"rejected"')
    ELSE false
  END
$$;
```

Hard-coded because v1 has exactly one workflow definition (per `record_templates.workflowDefinitionId` default). When V6 adds the report-generation workflow, the function gets an extra `WHEN` clause in a fresh migration. v1.5 (see below) moves this to a `workflow_definition_states` config table — cleaner but premature.

```sql
WITH stagnant AS (
  SELECT id, definition_id, updated_at
  FROM workflow_instances wi
  WHERE wi.organization_id = o.id
    AND wi.updated_at < now() - INTERVAL '14 days'
    AND NOT wf_is_terminal(wi.definition_id, wi.current_state)
)
SELECT
  COUNT(*)                                                         AS stagnant_count,
  EXTRACT(epoch FROM (now() - MIN(updated_at))) / 86400             AS oldest_days,
  jsonb_object_agg(definition_id, cnt) FILTER (WHERE cnt IS NOT NULL) AS by_def
FROM (
  SELECT definition_id, COUNT(*) AS cnt FROM stagnant GROUP BY definition_id
) g, stagnant;
```

The view CROSS JOINs the per-definition rollup with the unaggregated stagnant CTE — Postgres-idiomatic enough; if EXPLAIN shows it under-performing, split into a LATERAL subquery.

**wauCount** / **mauCount** (uses the new composite audit-log index):

```sql
SELECT COUNT(DISTINCT actor_user_id) FROM audit_log
WHERE organization_id = o.id
  AND action IN ('user.login','record.submit','record.update','workflow.transition')
  AND occurred_at >= now() - INTERVAL '7 days'
  AND actor_user_id IS NOT NULL
```

Action filter scoped to user-driven actions to exclude system writes (Inngest IES jobs, etc.).

### Audit-log login integration

`apps/web` post-login flow already touches `users.lastLoginAt`. Add adjacent the audit-log write — but only once active org is in session:

```ts
// apps/web/src/server/auth/post-login.ts (new file)
export async function recordLogin(session: Session) {
  if (session.user.userType === "central_services") return;  // skip CS staff
  if (!session.activeOrganizationId) return;                  // wait for org pick

  await db.transaction(async (tx) => {
    await tx.update(users).set({ lastLoginAt: new Date() })
      .where(eq(users.id, session.user.id));
    await tx.insert(auditLog).values({
      organizationId: session.activeOrganizationId,
      actorUserId: session.user.id,
      entityKind: "user",
      entityId: session.user.id,
      action: "user.login",
      payload: {
        workosSessionId: session.workosSessionId,
        ipHash: sha256(`${ip}${process.env.IP_SALT}`),
      },
    });
  });
}
```

The IP hash keeps a regulator-grade audit trail without storing raw addresses (GDPR-friendly; CSRD-defensible).

### CsHealthCalculator interface

`packages/cs-telemetry/src/calculator.ts`:

```ts
export interface CsHealthSignals {
  daysSinceCreated: number;
  daysToFirstRecord: number | null;
  activatedIn30d: boolean;
  recordsCurrentQuarter: number;
  recordsPreviousQuarter: number;
  coveragePercent: number | null;     // null = no required templates assigned
  daysSinceLastLogin: number | null;  // null = never logged in (API-only org)
  latestScoreYoyDelta: number | null; // null = insufficient history
  stagnantWorkflowsCount: number;        // not used by composite — passes through to result
  oldestStagnantWorkflowDays: number | null;
}

export type CsHealthDimension =
  "coverage" | "engagement" | "login" | "activation" | "score";

export interface CsHealthBreakdown {
  dimension: CsHealthDimension;
  rawScore: number;        // 0–100
  weight: number;          // dynamic — redistributes when dimension is null
  contribution: number;    // rawScore * weight
}

export interface CsHealthResult {
  score: number;           // 0–100
  tier: "green" | "yellow" | "red";
  breakdown: CsHealthBreakdown[];
  stagnation: {            // surfaced verbatim — does not influence score/tier
    count: number;
    oldestDays: number | null;
  };
}

export function computeHealth(signals: CsHealthSignals): CsHealthResult;
```

**Weight redistribution:** when any dimension's underlying signal is null (typically coverage or score-YoY), redistribute that weight pro-rata across the remaining dimensions. So an org without required templates assigned doesn't get penalised for coverage — coverage's 40% spreads across engagement / login / activation / score by their relative weights. Mirror of V8 scoring's "skip hidden field" rule.

**Formula constants** live as a single exported object:

```ts
export const HEALTH_FORMULA = {
  weights: { coverage: 0.40, engagement: 0.20, login: 0.20, activation: 0.10, score: 0.10 },
  tiers:   { green: 75, yellow: 50 },
  engagement: { up: 100, flat: 60, down: 20 },
  login:      { warm: { days: 7, score: 100 }, recent: { days: 30, score: 70 },
                cool: { days: 90, score: 30 }, cold: { score: 0 } },
  activation: { in30d: 100, eventual: 50, never: 0 },
  score:      { positive: 100, flat: 70, negative: 30, missing: 70 },
} as const;
```

Re-tune = edit one file + redeploy. v1.5 might surface a UI for this, but not v1.

### Inngest cron — `cs.snapshot.daily`

```ts
export const csSnapshotDaily = inngest.createFunction(
  { id: "cs.snapshot.daily", concurrency: { limit: 1 } },
  { cron: "TZ=UTC 0 4 * * *" },
  async ({ step }) => {
    await step.run("snapshot", () => db.execute(sql`
      INSERT INTO cs_health_snapshots (organization_id, snapshot_date, metrics)
      SELECT organization_id, CURRENT_DATE, to_jsonb(v.*) FROM cs_org_health v
      ON CONFLICT (organization_id, snapshot_date)
        DO UPDATE SET metrics = EXCLUDED.metrics, computed_at = now()
    `));
    await step.run("prune", () => db.execute(sql`
      DELETE FROM cs_health_snapshots WHERE snapshot_date < CURRENT_DATE - INTERVAL '18 months'
    `));
  },
);
```

Single statement insert idempotent on the composite PK — safe to manually re-run for backfill: `cs.snapshot.daily?date=2026-05-12`. The composite tier computation runs in JS (the SQL view emits raw signals; the calculator runs in the API layer when reading, or post-snapshot if we need pre-computed tiers in the snapshot row — v1 reads-time-compute, accept the tradeoff).

### Index strategy

| Index | New / Existing | Justification |
|---|---|---|
| `audit_log (action, organization_id, occurred_at)` | **new** | Existing `(organization_id, occurred_at)` doesn't push `action` filter down; WAU/MAU queries become full scans at >100k audit rows. |
| `records (organization_id, template_id, submitted_at DESC) WHERE submitted_at IS NOT NULL` | **new (partial)** | Score-YoY `DISTINCT ON` pattern; partial keeps drafts out. |
| `organization_required_templates (organization_id, template_id)` | **new (PK)** | Default for coverage lookup. |
| `workflow_instances (organization_id, updated_at)` | **new** | V5 ships only `workflow_instances_org_idx` on `organization_id` alone. Stagnation query filters by `updated_at < now() - 14d`; composite is required so the planner can avoid scanning all instances per org. |
| `audit_log (organization_id, occurred_at)` | existing | Per-org activity rollups (broad). |
| `records (organization_id)` | existing (FK) | Adequate when combined with the new composite. |

EXPLAIN-validate the score-YoY query against the partial index before merge; if planner ignores the partial, drop the predicate (cost: ~10% larger index).

### Tenant-scope contract

CS reads are cross-tenant by definition. Every CS service entry point uses the `adminBypassScope()` marker — grep audit for V12:

```ts
import { adminBypassScope } from "@bgreen/db/tenant-scope";

export class CsHealthService {
  async listHealth(filter: HealthFilter) {
    // adminBypassScope() returns undefined — signals "no tenant filter intended".
    return this.db.select().from(csOrgHealthView).where(adminBypassScope() ?? filter.toSql());
  }
}
```

Service constructor takes a `CsAuthContext` (resolved from `users.userType` + `centralServicesRole` upstream). Constructor throws if context is not central-services-admin — defence in depth against accidental wiring from a customer-scoped controller.

### Migration ordering

1. `0023_organization_required_templates.sql` — table + enum + index.
2. `0024_cs_health_snapshots.sql` — table + index.
3. `0025_audit_log_action_org_idx.sql` — composite index (concurrent build in prod migration).
4. `0026_records_org_template_submitted_idx.sql` — partial index (concurrent).
5. `0027_workflow_instances_org_updated_idx.sql` — composite index for stagnation queries (concurrent).
6. `0028_current_period_start_fn.sql` — SQL function (hand-written; Drizzle doesn't generate functions).
7. `0029_wf_is_terminal_fn.sql` — terminal-state SQL helper (hand-written).
8. `0030_cs_org_health_view.sql` — `CREATE VIEW` (hand-written; depends on both SQL functions).

Steps 3–5 must use `CREATE INDEX CONCURRENTLY` in production; Drizzle's generated migrations don't, so they're hand-promoted to concurrent variants before merge — same convention as V5's audit-log index migration.

### Failure modes

- **Cron miss:** snapshot for that day is gone. View still serves live reads. Backfill via manual invocation (`cs.snapshot.daily?date=...`).
- **View slow at scale:** materialise (one-line migration). Decision point at ~10k orgs.
- **Audit-log volume:** login events add ~5–10 rows/org/week — negligible against the existing CRUD audit volume from V5.
- **Drizzle numeric round-trip:** `score_percent` and `coverage_percent` return as strings. The calculator boundary parses to JS number — same `parseNumeric` pattern as V8.2's `RecordRepository`.
- **Time zones:** view uses UTC `CURRENT_DATE` and `now()`. `firstDueAt` is `timestamptz`. v1 is UTC-everywhere; localisation per org is a v1.5 question.
- **CS staff in `audit_log`:** explicitly excluded by the `recordLogin` guard; if a future bug emits CS-staff logins, the view's WAU/MAU is contaminated by NOMAD employees. Add a CI check: assert no `audit_log` rows reference a central-services user, run on every backup snapshot.

## Open questions / risks

- **Required-template recurrence is binary in v1** — either an org has current-period data or it doesn't. "Late but submitted" vs "never submitted" are collapsed. Mitigation: surface the per-template overdue list in the drawer; the headline `coveragePercent` is intentionally coarse.
- **Activation definition is fixed at 30 days.** Some templates take longer to first submission (e.g., annual IES). Mitigation: the formula treats "eventually activated" as a 50% partial credit; CSMs can drill in.
- **Login events depend on the auth callback firing.** Programmatic access (future public API) bypasses the callback — those users will look inactive. Mitigation: include `audit_log` write on API-key authentication in V12.1 if/when public API ships.
- **Snapshot growth.** ~1k orgs × 18 months × 30 days ≈ 540k rows. Negligible. If we ever exceed 100k orgs, move to a compressed time-series store.
- **Composite-formula gameability.** Internal-only, so low risk; if surfaced to customers later, weights must be redesigned.
- **14-day stagnation threshold is global.** Some workflow states naturally idle longer than others (e.g., an annual `pending_review` waiting on a yearly committee). v1 accepts the false-positive rate; v1.5 parameterises threshold per `definition_id`. Mitigation: the drawer shows the actual idle duration so CSMs can ignore expected delays.
- **`wf_is_terminal` hard-codes the v1 workflow definition.** Migrating to a config table is a v1.5 task; v1 lives with a one-line `CASE` per new XState definition shipped. Acceptable while definition count stays in single digits.
- **Privacy: login timestamps in `audit_log`** are already retained per V5 audit policy — no new privacy surface, but document in the CS runbook that the dashboard reads from regulatory logs.

## Deployable artifact

End of vertical: a CS staffer opens `/admin/cs`, sees 12 orgs in the **red** tier sorted by days-since-last-login, drills into one, sees that they signed up 5 months ago, submitted one record in month 1, none since, have 3 required templates assigned of which 0 have current-period data, and the score trend is empty. The staffer schedules an outreach. Two weeks later, the same org's snapshot trend shows recovery. The activation cohort chart shows that orgs onboarded in 2026-03 hit 62% activation-in-30d vs 48% the prior month — a measurable win for the new onboarding flow shipped in V3.

## Notes for v1.5

- Real-time alerting when an org tips into red (Slack webhook, email digest).
- Predictive churn signal trained on the 18-month snapshot history.
- Self-service required-template assignment by org admins (with CS override).
- Intercom / Zendesk embed in the per-org drawer to correlate tickets.
- Public API access counts as activity once V12.1 ships API-key login audit.
- Composite-formula tuning UI for the CS lead (currently a redeploy).
- Per-`definition_id` stagnation thresholds + a `workflow_definition_states` config table to retire the hard-coded `wf_is_terminal` `CASE`.
- Empirical calibration of whether stagnation should enter the composite score (currently surfaced separately to avoid double-counting login/coverage signals).
- Customer-facing "your engagement" surface, derived from but distinct from the internal health score.
