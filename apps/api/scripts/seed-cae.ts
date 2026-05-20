// Seed the pt_cae table from apps/api/data/cae-rev3.csv (INE export).
// Idempotent: TRUNCATE + bulk INSERT in chunks.
//
// Run via: pnpm --filter @bgreen/api seed-cae

import "../src/setup.js";

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { db, pool, schema } from "@bgreen/db";
import { readCsv } from "./_csv.js";

const here = dirname(fileURLToPath(import.meta.url));
const csvPath = resolve(here, "../data/cae-rev3.csv");
console.log(`Reading ${csvPath}…`);

const rows = readCsv(csvPath);
// CSV header: Nível,Código,Designação
const dataRows = rows.slice(1);

interface CaeRow {
  code: string;
  description: string;
  level: number | null;
}

const entries = new Map<string, CaeRow>();
for (const row of dataRows) {
  let code: string | null = null;
  let description: string | null = null;
  let level: number | null = null;
  for (const cell of row) {
    const value = cell.trim();
    if (value === "") continue;
    if (level === null && /^\d{1,2}$/.test(value) && Number(value) >= 1 && Number(value) <= 5) {
      level = Number(value);
      continue;
    }
    if (code === null && /^\d{2,5}$/.test(value)) {
      code = value;
    } else if (description === null && value.length > 5 && /[A-Za-zÀ-ÿ]/.test(value)) {
      description = value;
    }
    if (code && description) break;
  }
  if (code && description && !entries.has(code)) {
    entries.set(code, { code, description, level });
  }
}

const all = [...entries.values()];
console.log(`Parsed ${all.length} CAE entries; seeding…`);

await db.delete(schema.ptCae);

const CHUNK = 1000;
for (let i = 0; i < all.length; i += CHUNK) {
  const chunk = all.slice(i, i + CHUNK);
  await db.insert(schema.ptCae).values(chunk);
}

console.log(`Seeded ${all.length} CAE entries.`);
await pool.end();
