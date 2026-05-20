// Shared helpers for RecordForm — initial-value derivation, default empty
// row for repeating fields, show-if evaluation kept consistent with the
// server-side interpreter, and stable per-row UI keys.

import type { Field, FormSchema, LeafField, ShowIfPredicate } from "@bgreen/types";

export type FormValues = Record<string, unknown>;
export type RowKeysByField = Record<string, string[]>;

// Generates a uuid per repeating sub-row at form initialisation. Keys
// stay parallel to `values[fieldId]` as rows are added or removed.
export function buildInitialRowKeys(
  schema: FormSchema,
  initialValues?: FormValues,
): RowKeysByField {
  const out: RowKeysByField = {};
  for (const row of schema.rows) {
    for (const field of row.fields) {
      if (field.kind === "repeating") {
        const stored = initialValues?.[field.id];
        const count = Array.isArray(stored) ? stored.length : 0;
        out[field.id] = Array.from({ length: count }, () => crypto.randomUUID());
      }
    }
  }
  return out;
}

export function buildInitialValues(schema: FormSchema, stored?: FormValues): FormValues {
  const out: FormValues = {};
  for (const row of schema.rows) {
    for (const field of row.fields) {
      out[field.id] = initialFieldValue(field, stored?.[field.id]);
    }
  }
  return out;
}

function initialFieldValue(field: Field | LeafField, stored: unknown): unknown {
  if (stored !== undefined && stored !== null) {
    if (field.kind === "repeating" && Array.isArray(stored)) {
      return stored.map((row) => initialSubRow(field.fields, row));
    }
    return stored;
  }
  switch (field.kind) {
    case "multi_select":
      return [];
    case "repeating":
      return [];
    default:
      return "";
  }
}

function initialSubRow(fields: LeafField[], stored: unknown): FormValues {
  const obj: FormValues = {};
  const storedObj =
    stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as FormValues) : {};
  for (const field of fields) {
    obj[field.id] = initialFieldValue(field, storedObj[field.id]);
  }
  return obj;
}

export function newSubRow(fields: LeafField[]): FormValues {
  const out: FormValues = {};
  for (const field of fields) {
    out[field.id] = initialFieldValue(field, undefined);
  }
  return out;
}

export function isVisible(field: Field | LeafField, scopeValues: FormValues): boolean {
  const predicates = field.showIf;
  if (!predicates || predicates.length === 0) return true;
  return predicates.every((p) => matches(scopeValues[p.fieldId], p));
}

function matches(value: unknown, predicate: ShowIfPredicate): boolean {
  if (Array.isArray(value)) {
    return value.some((v) => typeof v === "string" && v === predicate.equals);
  }
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() === predicate.equals;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value) === predicate.equals;
  }
  return false;
}
