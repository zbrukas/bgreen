# packages/db — Drizzle schema + migrations

Bounded context: relational data model + tenant scope helpers.

## Owns
- Drizzle schemas (one file per aggregate or grouped by module from V2 onward).
- Migrations (generated via `drizzle-kit generate`; reviewable SQL committed to git).
- Tenant-scope query interceptor (from V2 onward).
- DB connection pool + Drizzle client export.

## Does NOT own
- Domain logic.
- Repository implementations specific to a module — those live with the module in `apps/api/src/modules/<name>/infrastructure/`.

## Migration policy
- `drizzle-kit generate` produces reviewable SQL. Never commit a migration you haven't read.
- Migrations are immutable once applied. Add new migrations for changes.
- Audit-log-triggering writes will go through the tenant-scoped query helper (V5).
