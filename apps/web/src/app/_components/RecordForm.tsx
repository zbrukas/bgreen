"use client";

import type { FormError } from "@bgreen/form-engine";
import { validateFormValues } from "@bgreen/form-engine";
import type { Field, LeafField, RecordTemplate } from "@bgreen/types";
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

interface RecordFormProps {
  template: RecordTemplate;
  recordId: string | null;
  initialValues?: FormValues;
  readOnly?: boolean;
  initialStatus?: "draft" | "submitted" | "approved" | "changes_requested" | "rejected";
}

export function RecordForm({
  template,
  recordId,
  initialValues,
  readOnly = false,
  initialStatus,
}: RecordFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() =>
    buildInitialValues(template.formSchema, initialValues),
  );
  const [rowKeys, setRowKeys] = useState<RowKeysByField>(() =>
    buildInitialRowKeys(template.formSchema, initialValues),
  );
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

  function setTopValue(fieldId: string, value: unknown) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  function setSubValue(parentId: string, idx: number, fieldId: string, value: unknown) {
    setValues((prev) => {
      const rows = Array.isArray(prev[parentId]) ? [...(prev[parentId] as FormValues[])] : [];
      const row = { ...(rows[idx] ?? {}), [fieldId]: value };
      rows[idx] = row;
      return { ...prev, [parentId]: rows };
    });
  }

  function addSubRow(parentId: string, fields: LeafField[]) {
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

  function removeSubRow(parentId: string, idx: number) {
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

  function submitWith(action: "save_draft" | "submit") {
    setServerError(null);
    setFieldErrors([]);

    // Client-side preview validation. Server is authoritative.
    const mode = action === "submit" ? "submit" : "draft";
    const local = validateFormValues(template.formSchema, values, { mode });
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
          // First save-as-draft → land on the draft's edit page.
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
      <ReadOnlyView template={template} values={values} status={initialStatus ?? "submitted"} />
    );
  }

  const draftDisabled = isPending;
  const submitDisabled = isPending;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submitWith("submit");
      }}
      style={{ display: "grid", gap: "1rem", maxWidth: 720, fontFamily: "system-ui, sans-serif" }}
    >
      {template.formSchema.rows.map((row) => (
        <fieldset
          key={row.id}
          style={{
            border: "1px solid #cfd8dc",
            borderRadius: "0.25rem",
            padding: "0.75rem 1rem",
            display: "grid",
            gap: "0.75rem",
            margin: 0,
          }}
        >
          {row.label && (
            <legend style={{ padding: "0 0.5rem", color: "#444", fontSize: "0.9rem" }}>
              {row.label}
            </legend>
          )}
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
              onSubChange={(idx, subId, v) => setSubValue(field.id, idx, subId, v)}
              onAddRow={() => field.kind === "repeating" && addSubRow(field.id, field.fields)}
              onRemoveRow={(idx) => removeSubRow(field.id, idx)}
            />
          ))}
        </fieldset>
      ))}

      {serverError && (
        <p style={{ margin: 0, color: "#b00020" }} role="alert">
          {serverError}
        </p>
      )}

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => submitWith("save_draft")}
          disabled={draftDisabled}
          style={{ padding: "0.6rem 1rem", fontSize: "1rem" }}
        >
          {isPending ? "A guardar…" : "Guardar rascunho"}
        </button>
        <button
          type="submit"
          disabled={submitDisabled}
          style={{
            padding: "0.6rem 1rem",
            fontSize: "1rem",
            background: "#1f7a3d",
            color: "white",
            border: "none",
            borderRadius: "0.25rem",
          }}
        >
          {isPending ? "A submeter…" : "Submeter"}
        </button>
      </div>
    </form>
  );
}

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
    <div style={{ display: "grid", gap: "0.3rem" }}>
      <label htmlFor={path} style={{ display: "grid", gap: "0.25rem" }}>
        <span style={{ fontSize: "0.95rem" }}>
          {field.label}
          {field.required && field.kind !== "repeating" ? (
            <span style={{ color: "#b00020" }}> *</span>
          ) : null}
          {field.kind === "number" && field.unit && (
            <span style={{ color: "#666", fontSize: "0.85rem" }}> ({field.unit})</span>
          )}
        </span>
        {field.description && (
          <span style={{ fontSize: "0.8rem", color: "#555" }}>{field.description}</span>
        )}
        <FieldControl
          field={field}
          path={path}
          value={value}
          onChange={onChange}
          errorsByPath={errorsByPath}
          rowKeys={rowKeys}
          onSubChange={onSubChange}
          onAddRow={onAddRow}
          onRemoveRow={onRemoveRow}
        />
      </label>
      {errors.map((e) => (
        <p key={e.uiKey} style={{ margin: 0, color: "#b00020", fontSize: "0.85rem" }} role="alert">
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
        <input
          id={path}
          type="text"
          value={typeof value === "string" ? value : ""}
          maxLength={field.maxLength}
          onChange={(e) => onChange(e.target.value)}
          style={{ padding: "0.4rem", fontSize: "0.95rem" }}
        />
      );
    case "number":
      return (
        <input
          id={path}
          type="text"
          inputMode="decimal"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
          style={{ padding: "0.4rem", fontSize: "0.95rem" }}
        />
      );
    case "date":
      return (
        <input
          id={path}
          type="date"
          value={typeof value === "string" ? value : ""}
          min={field.min}
          max={field.max}
          onChange={(e) => onChange(e.target.value)}
          style={{ padding: "0.4rem", fontSize: "0.95rem" }}
        />
      );
    case "select":
      return (
        <select
          id={path}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          style={{ padding: "0.4rem", fontSize: "0.95rem" }}
        >
          <option value="">— escolha —</option>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    case "multi_select": {
      const selected = new Set(Array.isArray(value) ? (value as string[]) : []);
      return (
        <div style={{ display: "grid", gap: "0.2rem" }}>
          {field.options.map((opt) => (
            <label
              key={opt.value}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.9rem",
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(opt.value)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(opt.value);
                  else next.delete(opt.value);
                  onChange(Array.from(next));
                }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      );
    }
    case "repeating": {
      const rows = Array.isArray(value) ? (value as FormValues[]) : [];
      const keys = rowKeys ?? [];
      return (
        <div style={{ display: "grid", gap: "0.5rem" }}>
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
            <button
              type="button"
              onClick={onAddRow}
              style={{ justifySelf: "start", padding: "0.35rem 0.7rem", fontSize: "0.85rem" }}
            >
              + Adicionar {field.rowLabel.toLowerCase()}
            </button>
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
    <fieldset
      style={{
        border: "1px solid #b0bec5",
        borderRadius: "0.25rem",
        padding: "0.5rem 0.75rem",
        display: "grid",
        gap: "0.5rem",
        margin: 0,
        background: "#f5f8fa",
      }}
    >
      <legend style={{ padding: "0 0.4rem", color: "#444", fontSize: "0.85rem" }}>
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
      <button
        type="button"
        onClick={onRemove}
        style={{ justifySelf: "end", padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
      >
        Remover linha
      </button>
    </fieldset>
  );
}

function ReadOnlyView({
  template,
  values,
  status,
}: {
  template: RecordTemplate;
  values: FormValues;
  status: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: "0.75rem",
        fontFamily: "system-ui, sans-serif",
        maxWidth: 720,
      }}
    >
      <p style={{ margin: 0, color: "#555", fontSize: "0.9rem" }}>
        Estado: {statusLabel[status] ?? status}
      </p>
      {template.formSchema.rows.map((row) => (
        <section key={row.id} style={{ borderTop: "1px solid #eee", paddingTop: "0.5rem" }}>
          {row.label && <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>{row.label}</h3>}
          {row.fields.map((f) => (
            <ReadOnlyField key={f.id} field={f} value={values[f.id]} />
          ))}
        </section>
      ))}
    </div>
  );
}

function ReadOnlyField({ field, value }: { field: Field | LeafField; value: unknown }) {
  return (
    <div style={{ marginBottom: "0.4rem" }}>
      <strong style={{ fontSize: "0.9rem" }}>{field.label}: </strong>
      <span style={{ fontSize: "0.9rem", color: "#333" }}>{renderValue(field, value)}</span>
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
