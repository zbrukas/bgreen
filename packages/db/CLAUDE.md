# packages/db — Drizzle schema + curated SQL migrations

Bounded context: relational data model + tenant scope helpers.

## Owns
- Drizzle schemas (one file per aggregate or grouped by module from V2 onward). Schema files describe the *current target shape*; the migrations are what move the database there.
- Curated SQL migrations under `migrations/*.sql`.
- Tenant-scope query interceptor (from V2 onward).
- DB connection pool + Drizzle client export.

## Does NOT own
- Domain logic.
- Repository implementations specific to a module — those live with the module in `apps/api/src/modules/<name>/infrastructure/`.

## Migration policy
- Migrations are **hand-written SQL**. We do not use `drizzle-kit generate`. Schema files (`src/schema/*.ts`) describe the target; the migration is the authoritative diff. Reviewer-only artefacts (snapshots, journals) don't exist.
- Migrations are immutable once applied to any environment. To change shape, add a new migration.
- One file per migration, named `NNNN_short_slug.sql`. `NNNN` is zero-padded and one higher than the current max. The runner sorts by the numeric prefix.
- Multi-statement files separate statements with `--> statement-breakpoint`. Each file applies in a single transaction — if any statement fails, the whole file rolls back and the tag is not recorded.
- Data backfills, `ALTER COLUMN ... USING`, enum reshapes, etc. all belong in the same `.sql` file as the schema change they accompany. The migrator does not care.

## Writing a new migration
1. Find the highest existing number under `migrations/`. Add one.
2. `touch packages/db/migrations/NNNN_what_changed.sql`.
3. Write the SQL. Use `--> statement-breakpoint` between statements that must be sent individually (almost always, when touching multiple objects).
4. Update the relevant schema file under `src/schema/` so its shape matches post-migration.
5. `pnpm db:migrate` against your local DB. `pnpm db:migrate --status` shows applied/pending.

## Commands
- `pnpm db:migrate` — apply pending migrations.
- `pnpm db:migrate --status` — print applied/pending list.
- `pnpm db:migrate --mark-up-to <tag>` — mark every migration up to `<tag>` as applied without running it (use only when adopting an existing DB).

## Tracking
Applied migrations are recorded in `_bg_migrations (tag, idx, applied_at)`. The runner creates the table on first use.
