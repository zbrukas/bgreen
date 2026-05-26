// Helpers for the template preview modal: derive initial values, evaluate
// showIf predicates, and resolve calculated-field display. Mirrors the
// org-side RecordForm helpers but trimmed for a non-persisting preview
// (no row-uuid bookkeeping, no field errors).

import { evaluateExpression, parseExpression } from "@bgreen/form-engine";
import type { Field, FormSchema, LeafField, ShowIfPredicate } from "@bgreen/types";

export type PreviewValues = Record<string, unknown>;

export function buildInitialValues(schema: FormSchema): PreviewValues {
  const out: PreviewValues = {};
  for (const row of schema.rows) {
    for (const field of row.fields) {
      out[field.id] = initialFieldValue(field);
    }
  }
  return out;
}

export function newRepeatingRow(fields: LeafField[]): PreviewValues {
  const out: PreviewValues = {};
  for (const f of fields) out[f.id] = initialFieldValue(f);
  return out;
}

function initialFieldValue(field: Field | LeafField): unknown {
  switch (field.kind) {
    case "multi_select":
    case "repeating":
      return [];
    default:
      return "";
  }
}

export function isVisible(field: Field | LeafField, scope: PreviewValues): boolean {
  const predicates = field.showIf;
  if (!predicates || predicates.length === 0) return true;
  return predicates.every((p) => matches(scope[p.fieldId], p));
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

export type CalculatedDisplay =
  | { kind: "value"; value: number }
  | { kind: "empty" }
  | { kind: "error"; message: string };

export function computeCalculatedDisplay(
  expression: string,
  scope: PreviewValues,
): CalculatedDisplay {
  const parsed = parseExpression(expression);
  if (!parsed.ok) return { kind: "error", message: "Expressão inválida" };
  const result = evaluateExpression(parsed.ast, scope);
  if (result.ok) return { kind: "value", value: result.value };
  if (result.error.code === "missing_dependency") return { kind: "empty" };
  if (result.error.code === "non_numeric_dependency") {
    return { kind: "error", message: `Campo "${result.error.refId}" não é numérico` };
  }
  return { kind: "error", message: "Divisão por zero" };
}

export function formatNumber(value: number): string {
  return value.toLocaleString("pt-PT", { maximumFractionDigits: 4 });
}
