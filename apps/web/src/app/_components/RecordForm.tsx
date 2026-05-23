"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ComposedSchema, FormError } from "@bgreen/form-engine";
import {
  evaluateExpression,
  parseExpression,
  validateComposedFormValues,
  validateFormValues,
} from "@bgreen/form-engine";
import type { Field, FormSchema, LeafField, RecordTemplate } from "@bgreen/types";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { submitRecordAction } from "../actions";
import {
  type FormValues,
  type RowKeysByField,
  buildInitialRowKeys,
  buildInitialValues,
  isVisible,
  newSubRow,
} from "./record-form-helpers";

// Errors get a stable runtime key on receipt so React can reconcile them
// without falling back to array index.
interface KeyedError extends FormError {
  uiKey: string;
}

function attachKeys(errors: FormError[]): KeyedError[] {
  return errors.map((e) => ({ ...e, uiKey: crypto.randomUUID() }));
}

// V5.5: a sub-template the main template embeds. Rendered inline after
// the main rows in its own bordered section.
export interface SubTemplateSection {
  id: string;
  name: string;
  formSchema: FormSchema;
}

interface RecordFormProps {
  template: RecordTemplate;
  recordId: string | null;
  initialValues?: FormValues;
  readOnly?: boolean;
  initialStatus?: "draft" | "submitted" | "approved" | "changes_requested" | "rejected";
  // V5.5: ordered list of sub-templates this main template composes.
  // Pass an empty array (or omit) for non-composed templates.
  subTemplates?: SubTemplateSection[];
}

export function RecordForm({
  template,
  recordId,
  initialValues,
  readOnly = false,
  initialStatus,
  subTemplates = [],
}: RecordFormProps) {
  const router = useRouter();

  // The useState initialisers run once on mount, so it's safe to do the
  // splitting + per-sub build there without memoization. Stored shape:
  // { ...mainFields, subs?: { [subId]: {...subFields} } }
  const [values, setValues] = useState<FormValues>(() => {
    const split = splitComposedInitial(initialValues, subTemplates);
    return buildInitialValues(template.formSchema, split.main);
  });
  const [rowKeys, setRowKeys] = useState<RowKeysByField>(() => {
    const split = splitComposedInitial(initialValues, subTemplates);
    return buildInitialRowKeys(template.formSchema, split.main);
  });
  const [subValues, setSubValues] = useState<Record<string, FormValues>>(() => {
    const split = splitComposedInitial(initialValues, subTemplates);
    const out: Record<string, FormValues> = {};
    for (const sub of subTemplates) {
      out[sub.id] = buildInitialValues(sub.formSchema, split.subs[sub.id]);
    }
    return out;
  });
  const [subRowKeys, setSubRowKeys] = useState<Record<string, RowKeysByField>>(() => {
    const split = splitComposedInitial(initialValues, subTemplates);
    const out: Record<string, RowKeysByField> = {};
    for (const sub of subTemplates) {
      out[sub.id] = buildInitialRowKeys(sub.formSchema, split.subs[sub.id]);
    }
    return out;
  });

  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<KeyedError[]>([]);
  const [isPending, startTransition] = useTransition();

  const errorsByPath = useMemo(() => {
    const map = new Map<string, KeyedError[]>();
    for (const e of fieldErrors) {
      const list = map.get(e.fieldId) ?? [];
      list.push(e);
      map.set(e.fieldId, list);
    }
    return map;
  }, [fieldErrors]);

  // ---------- Top-level (main) state mutators ----------

  function setTopValue(fieldId: string, value: unknown) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  function setSubRowValue(parentId: string, idx: number, fieldId: string, value: unknown) {
    setValues((prev) => {
      const rows = Array.isArray(prev[parentId]) ? [...(prev[parentId] as FormValues[])] : [];
      const row = { ...(rows[idx] ?? {}), [fieldId]: value };
      rows[idx] = row;
      return { ...prev, [parentId]: rows };
    });
  }

  function addRepeatingRow(parentId: string, fields: LeafField[]) {
    setValues((prev) => {
      const rows = Array.isArray(prev[parentId]) ? [...(prev[parentId] as FormValues[])] : [];
      rows.push(newSubRow(fields));
      return { ...prev, [parentId]: rows };
    });
    setRowKeys((prev) => ({
      ...prev,
      [parentId]: [...(prev[parentId] ?? []), crypto.randomUUID()],
    }));
  }

  function removeRepeatingRow(parentId: string, idx: number) {
    setValues((prev) => {
      const rows = Array.isArray(prev[parentId]) ? [...(prev[parentId] as FormValues[])] : [];
      rows.splice(idx, 1);
      return { ...prev, [parentId]: rows };
    });
    setRowKeys((prev) => ({
      ...prev,
      [parentId]: (prev[parentId] ?? []).filter((_, i) => i !== idx),
    }));
  }

  // ---------- Sub-template scoped mutators ----------

  function setSubFieldValue(subId: string, fieldId: string, value: unknown) {
    setSubValues((prev) => ({
      ...prev,
      [subId]: { ...(prev[subId] ?? {}), [fieldId]: value },
    }));
  }

  function setSubRepeatingRowValue(
    subId: string,
    parentId: string,
    idx: number,
    fieldId: string,
    value: unknown,
  ) {
    setSubValues((prev) => {
      const scope = prev[subId] ?? {};
      const rows = Array.isArray(scope[parentId]) ? [...(scope[parentId] as FormValues[])] : [];
      const row = { ...(rows[idx] ?? {}), [fieldId]: value };
      rows[idx] = row;
      return { ...prev, [subId]: { ...scope, [parentId]: rows } };
    });
  }

  function addSubRepeatingRow(subId: string, parentId: string, fields: LeafField[]) {
    setSubValues((prev) => {
      const scope = prev[subId] ?? {};
      const rows = Array.isArray(scope[parentId]) ? [...(scope[parentId] as FormValues[])] : [];
      rows.push(newSubRow(fields));
      return { ...prev, [subId]: { ...scope, [parentId]: rows } };
    });
    setSubRowKeys((prev) => {
      const scope = prev[subId] ?? {};
      return {
        ...prev,
        [subId]: { ...scope, [parentId]: [...(scope[parentId] ?? []), crypto.randomUUID()] },
      };
    });
  }

  function removeSubRepeatingRow(subId: string, parentId: string, idx: number) {
    setSubValues((prev) => {
      const scope = prev[subId] ?? {};
      const rows = Array.isArray(scope[parentId]) ? [...(scope[parentId] as FormValues[])] : [];
      rows.splice(idx, 1);
      return { ...prev, [subId]: { ...scope, [parentId]: rows } };
    });
    setSubRowKeys((prev) => {
      const scope = prev[subId] ?? {};
      return {
        ...prev,
        [subId]: { ...scope, [parentId]: (scope[parentId] ?? []).filter((_, i) => i !== idx) },
      };
    });
  }

  // ---------- Submit ----------

  function submitWith(action: "save_draft" | "submit") {
    setServerError(null);
    setFieldErrors([]);

    const mode = action === "submit" ? "submit" : "draft";
    const combined: FormValues = { ...values };
    if (subTemplates.length > 0) combined.subs = subValues;

    const local =
      subTemplates.length > 0
        ? validateComposedFormValues(
            {
              main: template.formSchema,
              subTemplates: subTemplates.map((s) => ({ id: s.id, schema: s.formSchema })),
            } satisfies ComposedSchema,
            combined,
            { mode },
          )
        : validateFormValues(template.formSchema, values, { mode });

    if (!local.ok) {
      setFieldErrors(attachKeys(local.errors));
      setServerError("Corrija os campos assinalados antes de continuar.");
      return;
    }

    startTransition(async () => {
      const result = recordId
        ? await submitRecordAction({
            mode: "update",
            id: recordId,
            values: local.values,
            action,
          })
        : await submitRecordAction({
            mode: "create",
            templateId: template.id,
            values: local.values,
            asDraft: action === "save_draft",
          });

      if (result.ok) {
        if (action === "submit") {
          router.push(`/records/${result.id}`);
        } else if (!recordId) {
          router.push(`/records/${result.id}`);
        } else {
          router.refresh();
        }
        return;
      }

      setServerError(translateError(result.error));
      if (result.fieldErrors) setFieldErrors(attachKeys(result.fieldErrors));
    });
  }

  if (readOnly) {
    return (
      <ReadOnlyView
        template={template}
        values={values}
        subTemplates={subTemplates}
        subValues={subValues}
        status={initialStatus ?? "submitted"}
      />
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submitWith("submit");
      }}
      className="space-y-4"
    >
      {template.formSchema.rows.map((row) => (
        <fieldset key={row.id} className="space-y-3 rounded-lg border bg-card p-4">
          {row.label && <legend className="px-2 text-xs text-muted-foreground">{row.label}</legend>}
          {row.fields.map((field) => (
            <FieldInput
              key={field.id}
              field={field}
              scopeValues={values}
              value={values[field.id]}
              pathPrefix=""
              errorsByPath={errorsByPath}
              rowKeys={field.kind === "repeating" ? (rowKeys[field.id] ?? []) : undefined}
              onChange={(v) => setTopValue(field.id, v)}
              onSubChange={(idx, subId, v) => setSubRowValue(field.id, idx, subId, v)}
              onAddRow={() => field.kind === "repeating" && addRepeatingRow(field.id, field.fields)}
              onRemoveRow={(idx) => removeRepeatingRow(field.id, idx)}
            />
          ))}
        </fieldset>
      ))}

      {subTemplates.map((sub) => (
        <section
          key={sub.id}
          className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4"
        >
          <header>
            <h2 className="text-base font-semibold">{sub.name}</h2>
            <p className="text-xs text-muted-foreground">Secção do sub-modelo</p>
          </header>
          {sub.formSchema.rows.map((row) => (
            <fieldset key={row.id} className="space-y-3 rounded-md border bg-background p-3">
              {row.label && (
                <legend className="px-2 text-xs text-muted-foreground">{row.label}</legend>
              )}
              {row.fields.map((field) => (
                <FieldInput
                  key={field.id}
                  field={field}
                  scopeValues={subValues[sub.id] ?? {}}
                  value={subValues[sub.id]?.[field.id]}
                  pathPrefix={`subs.${sub.id}.`}
                  errorsByPath={errorsByPath}
                  rowKeys={
                    field.kind === "repeating" ? (subRowKeys[sub.id]?.[field.id] ?? []) : undefined
                  }
                  onChange={(v) => setSubFieldValue(sub.id, field.id, v)}
                  onSubChange={(idx, subFieldId, v) =>
                    setSubRepeatingRowValue(sub.id, field.id, idx, subFieldId, v)
                  }
                  onAddRow={() =>
                    field.kind === "repeating" && addSubRepeatingRow(sub.id, field.id, field.fields)
                  }
                  onRemoveRow={(idx) => removeSubRepeatingRow(sub.id, field.id, idx)}
                />
              ))}
            </fieldset>
          ))}
        </section>
      ))}

      {serverError && <Alert variant="destructive">{serverError}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => submitWith("save_draft")}
          disabled={isPending}
        >
          {isPending ? "A guardar…" : "Guardar rascunho"}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "A submeter…" : "Submeter"}
        </Button>
      </div>
    </form>
  );
}

// ---------- Field rendering (shared with sub-template scopes) ----------

interface FieldInputProps {
  field: Field | LeafField;
  scopeValues: FormValues;
  value: unknown;
  pathPrefix: string;
  errorsByPath: Map<string, KeyedError[]>;
  rowKeys?: string[];
  onChange: (v: unknown) => void;
  onSubChange?: (rowIdx: number, subFieldId: string, value: unknown) => void;
  onAddRow?: () => void;
  onRemoveRow?: (idx: number) => void;
}

function FieldInput({
  field,
  scopeValues,
  value,
  pathPrefix,
  errorsByPath,
  rowKeys,
  onChange,
  onSubChange,
  onAddRow,
  onRemoveRow,
}: FieldInputProps) {
  if (!isVisible(field, scopeValues)) return null;
  const path = `${pathPrefix}${field.id}`;
  const errors = errorsByPath.get(path) ?? [];

  return (
    <div className="space-y-1.5">
      <label htmlFor={path} className="block space-y-1">
        <span className="text-sm">
          {field.label}
          {field.required && field.kind !== "repeating" ? (
            <span className="text-destructive"> *</span>
          ) : null}
          {field.kind === "number" && field.unit && (
            <span className="text-xs text-muted-foreground"> ({field.unit})</span>
          )}
        </span>
        {field.description && (
          <span className="block text-xs text-muted-foreground">{field.description}</span>
        )}
        <FieldControl
          field={field}
          path={path}
          value={value}
          scopeValues={scopeValues}
          onChange={onChange}
          errorsByPath={errorsByPath}
          rowKeys={rowKeys}
          onSubChange={onSubChange}
          onAddRow={onAddRow}
          onRemoveRow={onRemoveRow}
        />
      </label>
      {errors.map((e) => (
        <p key={e.uiKey} className="text-xs text-destructive" role="alert">
          {e.message}
        </p>
      ))}
    </div>
  );
}

interface FieldControlProps {
  field: Field | LeafField;
  path: string;
  value: unknown;
  scopeValues: FormValues;
  errorsByPath: Map<string, KeyedError[]>;
  rowKeys?: string[];
  onChange: (v: unknown) => void;
  onSubChange?: (rowIdx: number, subFieldId: string, value: unknown) => void;
  onAddRow?: () => void;
  onRemoveRow?: (idx: number) => void;
}

function FieldControl({
  field,
  path,
  value,
  scopeValues,
  errorsByPath,
  rowKeys,
  onChange,
  onSubChange,
  onAddRow,
  onRemoveRow,
}: FieldControlProps) {
  switch (field.kind) {
    case "text":
      return (
        <Input
          id={path}
          value={typeof value === "string" ? value : ""}
          maxLength={field.maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "number":
      return (
        <Input
          id={path}
          inputMode="decimal"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "date":
      return (
        <Input
          id={path}
          type="date"
          value={typeof value === "string" ? value : ""}
          min={field.min}
          max={field.max}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "select":
      return (
        <Select
          id={path}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— escolha —</option>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      );
    case "multi_select": {
      const selected = new Set(Array.isArray(value) ? (value as string[]) : []);
      return (
        <div className="space-y-1.5">
          {field.options.map((opt) => (
            <label key={opt.value} className="inline-flex w-full items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.has(opt.value)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(opt.value);
                  else next.delete(opt.value);
                  onChange(Array.from(next));
                }}
                className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
              />
              {opt.label}
            </label>
          ))}
        </div>
      );
    }
    case "calculated": {
      const display = computeCalculatedDisplay(field.expression, scopeValues);
      return (
        <output
          id={path}
          className={cn(
            "block rounded-md border bg-muted px-3 py-2 font-mono text-sm",
            display.kind === "value" ? "text-primary" : "text-muted-foreground",
          )}
        >
          {display.kind === "value"
            ? `${formatNumber(display.value)}${field.unit ? ` ${field.unit}` : ""}`
            : display.kind === "empty"
              ? "—"
              : display.message}
        </output>
      );
    }
    case "repeating": {
      const rows = Array.isArray(value) ? (value as FormValues[]) : [];
      const keys = rowKeys ?? [];
      return (
        <div className="space-y-2">
          {rows.map((row, idx) => (
            <RepeatingRow
              key={keys[idx] ?? `${path}-fallback-${idx}`}
              field={field}
              row={row}
              idx={idx}
              path={path}
              errorsByPath={errorsByPath}
              onSubChange={(subId, v) => onSubChange?.(idx, subId, v)}
              onRemove={() => onRemoveRow?.(idx)}
            />
          ))}
          {(field.maxRows === undefined || rows.length < field.maxRows) && (
            <Button type="button" variant="outline" size="sm" onClick={onAddRow}>
              + Adicionar {field.rowLabel.toLowerCase()}
            </Button>
          )}
        </div>
      );
    }
  }
}

interface RepeatingRowProps {
  field: { rowLabel: string; fields: LeafField[] };
  row: FormValues;
  idx: number;
  path: string;
  errorsByPath: Map<string, KeyedError[]>;
  onSubChange: (subFieldId: string, value: unknown) => void;
  onRemove: () => void;
}

function RepeatingRow({
  field,
  row,
  idx,
  path,
  errorsByPath,
  onSubChange,
  onRemove,
}: RepeatingRowProps) {
  return (
    <fieldset className="space-y-2 rounded-md border bg-muted/40 p-3">
      <legend className="px-1 text-xs text-muted-foreground">
        {field.rowLabel} {idx + 1}
      </legend>
      {field.fields.map((sub) => (
        <FieldInput
          key={sub.id}
          field={sub}
          scopeValues={row}
          value={row[sub.id]}
          pathPrefix={`${path}[${idx}].`}
          errorsByPath={errorsByPath}
          onChange={(v) => onSubChange(sub.id, v)}
        />
      ))}
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          Remover linha
        </Button>
      </div>
    </fieldset>
  );
}

// ---------- Read-only rendering ----------

function ReadOnlyView({
  template,
  values,
  subTemplates,
  subValues,
  status,
}: {
  template: RecordTemplate;
  values: FormValues;
  subTemplates: SubTemplateSection[];
  subValues: Record<string, FormValues>;
  status: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Estado: {statusLabel[status] ?? status}</p>
      {template.formSchema.rows.map((row) => (
        <section key={row.id} className="space-y-2 border-t pt-3 first:border-t-0 first:pt-0">
          {row.label && <h3 className="text-sm font-medium">{row.label}</h3>}
          <dl className="space-y-1.5">
            {row.fields.map((f) => (
              <ReadOnlyField key={f.id} field={f} value={values[f.id]} />
            ))}
          </dl>
        </section>
      ))}
      {subTemplates.map((sub) => (
        <section
          key={sub.id}
          className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3"
        >
          <h3 className="text-sm font-semibold">{sub.name}</h3>
          {sub.formSchema.rows.map((row) => (
            <div key={row.id} className="space-y-1">
              {row.label && <h4 className="text-xs font-medium">{row.label}</h4>}
              <dl className="space-y-1.5">
                {row.fields.map((f) => (
                  <ReadOnlyField key={f.id} field={f} value={subValues[sub.id]?.[f.id]} />
                ))}
              </dl>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function ReadOnlyField({ field, value }: { field: Field | LeafField; value: unknown }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2 text-sm">
      <dt className="font-medium">{field.label}:</dt>
      <dd className="text-muted-foreground">{renderValue(field, value)}</dd>
    </div>
  );
}

function renderValue(field: Field | LeafField, value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  switch (field.kind) {
    case "select":
      return field.options.find((o) => o.value === value)?.label ?? String(value);
    case "multi_select":
      if (!Array.isArray(value)) return "—";
      if (value.length === 0) return "—";
      return value
        .map((v) => field.options.find((o) => o.value === v)?.label ?? String(v))
        .join(", ");
    case "number":
      return field.unit ? `${value} ${field.unit}` : String(value);
    case "calculated":
      if (typeof value !== "number") return "—";
      return field.unit ? `${formatNumber(value)} ${field.unit}` : formatNumber(value);
    case "repeating":
      if (!Array.isArray(value) || value.length === 0) return "—";
      return `${value.length} ${value.length === 1 ? "linha" : "linhas"}`;
    default:
      return String(value);
  }
}

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  submitted: "Submetido",
  approved: "Aprovado",
  changes_requested: "Alterações pedidas",
  rejected: "Rejeitado",
};

type CalculatedDisplay =
  | { kind: "value"; value: number }
  | { kind: "empty" }
  | { kind: "error"; message: string };

function computeCalculatedDisplay(expression: string, scope: FormValues): CalculatedDisplay {
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

function formatNumber(value: number): string {
  return value.toLocaleString("pt-PT", { maximumFractionDigits: 4 });
}

function translateError(code: string): string {
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

// Splits a stored ComposedRecordValues blob into the main values map and a
// per-sub-template values map, dropping any sub-template ids the caller
// didn't include in `subTemplates` (e.g., composition changed after the
// record was first saved). `subs` is removed from `main` so the main
// builder doesn't treat it as an unknown field.
function splitComposedInitial(
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
