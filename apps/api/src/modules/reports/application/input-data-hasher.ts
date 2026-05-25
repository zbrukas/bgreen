// InputDataHasher — pure. Canonicalises an arbitrary JSON-shaped
// object then SHA-256s it. Used as the tamper-evidence hash on
// ReportInstance: auditors re-collect data, re-hash, and compare.
//
// Canonicalisation rules (V11 plan §deep modules):
//   - Keys sorted lexicographically at every depth.
//   - Numbers serialised via JSON.stringify's default — finite numbers
//     emit their shortest unambiguous form. Non-finite (NaN, ±Inf) is
//     rejected at hashing time; the upstream collector should never
//     produce them.
//   - undefined values are dropped (matches JSON semantics).
//   - Arrays preserve order (the position is semantic).
//   - Dates are serialised via toISOString() so timezone normalisation
//     is explicit.
//
// Returns a 64-character lowercase hex SHA-256 digest. Same input →
// same digest, regardless of key insertion order in the source object.

import { createHash } from "node:crypto";

export class InputDataHashError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputDataHashError";
  }
}

export function hashInputData(input: unknown): string {
  const canonical = canonicalize(input);
  return createHash("sha256").update(canonical).digest("hex");
}

// Exposed for tests + diagnostics — auditors can see the canonical
// JSON string the hash was computed against. Same rules as hashInputData.
export function canonicalize(input: unknown): string {
  return JSON.stringify(normalise(input));
}

function normalise(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new InputDataHashError(
        `non-finite number ${value} cannot be canonicalised`,
      );
    }
    return value;
  }
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalise);
  if (typeof value === "object") {
    const out: { [k: string]: unknown } = {};
    const keys = Object.keys(value as Record<string, unknown>).sort();
    for (const k of keys) {
      const v = (value as Record<string, unknown>)[k];
      if (v === undefined) continue; // matches JSON.stringify semantics
      out[k] = normalise(v);
    }
    return out;
  }
  // Symbols, functions, BigInt — not part of the data surface. Reject
  // explicitly so an upstream bug doesn't silently produce a wrong hash.
  throw new InputDataHashError(
    `value of type ${typeof value} cannot be canonicalised`,
  );
}
