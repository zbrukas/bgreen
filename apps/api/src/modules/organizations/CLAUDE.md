# modules/organizations

Bounded context: `Organization`, `OrganizationMembership`, `LegalForm`.

## Owns
- `Organization` aggregate.
- `OrganizationMembership` join (user × organization × role).
- `LegalForm` enum (PT NaturezaJuridica subset; full reference list in `packages/pt-data` from V3).
- The first `IOrgScoped` table (`organization_memberships`) — exercises `orgScope` from `@bgreen/db`.

## Does NOT own
- WorkOS organization sync (lives in `packages/auth` from V2.2).
- Org-create UI / signup wizard (`apps/web`, V2.3).
- FGA relationships (`packages/auth`, V5).

## Public ports (Application layer)
- `OrganizationRepository`, `MembershipRepository` — repository interfaces.
- `OrganizationService.createWithOwner` — creates an org and adds the founding admin membership atomically.

## Public routes
- `GET /organizations` — list current user's organizations (stubbed V2.1, wired V2.2).
- `POST /organizations` — create org (V2.3).

## Tenant scope
`MembershipRepository.listForOrganization` is the first call site of `orgScope`.
Cross-tenant reads (e.g., for admin tooling) must explicitly call `adminBypassScope` — grep-friendly.

## Status
V2.1 — schema + repositories ready, routes stubbed. Real wiring comes
with WorkOS auth in V2.2 and the org-create UI in V2.3.
