// Seed the pt_postal_codes table from apps/api/data/codigos-postais.csv
// (centraldedados format). Idempotent: TRUNCATE + bulk INSERT in chunks.
//
// CTT codes encode distrito/concelho as numeric codes — we resolve
// cod_distrito to its canonical name via a hardcoded 18-entry lookup;
// concelho is left null for now (no 308-entry catalog baked in).
//
// Run via: pnpm --filter @bgreen/api seed-postal-codes

import "../src/setup.js";

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { db, pool, schema } from "@bgreen/db";
import { readCsv } from "./_csv.js";

const here = dirname(fileURLToPath(import.meta.url));
const csvPath = resolve(here, "../data/codigos-postais.csv");
console.log(`Reading ${csvPath}…`);

const DISTRITO_NAMES: Record<string, string> = {
  "01": "Aveiro",
  "02": "Beja",
  "03": "Braga",
  "04": "Bragança",
  "05": "Castelo Branco",
  "06": "Coimbra",
  "07": "Évora",
  "08": "Faro",
  "09": "Guarda",
  "10": "Leiria",
  "11": "Lisboa",
  "12": "Portalegre",
  "13": "Porto",
  "14": "Santarém",
  "15": "Setúbal",
  "16": "Viana do Castelo",
  "17": "Vila Real",
  "18": "Viseu",
  "31": "Ilha da Madeira",
  "32": "Ilha de Porto Santo",
  "41": "Ilha de Santa Maria",
  "42": "Ilha de São Miguel",
  "43": "Ilha Terceira",
  "44": "Ilha Graciosa",
  "45": "Ilha de São Jorge",
  "46": "Ilha do Pico",
  "47": "Ilha do Faial",
  "48": "Ilha das Flores",
  "49": "Ilha do Corvo",
};

// Concelho-name lookup, keyed by (distritoCode + concelhoCode) → 4 digits.
function loadConcelhoNames(): Map<string, string> {
  const concelhosPath = resolve(here, "../data/concelhos.csv");
  try {
    const concelhoRows = readCsv(concelhosPath);
    if (concelhoRows.length === 0) return new Map();
    const header = (concelhoRows[0] ?? []).map((h) => h.trim());
    const codeIdx = header.indexOf("Official Code Municipality");
    const nameIdx = header.indexOf("Official Name Municipality");
    if (codeIdx === -1 || nameIdx === -1) {
      console.warn("concelhos.csv header unrecognized; concelho names will be empty.");
      return new Map();
    }
    const map = new Map<string, string>();
    for (let i = 1; i < concelhoRows.length; i++) {
      const code = (concelhoRows[i]?.[codeIdx] ?? "").trim().padStart(4, "0");
      const name = (concelhoRows[i]?.[nameIdx] ?? "").trim();
      if (code && name) map.set(code, name);
    }
    return map;
  } catch {
    console.warn(`concelhos.csv not readable at ${concelhosPath}; concelho names will be empty.`);
    return new Map();
  }
}
const concelhoNames = loadConcelhoNames();
console.log(`Loaded ${concelhoNames.size} concelho names.`);

const rows = readCsv(csvPath);
const header = (rows[0] ?? []).map((h) => h.toLowerCase().trim());
const idx = {
  codDistrito: header.indexOf("cod_distrito"),
  codConcelho: header.indexOf("cod_concelho"),
  numCodPostal: header.indexOf("num_cod_postal"),
  extCodPostal: header.indexOf("ext_cod_postal"),
  desigPostal: header.indexOf("desig_postal"),
};
if (
  idx.codDistrito === -1 ||
  idx.codConcelho === -1 ||
  idx.numCodPostal === -1 ||
  idx.extCodPostal === -1 ||
  idx.desigPostal === -1
) {
  console.error("Unrecognized header layout — expected centraldedados/codigos_postais format.");
  process.exit(1);
}

interface PcRow {
  postalCode: string;
  freguesia: string | null;
  concelho: string | null;
  distrito: string | null;
}

const entries = new Map<string, PcRow>();
for (let i = 1; i < rows.length; i++) {
  const row = rows[i] ?? [];
  const cp4 = (row[idx.numCodPostal] ?? "").trim();
  const cp3 = (row[idx.extCodPostal] ?? "").trim();
  if (!/^\d{4}$/.test(cp4) || !/^\d{3}$/.test(cp3)) continue;
  const postalCode = `${cp4}-${cp3}`;
  if (entries.has(postalCode)) continue;

  const codDistrito = (row[idx.codDistrito] ?? "").trim().padStart(2, "0");
  // cod_concelho in codigos-postais is 2 digits within the distrito.
  // The georef municipality code is the 4-digit distrito+concelho concat.
  const codConcelho = (row[idx.codConcelho] ?? "").trim().padStart(2, "0");
  const concelhoKey = `${codDistrito}${codConcelho}`;
  entries.set(postalCode, {
    postalCode,
    freguesia: (row[idx.desigPostal] ?? "").trim() || null,
    concelho: concelhoNames.get(concelhoKey) ?? null,
    distrito: DISTRITO_NAMES[codDistrito] ?? null,
  });
}

const all = [...entries.values()];
console.log(`Parsed ${all.length} postal codes; seeding…`);

await db.delete(schema.ptPostalCodes);

const CHUNK = 1000;
for (let i = 0; i < all.length; i += CHUNK) {
  const chunk = all.slice(i, i + CHUNK);
  await db.insert(schema.ptPostalCodes).values(chunk);
  if (i % 20000 === 0) console.log(`  …${i}/${all.length}`);
}

console.log(`Seeded ${all.length} postal codes.`);
await pool.end();
