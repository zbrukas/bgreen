"use client";

import { Add, TrashCan } from "@carbon/icons-react";
import {
  Button,
  Checkbox,
  InlineNotification,
  Modal,
  Select,
  SelectItem,
  TextInput,
} from "@carbon/react";
import type { Field, FormSchema, LeafField } from "@bgreen/types";
import { useState } from "react";
import {
  type PreviewValues,
  buildInitialValues,
  computeCalculatedDisplay,
  formatNumber,
  isVisible,
  newRepeatingRow,
} from "./preview-helpers";

export interface PreviewSubTemplate {
  id: string;
  name: string;
  formSchema: FormSchema;
}

interface TemplatePreviewProps {
  open: boolean;
  onClose: () => void;
  templateName: string;
  formSchema: FormSchema;
  subTemplates?: PreviewSubTemplate[];
}

export function TemplatePreview({
  open,
  onClose,
  templateName,
  formSchema,
  subTemplates = [],
}: TemplatePreviewProps) {
  return (
    <Modal
      open={open}
      onRequestClose={onClose}
      modalHeading={`Pré-visualização: ${templateName.trim() || "(sem nome)"}`}
      modalLabel="Modelo de registo"
      passiveModal
      size="lg"
    >
      {open && (
        <PreviewBody key={previewKey(formSchema, subTemplates)} formSchema={formSchema} subTemplates={subTemplates} />
      )}
    </Modal>
  );
}

// Stable identity per (schema + sub-template ids). Forces a fresh state
// reset when the underlying schema changes between openings.
function previewKey(formSchema: FormSchema, subTemplates: PreviewSubTemplate[]): string {
  const subIds = subTemplates.map((s) => s.id).join("|");
  return `${formSchema.rows.length}:${subIds}:${JSON.stringify(formSchema.rows.map((r) => r.id))}`;
}

function PreviewBody({
  formSchema,
  subTemplates,
}: {
  formSchema: FormSchema;
  subTemplates: PreviewSubTemplate[];
}) {
  const [values, setValues] = useState<PreviewValues>(() => buildInitialValues(formSchema));
  const [subValues, setSubValues] = useState<Record<string, PreviewValues>>(() => {
    const out: Record<string, PreviewValues> = {};
    for (const sub of subTemplates) out[sub.id] = buildInitialValues(sub.formSchema);
    return out;
  });

  function setTop(fieldId: string, value: unknown) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  function setSub(subId: string, fieldId: string, value: unknown) {
    setSubValues((prev) => ({ ...prev, [subId]: { ...(prev[subId] ?? {}), [fieldId]: value } }));
  }

  function setTopRow(parentId: string, idx: number, fieldId: string, value: unknown) {
    setValues((prev) => {
      const rows = Array.isArray(prev[parentId]) ? [...(prev[parentId] as PreviewValues[])] : [];
      rows[idx] = { ...(rows[idx] ?? {}), [fieldId]: value };
      return { ...prev, [parentId]: rows };
    });
  }

  function setSubRow(subId: string, parentId: string, idx: number, fieldId: string, value: unknown) {
    setSubValues((prev) => {
      const scope = prev[subId] ?? {};
      const rows = Array.isArray(scope[parentId]) ? [...(scope[parentId] as PreviewValues[])] : [];
      rows[idx] = { ...(rows[idx] ?? {}), [fieldId]: value };
      return { ...prev, [subId]: { ...scope, [parentId]: rows } };
    });
  }

  function addTopRow(parentId: string, fields: LeafField[]) {
    setValues((prev) => {
      const rows = Array.isArray(prev[parentId]) ? [...(prev[parentId] as PreviewValues[])] : [];
      rows.push(newRepeatingRow(fields));
      return { ...prev, [parentId]: rows };
    });
  }

  function removeTopRow(parentId: string, idx: number) {
    setValues((prev) => {
      const rows = Array.isArray(prev[parentId]) ? [...(prev[parentId] as PreviewValues[])] : [];
      rows.splice(idx, 1);
      return { ...prev, [parentId]: rows };
    });
  }

  function addSubRow(subId: string, parentId: string, fields: LeafField[]) {
    setSubValues((prev) => {
      const scope = prev[subId] ?? {};
      const rows = Array.isArray(scope[parentId]) ? [...(scope[parentId] as PreviewValues[])] : [];
      rows.push(newRepeatingRow(fields));
      return { ...prev, [subId]: { ...scope, [parentId]: rows } };
    });
  }

  function removeSubRow(subId: string, parentId: string, idx: number) {
    setSubValues((prev) => {
      const scope = prev[subId] ?? {};
      const rows = Array.isArray(scope[parentId]) ? [...(scope[parentId] as PreviewValues[])] : [];
      rows.splice(idx, 1);
      return { ...prev, [subId]: { ...scope, [parentId]: rows } };
    });
  }

  return (
    <div className="space-y-5">
      <InlineNotification
        kind="info"
        title="Modo de pré-visualização"
        subtitle="Os valores introduzidos aqui não são guardados — serve apenas para validar a disposição e o comportamento do formulário."
        lowContrast
        hideCloseButton
      />

      {formSchema.rows.map((row) => (
        <fieldset
          key={row.id}
          className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4"
        >
          {row.label && (
            <legend className="px-2 text-xs uppercase tracking-wide text-neutral-600">
              {row.label}
            </legend>
          )}
          {row.fields.map((field) => (
            <PreviewField
              key={field.id}
              field={field}
              scope={values}
              value={values[field.id]}
              onChange={(v) => setTop(field.id, v)}
              onSubRowChange={(idx, subId, v) => setTopRow(field.id, idx, subId, v)}
              onAddRow={() =>
                field.kind === "repeating" && addTopRow(field.id, field.fields)
              }
              onRemoveRow={(idx) => removeTopRow(field.id, idx)}
            />
          ))}
        </fieldset>
      ))}

      {subTemplates.map((sub) => (
        <section
          key={sub.id}
          className="space-y-3 rounded-lg border border-neutral-200 border-l-2 border-l-[var(--cds-interactive)] bg-neutral-50 p-4"
        >
          <header>
            <h3 className="text-base font-semibold">{sub.name}</h3>
            <p className="text-xs text-neutral-600">Secção do sub-modelo</p>
          </header>
          {sub.formSchema.rows.map((row) => (
            <fieldset
              key={row.id}
              className="space-y-3 rounded-md border border-neutral-200 bg-white p-3"
            >
              {row.label && (
                <legend className="px-2 text-xs uppercase tracking-wide text-neutral-600">
                  {row.label}
                </legend>
              )}
              {row.fields.map((field) => (
                <PreviewField
                  key={field.id}
                  field={field}
                  scope={subValues[sub.id] ?? {}}
                  value={subValues[sub.id]?.[field.id]}
                  onChange={(v) => setSub(sub.id, field.id, v)}
                  onSubRowChange={(idx, subId, v) =>
                    setSubRow(sub.id, field.id, idx, subId, v)
                  }
                  onAddRow={() =>
                    field.kind === "repeating" && addSubRow(sub.id, field.id, field.fields)
                  }
                  onRemoveRow={(idx) => removeSubRow(sub.id, field.id, idx)}
                />
              ))}
            </fieldset>
          ))}
        </section>
      ))}
    </div>
  );
}

interface PreviewFieldProps {
  field: Field | LeafField;
  scope: PreviewValues;
  value: unknown;
  onChange: (v: unknown) => void;
  onSubRowChange: (rowIdx: number, subFieldId: string, value: unknown) => void;
  onAddRow: () => void;
  onRemoveRow: (idx: number) => void;
}

function PreviewField({
  field,
  scope,
  value,
  onChange,
  onSubRowChange,
  onAddRow,
  onRemoveRow,
}: PreviewFieldProps) {
  if (!isVisible(field, scope)) return null;
  const id = `preview-${field.id}`;

  return (
    <div className="space-y-1.5">
      <span className="block text-sm">
        {field.label}
        {field.required && field.kind !== "repeating" ? (
          <span className="text-[var(--cds-text-error)]"> *</span>
        ) : null}
        {field.kind === "number" && field.unit && (
          <span className="text-xs text-neutral-600"> ({field.unit})</span>
        )}
      </span>
      <FieldControl
        field={field}
        id={id}
        value={value}
        scope={scope}
        onChange={onChange}
        onSubRowChange={onSubRowChange}
        onAddRow={onAddRow}
        onRemoveRow={onRemoveRow}
      />
    </div>
  );
}

interface FieldControlProps {
  field: Field | LeafField;
  id: string;
  value: unknown;
  scope: PreviewValues;
  onChange: (v: unknown) => void;
  onSubRowChange: (rowIdx: number, subFieldId: string, value: unknown) => void;
  onAddRow: () => void;
  onRemoveRow: (idx: number) => void;
}

function FieldControl({
  field,
  id,
  value,
  scope,
  onChange,
  onSubRowChange,
  onAddRow,
  onRemoveRow,
}: FieldControlProps) {
  switch (field.kind) {
    case "text":
      return (
        <TextInput
          id={id}
          labelText=""
          hideLabel
          value={typeof value === "string" ? value : ""}
          maxLength={field.maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "number":
      return (
        <TextInput
          id={id}
          labelText=""
          hideLabel
          inputMode="decimal"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "date":
      return (
        <TextInput
          id={id}
          labelText=""
          hideLabel
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
          id={id}
          labelText=""
          hideLabel
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <SelectItem value="" text="— escolha —" />
          {field.options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} text={opt.label} />
          ))}
        </Select>
      );
    case "multi_select": {
      const selected = new Set(Array.isArray(value) ? (value as string[]) : []);
      return (
        <div className="space-y-1.5">
          {field.options.map((opt) => (
            <Checkbox
              key={opt.value}
              id={`${id}-${opt.value}`}
              labelText={opt.label}
              checked={selected.has(opt.value)}
              onChange={(_e, { checked }) => {
                const next = new Set(selected);
                if (checked) next.add(opt.value);
                else next.delete(opt.value);
                onChange(Array.from(next));
              }}
            />
          ))}
        </div>
      );
    }
    case "calculated": {
      const display = computeCalculatedDisplay(field.expression, scope);
      return (
        <output
          id={id}
          className="block rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
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
      const rows = Array.isArray(value) ? (value as PreviewValues[]) : [];
      return (
        <div className="space-y-2">
          {rows.map((row, idx) => (
            <div
              key={`${id}-row-${idx}`}
              className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-neutral-600">
                  {field.rowLabel} {idx + 1}
                </span>
                <Button
                  type="button"
                  kind="danger--ghost"
                  size="sm"
                  renderIcon={TrashCan}
                  iconDescription="Remover linha"
                  hasIconOnly
                  onClick={() => onRemoveRow(idx)}
                />
              </div>
              {field.fields.map((sub) => (
                <PreviewField
                  key={sub.id}
                  field={sub}
                  scope={row}
                  value={row[sub.id]}
                  onChange={(v) => onSubRowChange(idx, sub.id, v)}
                  onSubRowChange={() => {
                    /* repeating fields aren't nested */
                  }}
                  onAddRow={() => {
                    /* repeating fields aren't nested */
                  }}
                  onRemoveRow={() => {
                    /* repeating fields aren't nested */
                  }}
                />
              ))}
            </div>
          ))}
          {(field.maxRows === undefined || rows.length < field.maxRows) && (
            <Button type="button" kind="tertiary" size="sm" onClick={onAddRow} renderIcon={Add}>
              Adicionar {field.rowLabel.toLowerCase()}
            </Button>
          )}
        </div>
      );
    }
  }
}
