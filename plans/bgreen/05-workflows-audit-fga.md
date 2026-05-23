# V5 — Workflows + Audit + FGA

> **Status:** Workflows + Audit shipped. FGA reversed — see "FGA reversal (V5.8)" below.
> **Depends on:** [V4 — Form Templates + Records](04-form-templates-records.md)
> **Parent PRD:** [../bgreen-greenfield-rewrite.md](../bgreen-greenfield-rewrite.md)
> **User stories covered:** PRD §36–39 (workflows), §15 (audit log), §14 (FGA-driven UI/actions — now satisfied via row lookups), §34–35 (now formalized as workflow transitions)

## FGA reversal (V5.8)

WorkOS announced the sunset of their FGA product on November 15, 2025 (brownout began rolling out before that). V5.8 ripped FGA out and replaced every `can*()` check with direct DB lookups against `users.central_services_role` (CS workspace) and `organization_memberships.role` (org workspace). The permission model bGreen actually needs is flat enough that row lookups answer every gate. The plan's FGA acceptance criteria below are kept for historical context but are no longer in scope; treat them as "satisfied by an equivalent row-based mechanism." If permissioning grows beyond what rows can express, a future vertical can introduce a self-hosted FGA service (OpenFGA, Permify, Cerbos) — we don't depend on a vendor's roadmap for it.

Removed in V5.8:
- `packages/auth/src/fga.ts` (the `can()` / `requireCan()` helpers, FGA cache scope).
- `apps/api/src/fga-client.ts` (WorkOS adapter).
- `apps/api/src/middleware/fga.ts` (per-request cache + `FgaDeniedError` → 403 mapping).
- `apps/api/scripts/seed-fga.ts` (idempotent warrant backfill).
- `FGA_SCHEMA.md` (WorkOS dashboard DSL reference).
- All `writeWarrant(...)` calls in `UserService.syncFromWorkos`, `OrganizationService.createWithOwner`, `InviteService.accept`, and the `ensureGlobalAdmin` boot seed.

Replaced by `apps/api/src/auth-helpers.ts`:
- `canOrgRelation(userId, organizationId, relation)` — row lookup on `organization_memberships`.
- `canCsRelation(userId, relation)` — row lookup on `users.central_services_role`.
- `canCsWrite(userId)` — admin OR maintainer.
- `ForbiddenError` thrown by `requireOrgRelation` / `requireCsRelation`; routes still convert to 403.

## Goal

Three cross-cutting concerns that turn V4's Records into a credible compliance product: XState workflows replace the flat status field, every meaningful change writes an AuditLog row, and ~~WorkOS FGA stores authorization relationships consulted on every privileged action~~ row-based authorization checks gate privileged actions.

## Acceptance criteria

### Workflows

- [ ] `Workflows` module created. Owns: `WorkflowDefinition` (in-code XState graph, not persisted as data in v1), `WorkflowInstance` (persisted state per Record).
- [ ] **`WorkflowEngine`** deep module — wraps XState. Exposes: `start(definitionId, context)`, `transition(instanceId, event, actor)`, `currentState(instanceId)`, `history(instanceId)`. Persistence injected via port.
- [ ] Drizzle migration: `workflow_instances` with `current_state` JSONB (XState `StateValue`) + `context` JSONB.
- [ ] Three pre-defined XState graphs ship in `modules/records/workflows/`:
  - `single-step-submit` (draft → submitted → done)
  - `two-step-review` (draft → submitted → in_review → {approved | changes_requested → submitted | rejected})
  - `three-step-certify` (… → certified by separate role)
- [ ] `RecordTemplate` carries a `workflow_definition_id` choosing one of the three.
- [ ] V4's flat `record.status` field migrated to `WorkflowInstance.current_state`. Old field dropped.
- [ ] Workflow participant dashboard: "Pending my action" view aggregates across all `WorkflowInstance`s where the current state expects an action from the signed-in user (resolved via FGA / role).
- [ ] State-transition history view per record: ordered list of `(timestamp, actor, event, from_state, to_state, comment)`.

### Audit

- [ ] `Audit` module created. Owns `AuditLog`.
- [ ] Drizzle migration: `audit_log` (`id`, `occurred_at`, `actor_user_id`, `organization_id`, `entity_kind`, `entity_id`, `action`, `payload` JSONB, `correlation_id`).
- [ ] `IAuditable` const list registers entity types that should be auto-audited.
- [ ] Drizzle interceptor writes one `audit_log` row per insert/update/delete on `IAuditable` entities, capturing field-level deltas.
- [ ] Workflow transitions write to `audit_log` as `action = 'workflow.transition'` with old/new state in payload.
- [ ] `GET /audit?entityKind=record&entityId=:id` returns the time-ordered change log for that entity. Scoped by org + FGA check.
- [ ] Right-to-erasure (V-future) policy noted: actor reference is tombstoned, change rows retained.

### ~~FGA~~ Row-based authorization (V5.8 reversal)

> **Superseded.** Original FGA criteria below are historical. WorkOS sunset FGA on 2025-11-15; the replacement is row-based authz in `apps/api/src/auth-helpers.ts`. See "FGA reversal (V5.8)" at the top of this doc.

- [x] ~~WorkOS FGA project provisioned~~ — no external auth service. Roles live on `users.central_services_role` + `organization_memberships.role` (rows are the source of truth).
- [x] ~~`packages/auth` exposes `can(actor, action, resource): Promise<boolean>` with per-request cache~~ — replaced by `auth-helpers.ts`: `canOrgRelation` / `canCsRelation` / `canCsWrite`. No cache needed (a single indexed lookup per check).
- [x] ~~Hono middleware enforces FGA on every privileged route~~ — privileged routes call the helpers inline; failures throw `ForbiddenError` → 403.
- [x] ~~Next.js server components consult `can(...)` to gate UI affordances~~ — pages read `me.activeOrganizationRole` / `me.userType` / `me.centralServicesRole` from `/identity/me` and conditionally render.
- [x] ~~FGA relationships seeded on org-create + invite-accept~~ — irrelevant; membership rows are the relationship.

## In scope

- WorkflowEngine + 3 hardcoded XState graphs.
- AuditLog with auto-write interceptor.
- ~~WorkOS FGA wired end to end with a narrow schema (org-scope + role only).~~ Row-based authz helpers in `apps/api/src/auth-helpers.ts` (V5.8 reversal).
- Replacement of V4's flat status field.

## Out of scope

- DB-driven custom workflow editor → deferred (revisit only on customer demand).
- ~~Nested FGA relationships (e.g., delegated review)~~ — moot under row-based authz. If complex delegation appears, evaluate self-hosted OpenFGA / Permify / Cerbos at that point.
- Per-field write permissions → not in v1 ever.
- Audit log retention policies / archive → deferred (indefinite retention OK at zero customers).

## Module map

| Module | Status | Notes |
|---|---|---|
| Workflows | **new** | XState graphs + persistence. |
| Audit | **new** | In-house Postgres audit log. |
| Records | **extended** | Status field replaced by `WorkflowInstance` reference. |
| `packages/auth` | **extended** | ~~FGA `can()` helper added~~ — JWT verifier only after V5.8. Row-based auth helpers live in `apps/api/src/auth-helpers.ts`. |

## Deep modules introduced

- **`WorkflowEngine`** — wraps XState. Tests: for each of the three graphs, exhaustive state×event coverage that the graph accepts/rejects events as expected, including guard conditions (e.g., reviewer cannot review own submission).
- **`AuditWriter`** (Drizzle interceptor) — pure given an entity diff, produces the JSONB payload. Tests cover insert/update/delete + sensitive-field redaction policy (none in v1, but the hook exists).

## Open questions / risks

- ~~**FGA learning curve:** relationship-based auth is unfamiliar.~~ Resolved by V5.8 reversal — bGreen's permission model is flat enough that row lookups answer every check we need today.
- **Workflow migration plan when graphs evolve:** if `single-step-submit` gains a new state, existing `WorkflowInstance`s in the old shape need a strategy. Default: bump `definition_version`; old instances continue under the old definition; new instances pick up the new one. Document in module CLAUDE.md.
- **AuditLog write amplification:** every entity write produces an audit row. At zero customers this is fine; at scale, consider batching or sampling for non-critical entities.
- ~~**FGA check latency:** every privileged action gates on an FGA call.~~ Replaced by row-lookup latency — sub-ms against a primary key, no remote call.
- **Authz growth risk:** if permissioning ever needs delegation, conditional access, or relationship traversal beyond role-on-org / role-on-CS, the inline DB checks won't scale cleanly. Plan: at that point, introduce a thin `PermissionService` port and back it with self-hosted OpenFGA (or similar). Don't pre-emptively re-add it.

## Deployable artifact

End of vertical: a Record moves through `two-step-review` workflow → ~~reviewer is determined by FGA~~ reviewer is any CS admin/maintainer (`canCsWrite`) → each transition writes to AuditLog → "Pending my action" view aggregates correctly → state-transition history view shows the full chain.

## Notes for the next vertical (V6)

V6 introduces AI. AuditLog will start capturing AI-tool calls and their inputs/outputs. ~~FGA will gate "generate recommendations" and similar AI actions.~~ Row-based checks (`canCsWrite`, `canOrgRelation`) will gate AI actions instead. Workflows may grow an "ai_review" state for human-in-the-loop AI outputs — keep the engine flexible.
