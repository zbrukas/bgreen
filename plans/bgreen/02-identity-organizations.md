# V2 — Identity + Organizations

> **Status:** Not started
> **Depends on:** [V1 — Foundation](01-foundation.md)
> **Parent PRD:** [../bgreen-greenfield-rewrite.md](../bgreen-greenfield-rewrite.md)
> **User stories covered:** PRD §11–15 (auth), §22 (size self-assessment is later, but the Organization aggregate originates here)

## Goal

Real users can sign in via WorkOS AuthKit. Once signed in, they belong to one or more organizations. Every API request carries an authenticated user and resolves to a tenant (organization) scope. No product features yet — this vertical ends with "I can sign up, create an org, invite a colleague, and switch between orgs."

## Acceptance criteria

- [ ] WorkOS AuthKit configured in `apps/web` (Next.js middleware-based session, magic link + social).
- [ ] WorkOS user → bGreen `User` sync on first sign-in (upsert by `workos_user_id`).
- [ ] JWT validation middleware in `apps/api` (token from cookie or Authorization header).
- [ ] `Identity` module created with `domain / application / infrastructure / api / module.ts / CLAUDE.md` shape — establishes the per-module folder convention for the rest of the repo.
- [ ] `Organizations` module created with same shape.
- [ ] Aggregates: `User`, `Organization`, `OrganizationMembership` (with `role` enum), `LegalForm` (enum value object).
- [ ] Drizzle migrations: `users`, `organizations`, `organization_memberships`. All carry `created_at`, `updated_at`.
- [ ] Drizzle tenant-scope query helper — every aggregate query takes `organizationId` by default; admin opt-out is explicit.
- [ ] Create-organization flow: signed-in user with no org gets routed to a "Create your organization" step (name + legal form picker only; NIF/CAE come in V3).
- [ ] Invite colleague flow: org admin enters email + role → WorkOS sends invite → invitee accepts → membership row created.
- [ ] Organization switcher in the header (visible only when user has >1 membership). Session-persisted active-org id.
- [ ] All `apps/api` routes require auth except `/health`. 401 on missing/invalid token.
- [ ] All API routes resolve active org from the user's session and inject it into request context.
- [ ] Sign-out clears WorkOS session and redirects to landing.
- [ ] Hono RPC client wired in `apps/web` — first typed call from web to api succeeds with auth.

## In scope

- WorkOS AuthKit integration.
- User / Organization / OrganizationMembership aggregates.
- Tenant scope enforcement in Drizzle.
- Org switcher UI.
- Basic role enum (`admin`, `member`). WorkOS FGA was later reversed; row-based authorization remains the current path.

## Out of scope

- Fine-grained relationship authorization → out of current scope; V5 shipped row-based authorization instead.
- AuditLog → V5.
- NIF / CAE / VIES → V3.
- Field-level write permissions → not in v1 at all.
- Email customization (uses WorkOS defaults this vertical) → can be revisited later.

## Module map

| Module | Status | Notes |
|---|---|---|
| Identity | **new** | Thin adapter over WorkOS AuthKit; owns `User`. |
| Organizations | **new** | Owns `Organization`, `OrganizationMembership`, `LegalForm` (enum). |

## Deep modules introduced

- **`WorkOsSyncService`** — given a WorkOS user payload, upserts the bGreen `User` row. Idempotent. ~5 unit tests covering first-login, repeat-login, profile-update.
- **`TenantScope`** — Drizzle query interceptor that injects `organization_id = ?` on every query against `IOrgScoped` aggregates. ~6 unit tests covering scoped reads, scoped writes, admin-opt-out, missing-context error.

## Open questions / risks

- **WorkOS Organizations vs bGreen Organizations:** WorkOS has its own Organization concept. Decision: use WorkOS Organizations as the source of truth for membership relationships, mirror in our table for join performance + tenant scoping. Sync on org create / invite accept.
- **Active-org persistence:** cookie vs server session vs URL param. Default: cookie + last-active in DB. Revisit if SSR caching causes issues.
- **Pricing risk:** WorkOS pricing scales with MAU. Acceptable at zero customers. Track when first paying org lands.

## Deployable artifact

End of vertical: visit the deployed/staging URL → sign in via WorkOS → create an organization → invite a teammate → switch between orgs in the header. Database has populated `users`, `organizations`, `organization_memberships`. All API calls require and respect auth.

## Notes for the next vertical (V3)

V3 layers PT-jurisdiction data on top of the Organization aggregate (NIF, CAE, address). Expect Organization to grow more columns and to integrate the VIES lookup at signup.
