# packages/auth — WorkOS helpers + JWT verification

Bounded context: identity (V2) + fine-grained authorization (V5).

## Owns (from V2 onward)
- WorkOS AuthKit session helpers (validation, refresh).
- JWT verification middleware for Hono.

## Owns (from V5 onward)
- Authorization checks live in `apps/api/src/auth-helpers.ts` and read local DB rows. Do not add WorkOS FGA back here.
- Per-request cache.

## Does NOT own
- User/Organization aggregates (live in `apps/api/src/modules/identity` and `…/organizations`).
- Tenant-scope enforcement (lives in `packages/db`).
