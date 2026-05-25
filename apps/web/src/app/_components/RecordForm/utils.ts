// Shared utilities used by RecordForm's internal components. Not React
// components themselves — kept out of *.tsx files so the one-export-per-
// file rule applies to component files only.

import type { FormError } from "@bgreen/form-engine";
import { evaluateExpression, parseExpression } from "@bgreen/form-engine";
import type { FormSchema } from "@bgreen/types";
import type { FormValues } from "./record-form-helpers";

// Errors get a stable runtime key on receipt so React can reconcile them
// without falling back to array index.
export interface KeyedError extends FormError {
  uiKey: string;
}

export function attachKeys(errors: FormError[]): KeyedError[] {
  return errors.map((e) => ({ ...e, uiKey: crypto.randomUUID() }));
}

// V5.5: a sub-template the main template embeds. Rendered inline after
// the main rows in its own bordered section.
export interface SubTemplateSection {
  id: string;
  name: string;
  formSchema: FormSchema;
}

export type CalculatedDisplay =
  | { kind: "value"; value: number }
  | { kind: "empty" }
  | { kind: "error"; message: string };

export function computeCalculatedDisplay(
  expression: string,
  scope: FormValues,
): CalculatedDisplay {
  const parsed = parseExpression(expression);
  if (!parsed.ok) {
    return { kind: "error", message: "Expressão inválida" };
  }
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

export function translateError(code: string): string {
  switch (code) {
    case "validation_failed":
      return "Corrija os campos assinalados antes de continuar.";
    case "template_not_found":
      return "Modelo não encontrado.";
    case "template_not_published":
      return "Este modelo ainda não foi publicado.";
    case "record_not_found":
      return "Registo não encontrado.";
    case "forbidden":
      return "Sem permissão para alterar este registo.";
    case "not_editable":
      return "Este registo já não pode ser editado.";
    case "not_signed_in":
      return "Sessão expirada. Inicie sessão novamente.";
    case "no_active_org":
      return "Selecione uma organização activa.";
    case "network_error":
      return "Erro de rede. Tente novamente.";
    default:
      return `Erro: ${code}`;
  }
}

export const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  submitted: "Submetido",
  approved: "Aprovado",
  changes_requested: "Alterações pedidas",
  rejected: "Rejeitado",
};

// Splits a stored ComposedRecordValues blob into the main values map and a
// per-sub-template values map, dropping any sub-template ids the caller
// didn't include in `subTemplates` (e.g., composition changed after the
// record was first saved). `subs` is removed from `main` so the main
// builder doesn't treat it as an unknown field.
export function splitComposedInitial(
  stored: FormValues | undefined,
  subTemplates: ReadonlyArray<SubTemplateSection>,
): { main: FormValues | undefined; subs: Record<string, FormValues | undefined> } {
  if (!stored) return { main: undefined, subs: {} };
  const { subs: rawSubs, ...main } = stored;
  const subs: Record<string, FormValues | undefined> = {};
  const allowed = new Set(subTemplates.map((s) => s.id));
  if (rawSubs && typeof rawSubs === "object" && !Array.isArray(rawSubs)) {
    for (const [key, val] of Object.entries(rawSubs as Record<string, unknown>)) {
      if (allowed.has(key) && val && typeof val === "object" && !Array.isArray(val)) {
        subs[key] = val as FormValues;
      }
    }
  }
  return { main, subs };
}
