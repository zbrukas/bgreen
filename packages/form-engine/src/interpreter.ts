// FormSchemaInterpreter — pure validator + coercer for FormSchema JSONB
// blobs. Given a schema and raw user input, returns the validated values
// keyed by field id, or a list of typed errors for the UI to render.
//
// The interpreter is intentionally explicit: zod owns the shape of the
// FormSchema itself (in @bgreen/types), this module enforces the
// per-field rules that the static type can't express (required when
// `required: true`, min/max, enum membership, date range, etc.).

import type {
  DateField,
  Field,
  FormSchema,
  NumberField,
  RecordValues,
  SelectField,
  TextField,
} from "@bgreen/types";

export type FormErrorCode =
  | "required"
  | "wrong_type"
  | "out_of_range"
  | "invalid_format"
  | "invalid_option"
  | "max_length"
  | "unknown_field";

export interface FormError {
  fieldId: string;
  code: FormErrorCode;
  message: string;
}

export type ValidationResult =
  | { ok: true; values: RecordValues }
  | { ok: false; errors: FormError[] };

export function validateFormValues(schema: FormSchema, raw: unknown): ValidationResult {
  if (raw === null || raw === undefined || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      errors: [{ fieldId: "", code: "wrong_type", message: "Expected an object of field values." }],
    };
  }
  const input = raw as Record<string, unknown>;
  const errors: FormError[] = [];
  const out: RecordValues = {};

  const fields = collectFields(schema);
  const knownIds = new Set(fields.map((f) => f.id));

  for (const field of fields) {
    const present = Object.prototype.hasOwnProperty.call(input, field.id);
    const value = present ? input[field.id] : undefined;
    const result = validateField(field, value, present);
    if (result.kind === "error") {
      errors.push(...result.errors);
    } else if (result.kind === "value") {
      out[field.id] = result.value;
    }
  }

  for (const key of Object.keys(input)) {
    if (!knownIds.has(key)) {
      errors.push({
        fieldId: key,
        code: "unknown_field",
        message: `Field "${key}" is not defined in this schema.`,
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, values: out };
}

export function collectFields(schema: FormSchema): Field[] {
  return schema.rows.flatMap((row) => row.fields);
}

type FieldResult =
  | { kind: "value"; value: unknown }
  | { kind: "skip" }
  | { kind: "error"; errors: FormError[] };

function validateField(field: Field, value: unknown, present: boolean): FieldResult {
  const isEmpty =
    !present ||
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "");
  if (isEmpty) {
    if (field.required === true) {
      return errorOf(field.id, "required", `${field.label} é obrigatório.`);
    }
    return { kind: "skip" };
  }
  switch (field.kind) {
    case "text":
      return validateText(field, value);
    case "number":
      return validateNumber(field, value);
    case "date":
      return validateDate(field, value);
    case "select":
      return validateSelect(field, value);
  }
}

function validateText(field: TextField, value: unknown): FieldResult {
  if (typeof value !== "string") {
    return errorOf(field.id, "wrong_type", `${field.label} deve ser texto.`);
  }
  const trimmed = value.trim();
  if (field.maxLength !== undefined && trimmed.length > field.maxLength) {
    return errorOf(field.id, "max_length", `${field.label} excede ${field.maxLength} caracteres.`);
  }
  return { kind: "value", value: trimmed };
}

function validateNumber(field: NumberField, value: unknown): FieldResult {
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
    return errorOf(field.id, "wrong_type", `${field.label} deve ser um número.`);
  }
  if (field.min !== undefined && n < field.min) {
    return errorOf(field.id, "out_of_range", `${field.label} mínimo é ${field.min}.`);
  }
  if (field.max !== undefined && n > field.max) {
    return errorOf(field.id, "out_of_range", `${field.label} máximo é ${field.max}.`);
  }
  return { kind: "value", value: n };
}

function validateDate(field: DateField, value: unknown): FieldResult {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return errorOf(field.id, "invalid_format", `${field.label} deve estar no formato YYYY-MM-DD.`);
  }
  // Confirm it's a real calendar date.
  const ts = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(ts)) {
    return errorOf(field.id, "invalid_format", `${field.label} não é uma data válida.`);
  }
  if (field.min !== undefined && value < field.min) {
    return errorOf(field.id, "out_of_range", `${field.label} mínimo é ${field.min}.`);
  }
  if (field.max !== undefined && value > field.max) {
    return errorOf(field.id, "out_of_range", `${field.label} máximo é ${field.max}.`);
  }
  return { kind: "value", value };
}

function validateSelect(field: SelectField, value: unknown): FieldResult {
  if (typeof value !== "string") {
    return errorOf(field.id, "wrong_type", `${field.label} deve ser texto.`);
  }
  if (!field.options.some((opt) => opt.value === value)) {
    return errorOf(field.id, "invalid_option", `${field.label}: valor "${value}" não é permitido.`);
  }
  return { kind: "value", value };
}

function errorOf(fieldId: string, code: FormErrorCode, message: string): FieldResult {
  return { kind: "error", errors: [{ fieldId, code, message }] };
}
