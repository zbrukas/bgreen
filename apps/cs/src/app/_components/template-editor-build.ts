// Pure helpers shared by TemplateEditor: the in-memory editor model + the
// builder that converts it to a FormSchema for the server action.

import { parseExpression } from "@bgreen/form-engine";
import type { FormSchema, LeafField, ShowIfPredicate, SourceMapping } from "@bgreen/types";

export type EditorFieldKind =
  | "text"
  | "number"
  | "date"
  | "select"
  | "multi_select"
  | "calculated"
  | "repeating";
export type EditorLeafKind = Exclude<EditorFieldKind, "repeating">;

export interface EditorShowIfPredicate {
  uiKey: string;
  fieldId: string;
  equals: string;
}

export interface EditorSourceMapping {
  sourceTemplateId: string;
  sourceFieldId: string;
}

export interface EditorField {
  uiKey: string;
  id: string;
  label: string;
  kind: EditorFieldKind;
  required: boolean;
  maxLength: string;
  unit: string;
  min: string;
  max: string;
  options: Array<{ value: string; label: string }>;
  minSelected: string;
  maxSelected: string;
  rowLabel: string;
  minRows: string;
  maxRows: string;
  subFields: EditorField[];
  showIf: EditorShowIfPredicate[];
  expression: string;
  sourceMapping: EditorSourceMapping | null;
}

export interface EditorRow {
  uiKey: string;
  label: string;
  fields: EditorField[];
}

const ID_PATTERN = /^[a-z][a-z0-9_]*$/;

export function newField(): EditorField {
  return {
    uiKey: crypto.randomUUID(),
    id: "",
    label: "",
    kind: "text",
    required: false,
    maxLength: "",
    unit: "",
    min: "",
    max: "",
    options: [],
    minSelected: "",
    maxSelected: "",
    rowLabel: "",
    minRows: "",
    maxRows: "",
    subFields: [],
    showIf: [],
    expression: "",
    sourceMapping: null,
  };
}

export function newRow(): EditorRow {
  return { uiKey: crypto.randomUUID(), label: "", fields: [newField()] };
}

export function newShowIf(): EditorShowIfPredicate {
  return { uiKey: crypto.randomUUID(), fieldId: "", equals: "" };
}

export function isFieldEmpty(f: EditorField): boolean {
  return (
    f.id.trim() === "" &&
    f.label.trim() === "" &&
    f.maxLength.trim() === "" &&
    f.unit.trim() === "" &&
    f.min.trim() === "" &&
    f.max.trim() === "" &&
    f.options.length === 0 &&
    f.minSelected.trim() === "" &&
    f.maxSelected.trim() === "" &&
    f.rowLabel.trim() === "" &&
    f.minRows.trim() === "" &&
    f.maxRows.trim() === "" &&
    f.subFields.length === 0 &&
    f.showIf.length === 0 &&
    f.expression.trim() === "" &&
    f.sourceMapping === null
  );
}

export interface BuildError {
  message: string;
}

export function buildFormSchema(rows: EditorRow[]): { ok: true; schema: FormSchema } | BuildError {
  const builtRows: FormSchema["rows"] = [];

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    if (!row) continue;
    const builtFields: FormSchema["rows"][number]["fields"] = [];
    const scopeIds = new Set<string>();

    for (let fieldIdx = 0; fieldIdx < row.fields.length; fieldIdx++) {
      const f = row.fields[fieldIdx];
      if (!f) continue;
      if (isFieldEmpty(f)) continue;
      const where = `Linha ${rowIdx + 1}, campo ${fieldIdx + 1}`;
      const built = buildField(f, where, scopeIds, /* allowRepeating */ true);
      if ("message" in built) return built;
      scopeIds.add(built.field.id);
      builtFields.push(built.field);
    }

    if (builtFields.length > 0) {
      builtRows.push({
        id: crypto.randomUUID(),
        label: row.label.trim() || undefined,
        fields: builtFields,
      });
    }
  }

  if (builtRows.length === 0) {
    return { message: "Adicione pelo menos um campo com identificador e etiqueta." };
  }
  return { ok: true, schema: { version: 1, rows: builtRows } };
}

function buildField(
  f: EditorField,
  where: string,
  scopeIds: Set<string>,
  allowRepeating: boolean,
): { field: FormSchema["rows"][number]["fields"][number] } | BuildError {
  const id = f.id.trim();
  if (!ID_PATTERN.test(id)) {
    return {
      message: `${where}: identificador "${f.id}" inválido. Use letras minúsculas, dígitos e underscore (ex.: kwh_consumo).`,
    };
  }
  if (scopeIds.has(id)) {
    return { message: `${where}: identificador "${id}" está duplicado.` };
  }
  const label = f.label.trim();
  if (!label) {
    return { message: `${where}: indique uma etiqueta para "${id}".` };
  }

  const showIf = buildShowIf(f.showIf, scopeIds, where, id);
  if (showIf && "message" in showIf) return showIf;

  const mapping = buildSourceMapping(f.sourceMapping, where, id);
  if (mapping && "message" in mapping) return mapping;

  const base = {
    id,
    label,
    required: f.required,
    ...(showIf && showIf.value.length > 0 ? { showIf: showIf.value } : {}),
    ...(mapping?.value ? { sourceMapping: mapping.value } : {}),
  };

  switch (f.kind) {
    case "text":
      return {
        field: {
          ...base,
          kind: "text",
          ...(f.maxLength.trim() ? { maxLength: Number(f.maxLength) } : {}),
        },
      };
    case "number":
      return {
        field: {
          ...base,
          kind: "number",
          ...(f.unit.trim() ? { unit: f.unit.trim() } : {}),
          ...(f.min.trim() ? { min: Number(f.min) } : {}),
          ...(f.max.trim() ? { max: Number(f.max) } : {}),
        },
      };
    case "date":
      return {
        field: {
          ...base,
          kind: "date",
          ...(f.min.trim() ? { min: f.min.trim() } : {}),
          ...(f.max.trim() ? { max: f.max.trim() } : {}),
        },
      };
    case "select": {
      const opts = cleanOptions(f.options);
      if (opts.length === 0) {
        return { message: `${where} ("${id}"): adicione pelo menos uma opção.` };
      }
      return { field: { ...base, kind: "select", options: opts } };
    }
    case "multi_select": {
      const opts = cleanOptions(f.options);
      if (opts.length === 0) {
        return { message: `${where} ("${id}"): adicione pelo menos uma opção.` };
      }
      return {
        field: {
          ...base,
          kind: "multi_select",
          options: opts,
          ...(f.minSelected.trim() ? { minSelected: Number(f.minSelected) } : {}),
          ...(f.maxSelected.trim() ? { maxSelected: Number(f.maxSelected) } : {}),
        },
      };
    }
    case "calculated": {
      const expression = f.expression.trim();
      if (!expression) {
        return { message: `${where} ("${id}"): indique a expressão a calcular.` };
      }
      const parsed = parseExpression(expression);
      if (!parsed.ok) {
        return {
          message: `${where} ("${id}"): expressão inválida — ${parsed.message}`,
        };
      }
      return {
        field: {
          ...base,
          kind: "calculated",
          expression,
          ...(f.unit.trim() ? { unit: f.unit.trim() } : {}),
        },
      };
    }
    case "repeating": {
      if (!allowRepeating) {
        return {
          message: `${where} ("${id}"): linhas repetidas só são permitidas ao nível superior.`,
        };
      }
      const rowLabel = f.rowLabel.trim();
      if (!rowLabel) {
        return {
          message: `${where} ("${id}"): indique a etiqueta de cada linha (ex.: "Veículo").`,
        };
      }
      if (f.subFields.length === 0) {
        return { message: `${where} ("${id}"): adicione pelo menos um campo dentro da linha.` };
      }
      const subIds = new Set<string>();
      const subBuilt: LeafField[] = [];
      for (let i = 0; i < f.subFields.length; i++) {
        const sub = f.subFields[i];
        if (!sub) continue;
        if (isFieldEmpty(sub)) continue;
        const subWhere = `${where} → sub-campo ${i + 1}`;
        const result = buildField(sub, subWhere, subIds, /* allowRepeating */ false);
        if ("message" in result) return result;
        // result.field is a top-level Field, but with allowRepeating=false it
        // cannot be a RepeatingField — narrow to LeafField for the type-system.
        if (result.field.kind === "repeating") {
          return { message: `${subWhere}: linhas repetidas não podem ser aninhadas.` };
        }
        subIds.add(result.field.id);
        subBuilt.push(result.field);
      }
      if (subBuilt.length === 0) {
        return {
          message: `${where} ("${id}"): adicione pelo menos um campo válido dentro da linha.`,
        };
      }
      return {
        field: {
          ...base,
          kind: "repeating",
          rowLabel,
          ...(f.minRows.trim() ? { minRows: Number(f.minRows) } : {}),
          ...(f.maxRows.trim() ? { maxRows: Number(f.maxRows) } : {}),
          fields: subBuilt,
        },
      };
    }
  }
}

function cleanOptions(opts: Array<{ value: string; label: string }>) {
  return opts
    .map((o) => ({ value: o.value.trim(), label: o.label.trim() }))
    .filter((o) => o.value && o.label);
}

function buildShowIf(
  predicates: EditorShowIfPredicate[],
  scopeIds: Set<string>,
  where: string,
  selfId: string,
): { value: ShowIfPredicate[] } | BuildError | null {
  if (predicates.length === 0) return null;
  const out: ShowIfPredicate[] = [];
  for (const p of predicates) {
    const target = p.fieldId.trim();
    const equals = p.equals.trim();
    if (!target && !equals) continue;
    if (!target) {
      return { message: `${where} ("${selfId}"): seleccione o campo de referência da condição.` };
    }
    if (target === selfId) {
      return {
        message: `${where} ("${selfId}"): a condição não pode referenciar o próprio campo.`,
      };
    }
    if (!scopeIds.has(target)) {
      return {
        message: `${where} ("${selfId}"): a condição refere "${target}" que ainda não foi definido (deve aparecer antes neste âmbito).`,
      };
    }
    if (!equals) {
      return { message: `${where} ("${selfId}"): indique o valor a comparar na condição.` };
    }
    out.push({ fieldId: target, equals });
  }
  return { value: out };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildSourceMapping(
  mapping: EditorSourceMapping | null,
  where: string,
  selfId: string,
): { value: SourceMapping | null } | BuildError | null {
  if (!mapping) return null;
  const sourceTemplateId = mapping.sourceTemplateId.trim();
  const sourceFieldId = mapping.sourceFieldId.trim();
  if (!sourceTemplateId && !sourceFieldId) return { value: null };
  if (!sourceTemplateId) {
    return { message: `${where} ("${selfId}"): escolha o modelo de origem do pré-preenchimento.` };
  }
  if (!UUID_PATTERN.test(sourceTemplateId)) {
    return { message: `${where} ("${selfId}"): modelo de origem inválido.` };
  }
  if (!sourceFieldId) {
    return { message: `${where} ("${selfId}"): escolha o campo de origem do pré-preenchimento.` };
  }
  return {
    value: {
      sourceTemplateId,
      sourceFieldId,
      strategy: "latest_submitted",
    },
  };
}
