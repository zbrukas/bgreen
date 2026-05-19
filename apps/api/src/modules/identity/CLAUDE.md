# modules/identity

Bounded context: the `User` aggregate + sync with WorkOS.

## Owns
- `User` aggregate (zod schema lives in `@bgreen/types/user`; this module is the authoritative consumer).
- WorkOS user sync (upsert by `workosUserId`).

## Does NOT own
- Auth session validation (`packages/auth` middleware, from V2.2).
- Organization membership (`modules/organizations`).
- Role-based authorization (`packages/auth` FGA, from V5).

## Public ports (Application layer)
- `UserRepository` — repository interface.
- `UserService` — sync + lookup orchestration.
- `SyncUserInput` — WorkOS payload contract.

## Public routes
- `GET /me` — current user (stubbed in V2.1, wired in V2.2).

## Status
V2.1 — module scaffolded, schema + repository ready. WorkOS sync invocation
happens in V2.2 when AuthKit middleware exists.
