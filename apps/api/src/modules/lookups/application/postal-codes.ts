// PT postal-code → freguesia/concelho/distrito lookup, backed by the
// `pt_postal_codes` Postgres table. Seeded via apps/api/scripts/seed-postal-codes.ts.

import { db, schema } from "@bgreen/db";
import { eq } from "drizzle-orm";

export interface PostalCodeEntry {
  postalCode: string;
  freguesia: string | null;
  concelho: string | null;
  distrito: string | null;
}

const FORMATTED = /^\d{4}-\d{3}$/;
const DIGITS_ONLY = /^\d{7}$/;

export function normalizePostalCode(input: string | null | undefined): string | null {
  if (input == null) return null;
  const trimmed = input.trim();
  if (FORMATTED.test(trimmed)) return trimmed;
  const stripped = trimmed.replace(/[\s-]/g, "");
  if (DIGITS_ONLY.test(stripped)) {
    return `${stripped.slice(0, 4)}-${stripped.slice(4)}`;
  }
  return null;
}

export async function lookupPostalCode(
  input: string | null | undefined,
): Promise<PostalCodeEntry | null> {
  const normalized = normalizePostalCode(input);
  if (!normalized) return null;
  const rows = await db
    .select()
    .from(schema.ptPostalCodes)
    .where(eq(schema.ptPostalCodes.postalCode, normalized))
    .limit(1);
  const row = rows[0];
  return row
    ? {
        postalCode: row.postalCode,
        freguesia: row.freguesia,
        concelho: row.concelho,
        distrito: row.distrito,
      }
    : null;
}
