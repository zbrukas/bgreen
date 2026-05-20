# V5 — Workflows + Audit + FGA

> **Status:** Not started
> **Depends on:** [V4 — Form Templates + Records](04-form-templates-records.md)
> **Parent PRD:** [../bgreen-greenfield-rewrite.md](../bgreen-greenfield-rewrite.md)
> **User stories covered:** PRD §36–39 (workflows), §15 (audit log), §14 (FGA-driven UI/actions), §34–35 (now formalized as workflow transitions)

## Goal

Three cross-cutting concerns that turn V4's Records into a credible compliance product: XState workflows replace the flat status field, every meaningful change writes an AuditLog row, and WorkOS FGA stores authorization relationships consulted on every privileged action.

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

### FGA

- [ ] WorkOS FGA project provisioned. Schema seeded:
  - `user`, `organization`, `record`, `record_template` types.
  - Relations: `member`, `admin`, `reviewer`, `certifier` on organization; `reviewer_of`, `certifier_of` derived on `record`.
- [ ] `packages/auth` exposes `can(actor, action, resource): Promise<boolean>` with per-request cache.
- [ ] Hono middleware enforces FGA on every privileged route: review/approve/reject record, edit template, invite member.
- [ ] Next.js server components consult `can(...)` to gate UI affordances.
- [ ] FGA relationships seeded on org-create + invite-accept (V2 flows extended).

## In scope

- WorkflowEngine + 3 hardcoded XState graphs.
- AuditLog with auto-write interceptor.
- WorkOS FGA wired end to end with a narrow schema (org-scope + role only).
- Replacement of V4's flat status field.

## Out of scope

- DB-driven custom workflow editor → deferred (revisit only on customer demand).
- Nested FGA relationships (e.g., delegated review) → deferred.
- Per-field write permissions → not in v1 ever.
- Audit log retention policies / archive → deferred (indefinite retention OK at zero customers).

## Module map

| Module | Status | Notes |
|---|---|---|
| Workflows | **new** | XState graphs + persistence. |
| Audit | **new** | In-house Postgres audit log. |
| Records | **extended** | Status field replaced by `WorkflowInstance` reference. |
| `packages/auth` | **extended** | FGA `can()` helper added. |

## Deep modules introduced

- **`WorkflowEngine`** — wraps XState. Tests: for each of the three graphs, exhaustive state×event coverage that the graph accepts/rejects events as expected, including guard conditions (e.g., reviewer cannot review own submission).
- **`AuditWriter`** (Drizzle interceptor) — pure given an entity diff, produces the JSONB payload. Tests cover insert/update/delete + sensitive-field redaction policy (none in v1, but the hook exists).

## Open questions / risks

- **FGA learning curve:** relationship-based auth is unfamiliar. Mitigation: narrow schema in v1; lean on WorkOS docs + their playground.
- **Workflow migration plan when graphs evolve:** if `single-step-submit` gains a new state, existing `WorkflowInstance`s in the old shape need a strategy. Default: bump `definition_version`; old instances continue under the old definition; new instances pick up the new one. Document in module CLAUDE.md.
- **AuditLog write amplification:** every entity write produces an audit row. At zero customers this is fine; at scale, consider batching or sampling for non-critical entities.
- **FGA check latency:** every privileged action gates on an FGA call. Mitigate with per-request cache; revisit if WorkOS latency hurts UX.

## Deployable artifact

End of vertical: a Record moves through `two-step-review` workflow → reviewer is determined by FGA → each transition writes to AuditLog → "Pending my action" view aggregates correctly → state-transition history view shows the full chain.

## Notes for the next vertical (V6)

V6 introduces AI. AuditLog will start capturing AI-tool calls and their inputs/outputs. FGA will gate "generate recommendations" and similar AI actions. Workflows may grow an "ai_review" state for human-in-the-loop AI outputs — keep the engine flexible.
