// CAE Rev.3 — Portuguese statistical sector classification (NACE-derived).
// The catalog is generated from the INE XLSX by scripts/parse-cae.ts and
// committed as cae-data.json. Code/description text stays in pt-PT.
//
// Code structure (1–5 digits):
//   - 2 digits → Division
//   - 3 digits → Group
//   - 4 digits → Class
//   - 5 digits → Subclass (most granular; what users typically pick)
//
// We don't model the section letter (A–U) here — code prefix already
// encodes the position in the hierarchy.

import rawData from "./cae-data.json";

export interface CaeEntry {
  code: string;
  description: string;
}

export const caeCatalog: ReadonlyArray<CaeEntry> = rawData as CaeEntry[];

export function findCaeByCode(code: string): CaeEntry | null {
  const normalized = code.trim();
  return caeCatalog.find((entry) => entry.code === normalized) ?? null;
}

/**
 * Substring + prefix search over the catalog. Codes are matched as prefixes
 * (so "351" returns 351, 3511, 35111, …); descriptions are matched as
 * lower-cased substring. Diacritic-insensitive on the description side.
 *
 * Returns at most `limit` results (default 20), ordered with code-prefix
 * matches first then description matches.
 */
export function searchCae(query: string, limit = 20): CaeEntry[] {
  const q = query.trim();
  if (q === "") return [];
  const qLower = stripDiacritics(q).toLowerCase();

  const codeMatches: CaeEntry[] = [];
  const descMatches: CaeEntry[] = [];

  for (const entry of caeCatalog) {
    if (entry.code.startsWith(q)) {
      codeMatches.push(entry);
    } else if (stripDiacritics(entry.description).toLowerCase().includes(qLower)) {
      descMatches.push(entry);
    }
    if (codeMatches.length + descMatches.length >= limit * 2) break;
  }

  return [...codeMatches, ...descMatches].slice(0, limit);
}

function stripDiacritics(input: string): string {
  // After NFD, diacritics become standalone "Mark, Nonspacing" codepoints.
  return input.normalize("NFD").replace(/\p{Mn}/gu, "");
}
