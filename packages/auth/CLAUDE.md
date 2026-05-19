# packages/auth — WorkOS helpers + FGA wrapper

Bounded context: identity (V2) + fine-grained authorization (V5).

## Owns (from V2 onward)
- WorkOS AuthKit session helpers (validation, refresh).
- JWT verification middleware for Hono.

## Owns (from V5 onward)
- `can(actor, action, resource)` helper backed by WorkOS FGA.
- Per-request cache.

## Does NOT own
- User/Organization aggregates (live in `apps/api/src/modules/identity` and `…/organizations`).
- Tenant-scope enforcement (lives in `packages/db`).
