// Curated-SQL migrator. The repo dropped drizzle-kit's generate/push
// flow because every non-trivial migration was hand-written anyway and
// the snapshot chain inevitably drifts. This runner only needs the
// migration files themselves — there is no journal, no snapshot, no
// hidden state.
//
// Convention:
//   * Files live in `packages/db/migrations/*.sql`.
//   * Filename pattern: `NNNN_short_slug.sql` (zero-padded, sortable).
//   * The filename without `.sql` is the migration's tag (what the
//     tracking table records, what `--status` and `--mark-up-to` use).
//   * Statements inside a file are separated by `--> statement-breakpoint`.
//     Each file applies in a single transaction; if any statement
//     fails, the whole file rolls back and the tag is not recorded.
//   * Once applied to any environment, a migration file is immutable.
//     Add a new file to change shape.
//
// Tracking table: `_bg_migrations (tag text primary key, idx integer,
// applied_at timestamptz)`. The runner creates it on first use.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

interface Migration {
  // Filename without the `.sql` extension. Used as the tracking-table key.
  tag: string;
  // Numeric prefix parsed from the filename — drives sort order and is
  // stored in the tracking table for human-readable status output.
  idx: number;
  // Absolute path to the SQL file.
  path: string;
}

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "migrations");
const TRACKING_TABLE = "_bg_migrations";
const FILENAME_PATTERN = /^(\d+)_[a-z0-9_]+\.sql$/i;

function parseArgs(argv: string[]): { markUpTo: string | null; status: boolean } {
  let markUpTo: string | null = null;
  let status = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mark-up-to") {
      const v = argv[i + 1];
      if (!v) throw new Error("--mark-up-to needs a tag");
      markUpTo = v;
      i++;
    } else if (a === "--status") {
      status = true;
    } else if (a === "--help" || a === "-h") {
      console.log(
        "Usage:\n" +
          "  pnpm db:migrate                       apply pending migrations\n" +
          "  pnpm db:migrate --status              show which tags are applied\n" +
          "  pnpm db:migrate --mark-up-to <tag>    mark every migration up to <tag>\n" +
          "                                        as applied without running it\n" +
          "\n" +
          "New migrations: create migrations/NNNN_short_slug.sql where NNNN is\n" +
          "the next zero-padded number after the highest existing file.",
      );
      process.exit(0);
    }
  }
  return { markUpTo, status };
}

function discoverMigrations(): Migration[] {
  const entries = readdirSync(MIGRATIONS_DIR, { withFileTypes: true });
  const migrations: Migration[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = FILENAME_PATTERN.exec(entry.name);
    if (!match) continue;
    const prefix = match[1];
    if (prefix === undefined) continue;
    const idx = Number.parseInt(prefix, 10);
    if (!Number.isFinite(idx)) continue;
    const tag = entry.name.slice(0, -".sql".length);
    migrations.push({ tag, idx, path: join(MIGRATIONS_DIR, entry.name) });
  }
  // Numeric prefix is authoritative; lexicographic order ties break it.
  migrations.sort((a, b) => a.idx - b.idx || a.tag.localeCompare(b.tag));
  assertUniquePrefixes(migrations);
  return migrations;
}

function assertUniquePrefixes(migrations: Migration[]): void {
  const seen = new Map<number, string>();
  for (const m of migrations) {
    const prior = seen.get(m.idx);
    if (prior) {
      throw new Error(
        `migration prefix ${String(m.idx).padStart(4, "0")} appears twice: ${prior} and ${m.tag}`,
      );
    }
    seen.set(m.idx, m.tag);
  }
}

async function main(): Promise<void> {
  const { markUpTo, status } = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL ?? "postgres://bgreen:bgreen_dev@localhost:5432/bgreen";
  const migrations = discoverMigrations();

  const pool = new pg.Pool({ connectionString: url });
  try {
    await ensureTrackingTable(pool);

    if (status) {
      const applied = await listApplied(pool);
      for (const m of migrations) {
        const flag = applied.has(m.tag) ? "✓" : " ";
        console.log(`[${flag}] ${m.tag}`);
      }
      return;
    }

    if (markUpTo) {
      const matched = migrations.find((m) => m.tag === markUpTo);
      if (!matched) {
        throw new Error(`--mark-up-to: unknown tag '${markUpTo}'`);
      }
      const applied = await listApplied(pool);
      let count = 0;
      for (const m of migrations) {
        if (m.idx > matched.idx) break;
        if (applied.has(m.tag)) continue;
        await pool.query(
          `INSERT INTO "${TRACKING_TABLE}" (tag, idx) VALUES ($1, $2)
           ON CONFLICT (tag) DO NOTHING`,
          [m.tag, m.idx],
        );
        console.log(`marked   ${m.tag} (not executed)`);
        count += 1;
      }
      console.log(`done — marked ${count} migration(s) as applied`);
      return;
    }

    const applied = await listApplied(pool);
    let count = 0;
    for (const m of migrations) {
      if (applied.has(m.tag)) {
        console.log(`skipped  ${m.tag} (already applied)`);
        continue;
      }
      const sql = readFileSync(m.path, "utf8");
      await applyMigration(pool, m, sql);
      console.log(`applied  ${m.tag}`);
      count += 1;
    }
    if (count === 0) console.log("all migrations already applied");
    else console.log(`done — applied ${count} migration(s)`);
  } finally {
    await pool.end();
  }
}

async function ensureTrackingTable(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${TRACKING_TABLE}" (
      "tag" text PRIMARY KEY,
      "idx" integer NOT NULL,
      "applied_at" timestamp with time zone NOT NULL DEFAULT now()
    )
  `);
}

async function listApplied(pool: pg.Pool): Promise<Set<string>> {
  const res = await pool.query<{ tag: string }>(`SELECT tag FROM "${TRACKING_TABLE}"`);
  return new Set(res.rows.map((r) => r.tag));
}

async function applyMigration(pool: pg.Pool, migration: Migration, sql: string): Promise<void> {
  // Split on the statement-breakpoint marker so a single file can carry
  // multi-statement DDL while still applying atomically. Empty chunks
  // (trailing breakpoints, blank lines) are dropped to avoid empty
  // queries.
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const stmt of statements) {
      await client.query(stmt);
    }
    await client.query(`INSERT INTO "${TRACKING_TABLE}" (tag, idx) VALUES ($1, $2)`, [
      migration.tag,
      migration.idx,
    ]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw new Error(`failed applying ${migration.tag}: ${(err as Error).message}`, { cause: err });
  } finally {
    client.release();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
