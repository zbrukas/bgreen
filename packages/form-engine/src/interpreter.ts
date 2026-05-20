// FormSchemaInterpreter — pure validator + coercer for FormSchema JSONB
// blobs. Given a schema and raw user input, returns the validated values
// keyed by field id, or a list of typed errors for the UI to render.
//
// The interpreter is intentionally explicit: zod owns the shape of the
// FormSchema itself (in @bgreen/types), this module enforces the
// per-field rules that the static type can't express (required, min/max,
// enum membership, date range, show-if visibility, repeating sub-rows).

import type {
  DateField,
  Field,
  FormSchema,
  LeafField,
  MultiSelectField,
  NumberField,
  RecordValues,
  RepeatingField,
  SelectField,
  ShowIfPredicate,
  TextField,
} from "@bgreen/types";

export type FormErrorCode =
  | "required"
  | "wrong_type"
  | "out_of_range"
  | "invalid_format"
  | "invalid_option"
  | "max_length"
  | "min_selections"
  | "max_selections"
  | "min_rows"
  | "max_rows"
  | "unknown_field"
  | "unknown_show_if_target";

export interface FormError {
  // Dotted path: top-level field id, or `parent[rowIndex].subFieldId` for
  // values inside a repeating sub-row.
  fieldId: string;
  code: FormErrorCode;
  message: string;
}

export type ValidationResult =
  | { ok: true; values: RecordValues }
  | { ok: false; errors: FormError[] };

// "submit" — full strictness (required, min_rows, min_selections enforced).
// "draft" — leniency for incomplete data: required + min-count checks skipped,
// but type/range/format/unknown-field checks still apply.
export type ValidationMode = "submit" | "draft";

export interface ValidateOptions {
  mode?: ValidationMode;
}

export function validateFormValues(
  schema: FormSchema,
  raw: unknown,
  options: ValidateOptions = {},
): ValidationResult {
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      errors: [{ fieldId: "", code: "wrong_type", message: "Expected an object of field values." }],
    };
  }
  const mode: ValidationMode = options.mode ?? "submit";
  const errors: FormError[] = [];
  const fields = schema.rows.flatMap((row) => row.fields);
  const values = validateScope(fields, raw, "", mode, errors);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, values };
}

// Top-level helper kept for backward compatibility — returns the flat list
// of fields declared at the top level of the schema (does not descend into
// repeating sub-rows).
export function collectFields(schema: FormSchema): Field[] {
  return schema.rows.flatMap((row) => row.fields);
}

// Validates one containment scope (top-level fields, or the children of a
// single repeating sub-row). `pathPrefix` is "" at the top level and
// `parent[index].` inside a sub-row.
function validateScope(
  fields: ReadonlyArray<Field | LeafField>,
  input: Record<string, unknown>,
  pathPrefix: string,
  mode: ValidationMode,
  errors: FormError[],
): RecordValues {
  const out: RecordValues = {};
  const knownIds = new Set(fields.map((f) => f.id));

  for (const field of fields) {
    const showIfResult = evaluateShowIf(field, input, fields, pathPrefix);
    if (showIfResult.unknownTarget.length > 0) {
      for (const targetId of showIfResult.unknownTarget) {
        errors.push({
          fieldId: `${pathPrefix}${field.id}`,
          code: "unknown_show_if_target",
          message: `Show-if reference "${targetId}" does not exist in this scope.`,
        });
      }
      continue;
    }
    if (!showIfResult.visible) continue;

    const present = Object.prototype.hasOwnProperty.call(input, field.id);
    const value = present ? input[field.id] : undefined;
    const result = validateField(field, value, present, `${pathPrefix}${field.id}`, mode, errors);
    if (result.kind === "value") {
      out[field.id] = result.value;
    } else if (result.kind === "error") {
      errors.push(...result.errors);
    }
  }

  for (const key of Object.keys(input)) {
    if (!knownIds.has(key)) {
      errors.push({
        fieldId: `${pathPrefix}${key}`,
        code: "unknown_field",
        message: `Field "${key}" is not defined in this schema.`,
      });
    }
  }

  return out;
}

type FieldResult =
  | { kind: "value"; value: unknown }
  | { kind: "skip" }
  | { kind: "error"; errors: FormError[] };

function validateField(
  field: Field | LeafField,
  value: unknown,
  present: boolean,
  path: string,
  mode: ValidationMode,
  errors: FormError[],
): FieldResult {
  if (field.kind === "repeating") {
    return validateRepeating(field, value, present, path, mode, errors);
  }
  const isEmpty =
    !present ||
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (field.kind === "multi_select" && Array.isArray(value) && value.length === 0);
  if (isEmpty) {
    if (mode === "submit" && field.required === true) {
      return errorOf(path, "required", `${field.label} é obrigatório.`);
    }
    return { kind: "skip" };
  }
  switch (field.kind) {
    case "text":
      return validateText(field, value, path);
    case "number":
      return validateNumber(field, value, path);
    case "date":
      return validateDate(field, value, path);
    case "select":
      return validateSelect(field, value, path);
    case "multi_select":
      return validateMultiSelect(field, value, path, mode);
  }
}

function validateText(field: TextField, value: unknown, path: string): FieldResult {
  if (typeof value !== "string") {
    return errorOf(path, "wrong_type", `${field.label} deve ser texto.`);
  }
  const trimmed = value.trim();
  if (field.maxLength !== undefined && trimmed.length > field.maxLength) {
    return errorOf(path, "max_length", `${field.label} excede ${field.maxLength} caracteres.`);
  }
  return { kind: "value", value: trimmed };
}

function validateNumber(field: NumberField, value: unknown, path: string): FieldResult {
  let n: number | null = null;
  if (typeof value === "number" && Number.isFinite(value)) {
    n = value;
  } else if (typeof value === "string" && value.trim() !== "") {
    // Accept PT-locale-ish input: comma decimal separator, surrounding spaces.
    const normalized = value.trim().replace(",", ".");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) n = parsed;
  }
  if (n === null) {
    return errorOf(path, "wrong_type", `${field.label} deve ser um número.`);
  }
  if (field.min !== undefined && n < field.min) {
    return errorOf(path, "out_of_range", `${field.label} mínimo é ${field.min}.`);
  }
  if (field.max !== undefined && n > field.max) {
    return errorOf(path, "out_of_range", `${field.label} máximo é ${field.max}.`);
  }
  return { kind: "value", value: n };
}

function validateDate(field: DateField, value: unknown, path: string): FieldResult {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return errorOf(path, "invalid_format", `${field.label} deve estar no formato YYYY-MM-DD.`);
  }
  const ts = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(ts)) {
    return errorOf(path, "invalid_format", `${field.label} não é uma data válida.`);
  }
  if (field.min !== undefined && value < field.min) {
    return errorOf(path, "out_of_range", `${field.label} mínimo é ${field.min}.`);
  }
  if (field.max !== undefined && value > field.max) {
    return errorOf(path, "out_of_range", `${field.label} máximo é ${field.max}.`);
  }
  return { kind: "value", value };
}

function validateSelect(field: SelectField, value: unknown, path: string): FieldResult {
  if (typeof value !== "string") {
    return errorOf(path, "wrong_type", `${field.label} deve ser texto.`);
  }
  if (!field.options.some((opt) => opt.value === value)) {
    return errorOf(path, "invalid_option", `${field.label}: valor "${value}" não é permitido.`);
  }
  return { kind: "value", value };
}

function validateMultiSelect(
  field: MultiSelectField,
  value: unknown,
  path: string,
  mode: ValidationMode,
): FieldResult {
  if (!Array.isArray(value)) {
    return errorOf(path, "wrong_type", `${field.label} deve ser uma lista de valores.`);
  }
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      return errorOf(path, "wrong_type", `${field.label}: todos os valores devem ser texto.`);
    }
    if (!field.options.some((opt) => opt.value === item)) {
      return errorOf(path, "invalid_option", `${field.label}: valor "${item}" não é permitido.`);
    }
    if (!seen.has(item)) {
      seen.add(item);
      cleaned.push(item);
    }
  }
  if (mode === "submit" && field.minSelected !== undefined && cleaned.length < field.minSelected) {
    return errorOf(
      path,
      "min_selections",
      `${field.label} requer pelo menos ${field.minSelected} ${field.minSelected === 1 ? "opção" : "opções"}.`,
    );
  }
  if (field.maxSelected !== undefined && cleaned.length > field.maxSelected) {
    return errorOf(
      path,
      "max_selections",
      `${field.label} permite no máximo ${field.maxSelected} ${field.maxSelected === 1 ? "opção" : "opções"}.`,
    );
  }
  return { kind: "value", value: cleaned };
}

function validateRepeating(
  field: RepeatingField,
  value: unknown,
  present: boolean,
  path: string,
  mode: ValidationMode,
  errors: FormError[],
): FieldResult {
  if (!present || value === undefined || value === null) {
    if (mode === "submit" && field.minRows !== undefined && field.minRows > 0) {
      return errorOf(
        path,
        "min_rows",
        `${field.label} requer pelo menos ${field.minRows} ${field.minRows === 1 ? "linha" : "linhas"}.`,
      );
    }
    if (mode === "submit" && field.required === true) {
      return errorOf(path, "required", `${field.label} é obrigatório.`);
    }
    return { kind: "skip" };
  }
  if (!Array.isArray(value)) {
    return errorOf(path, "wrong_type", `${field.label} deve ser uma lista de linhas.`);
  }
  if (mode === "submit" && field.minRows !== undefined && value.length < field.minRows) {
    return errorOf(
      path,
      "min_rows",
      `${field.label} requer pelo menos ${field.minRows} ${field.minRows === 1 ? "linha" : "linhas"}.`,
    );
  }
  if (field.maxRows !== undefined && value.length > field.maxRows) {
    return errorOf(
      path,
      "max_rows",
      `${field.label} permite no máximo ${field.maxRows} ${field.maxRows === 1 ? "linha" : "linhas"}.`,
    );
  }
  const rows: RecordValues[] = [];
  let hadRowError = false;
  for (let i = 0; i < value.length; i++) {
    const row = value[i];
    if (!isPlainObject(row)) {
      errors.push({
        fieldId: `${path}[${i}]`,
        code: "wrong_type",
        message: `${field.label}: linha ${i + 1} deve ser um objecto.`,
      });
      hadRowError = true;
      continue;
    }
    const before = errors.length;
    const sub = validateScope(field.fields, row, `${path}[${i}].`, mode, errors);
    if (errors.length > before) hadRowError = true;
    rows.push(sub);
  }
  if (hadRowError) {
    return { kind: "error", errors: [] };
  }
  return { kind: "value", value: rows };
}

interface ShowIfResult {
  visible: boolean;
  unknownTarget: string[];
}

function evaluateShowIf(
  field: Field | LeafField,
  scopeInput: Record<string, unknown>,
  scopeFields: ReadonlyArray<Field | LeafField>,
  _pathPrefix: string,
): ShowIfResult {
  const predicates = field.showIf;
  if (!predicates || predicates.length === 0) return { visible: true, unknownTarget: [] };

  const unknownTarget: string[] = [];
  for (const predicate of predicates) {
    const target = scopeFields.find((f) => f.id === predicate.fieldId);
    if (!target) {
      unknownTarget.push(predicate.fieldId);
      continue;
    }
    if (target.id === field.id) {
      unknownTarget.push(predicate.fieldId);
      continue;
    }
    const refValue = scopeInput[predicate.fieldId];
    if (!matchesPredicate(refValue, predicate)) {
      return { visible: false, unknownTarget };
    }
  }
  return { visible: unknownTarget.length === 0, unknownTarget };
}

function matchesPredicate(value: unknown, predicate: ShowIfPredicate): boolean {
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function errorOf(fieldId: string, code: FormErrorCode, message: string): FieldResult {
  return { kind: "error", errors: [{ fieldId, code, message }] };
}
