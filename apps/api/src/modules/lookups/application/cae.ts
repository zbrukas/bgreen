// CAE Rev.4 lookup backed by the `pt_cae` table.
// Seeded via apps/api/scripts/seed-cae.ts.

import { db, schema } from "@bgreen/db";
import { type SQL, eq, ilike, like, or, sql } from "drizzle-orm";

export interface CaeEntry {
  code: string;
  description: string;
  level: number | null;
}

const MAX_LIMIT = 50;

export async function searchCae(query: string, limit = 20): Promise<CaeEntry[]> {
  const q = query.trim();
  if (q === "") return [];
  const safeLimit = Math.min(Math.max(1, limit), MAX_LIMIT);

  // Two clauses ORed: code prefix (cheap, hits PK index) + case-insensitive
  // description substring. Code-prefix matches sort first so "351" returns
  // the section before description matches.
  const matches: SQL[] = [
    like(schema.ptCae.code, `${q}%`),
    ilike(schema.ptCae.description, `%${q}%`),
  ];

  const rows = await db
    .select()
    .from(schema.ptCae)
    .where(or(...matches))
    .orderBy(
      sql`case when ${schema.ptCae.code} like ${`${q}%`} then 0 else 1 end`,
      schema.ptCae.code,
    )
    .limit(safeLimit);

  return rows.map((row) => ({
    code: row.code,
    description: row.description,
    level: row.level,
  }));
}

export async function findCaeByCode(code: string): Promise<CaeEntry | null> {
  const trimmed = code.trim();
  if (trimmed === "") return null;
  const rows = await db.select().from(schema.ptCae).where(eq(schema.ptCae.code, trimmed)).limit(1);
  const row = rows[0];
  return row ? { code: row.code, description: row.description, level: row.level } : null;
}
