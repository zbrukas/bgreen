// Composed form validator — handles a main FormSchema plus an ordered
// list of sub-templates that the main template embeds (V5.5). Each
// sub-template owns its own FormSchema and is validated independently;
// its values live under `values.subs[<subTemplateId>]`. Field ids may
// repeat across sub-templates without collision because each sub is
// validated in its own scope.

import type { FormSchema, RecordValues } from "@bgreen/types";
import {
  type FormError,
  type ValidateOptions,
  type ValidationResult,
  validateFormValues,
} from "./interpreter";

export interface ComposedSchema {
  main: FormSchema;
  // Ordered list — same order as record_templates.composedSubTemplateIds.
  // Validation runs in this order so errors come back in stable order too.
  subTemplates: ReadonlyArray<{ id: string; schema: FormSchema }>;
}

export type ComposedRecordValues = RecordValues & {
  subs?: Record<string, RecordValues>;
};

export type ComposedValidationResult =
  | { ok: true; values: ComposedRecordValues }
  | { ok: false; errors: FormError[] };

export function validateComposedFormValues(
  composed: ComposedSchema,
  raw: unknown,
  options: ValidateOptions = {},
): ComposedValidationResult {
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      errors: [{ fieldId: "", code: "wrong_type", message: "Expected an object of field values." }],
    };
  }

  // Carve `subs` out of the input before validating the main schema —
  // otherwise the interpreter's unknown_field guard would flag it.
  const { subs: rawSubs, ...mainRaw } = raw;

  const errors: FormError[] = [];
  const mainResult = validateFormValues(composed.main, mainRaw, options);
  const mainValues: RecordValues = mainResult.ok ? mainResult.values : {};
  if (!mainResult.ok) errors.push(...mainResult.errors);

  // `subs` may be absent entirely (a fresh draft) — treat as `{}` so each
  // sub-template still runs its own required/empty checks under `mode`.
  let subsInput: Record<string, unknown> = {};
  if (rawSubs !== undefined) {
    if (!isPlainObject(rawSubs)) {
      errors.push({
        fieldId: "subs",
        code: "wrong_type",
        message: "Expected an object keyed by sub-template id.",
      });
    } else {
      subsInput = rawSubs as Record<string, unknown>;
    }
  }

  const declaredSubIds = new Set(composed.subTemplates.map((s) => s.id));
  const subOut: Record<string, RecordValues> = {};

  for (const sub of composed.subTemplates) {
    const slot = subsInput[sub.id];
    const subRaw = slot === undefined ? {} : slot;
    const subResult = validateFormValues(sub.schema, subRaw, options);
    if (subResult.ok) {
      subOut[sub.id] = subResult.values;
    } else {
      // Prefix every sub-template error so the UI can route the message
      // to the right section.
      for (const err of subResult.errors) {
        errors.push({
          ...err,
          fieldId: err.fieldId === "" ? `subs.${sub.id}` : `subs.${sub.id}.${err.fieldId}`,
        });
      }
    }
  }

  // Flag unknown sub ids in the input (a client tried to submit values
  // for a sub-template that isn't part of this composition).
  for (const key of Object.keys(subsInput)) {
    if (!declaredSubIds.has(key)) {
      errors.push({
        fieldId: `subs.${key}`,
        code: "unknown_field",
        message: `Sub-template "${key}" is not part of this composition.`,
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  const out: ComposedRecordValues = { ...mainValues };
  if (composed.subTemplates.length > 0) out.subs = subOut;
  return { ok: true, values: out };
}

// `validateFormValues` allows passing a plain FormSchema for the
// no-composition case. This helper is just a thin alias so callers can
// reach for the same import either way.
export function validateAnyFormValues(
  schemaOrComposed: FormSchema | ComposedSchema,
  raw: unknown,
  options: ValidateOptions = {},
): ValidationResult | ComposedValidationResult {
  if ("main" in schemaOrComposed) {
    return validateComposedFormValues(schemaOrComposed, raw, options);
  }
  return validateFormValues(schemaOrComposed, raw, options);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
