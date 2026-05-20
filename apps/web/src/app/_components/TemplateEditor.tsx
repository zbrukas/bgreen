"use client";

import type { RecordTemplate } from "@bgreen/types";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createTemplateAction } from "../actions";
import {
  type EditorField,
  type EditorFieldKind,
  type EditorLeafKind,
  type EditorRow,
  type EditorShowIfPredicate,
  buildFormSchema,
  newField,
  newRow,
  newShowIf,
} from "./template-editor-build";

const TOP_LEVEL_KINDS: Array<{ value: EditorFieldKind; label: string }> = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "select", label: "Lista" },
  { value: "multi_select", label: "Múltipla escolha" },
  { value: "calculated", label: "Calculado" },
  { value: "repeating", label: "Linhas repetidas" },
];

const LEAF_KINDS: Array<{ value: EditorLeafKind; label: string }> = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "select", label: "Lista" },
  { value: "multi_select", label: "Múltipla escolha" },
  { value: "calculated", label: "Calculado" },
];

// Kinds where source-mapping pre-fill is meaningful (multi-select/calculated/
// repeating intentionally excluded — those don't map well to a single source value).
const MAPPABLE_KINDS: ReadonlySet<EditorFieldKind> = new Set(["text", "number", "date", "select"]);

interface TemplateEditorProps {
  availableTemplates: Array<Pick<RecordTemplate, "id" | "name" | "status" | "formSchema">>;
}

export function TemplateEditor({ availableTemplates }: TemplateEditorProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState<EditorRow[]>([newRow()]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function patchField(rowIdx: number, fieldIdx: number, patch: Partial<EditorField>) {
    setRows((prev) =>
      prev.map((r, i) =>
        i !== rowIdx
          ? r
          : { ...r, fields: r.fields.map((f, j) => (j === fieldIdx ? { ...f, ...patch } : f)) },
      ),
    );
  }

  function patchSubField(
    rowIdx: number,
    fieldIdx: number,
    subIdx: number,
    patch: Partial<EditorField>,
  ) {
    setRows((prev) =>
      prev.map((r, i) =>
        i !== rowIdx
          ? r
          : {
              ...r,
              fields: r.fields.map((f, j) =>
                j !== fieldIdx
                  ? f
                  : {
                      ...f,
                      subFields: f.subFields.map((s, k) => (k === subIdx ? { ...s, ...patch } : s)),
                    },
              ),
            },
      ),
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Indique um nome para o modelo.");
      return;
    }
    const built = buildFormSchema(rows);
    if (!("ok" in built)) {
      setError(built.message);
      return;
    }
    startTransition(async () => {
      const result = await createTemplateAction(
        { error: null, created: null },
        {
          name: name.trim(),
          description: description.trim() || null,
          formSchema: built.schema,
        },
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.created) {
        router.push(`/templates/${result.created.id}`);
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: "grid", gap: "1.5rem", maxWidth: 760, fontFamily: "system-ui, sans-serif" }}
    >
      <h1 style={{ margin: 0 }}>Novo modelo</h1>

      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Nome</span>
        <input
          type="text"
          required
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: "0.5rem", fontSize: "1rem" }}
        />
      </label>

      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Descrição (opcional)</span>
        <textarea
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          style={{ padding: "0.5rem", fontSize: "1rem", fontFamily: "inherit" }}
        />
      </label>

      <section style={{ display: "grid", gap: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Linhas e campos</h2>
        {rows.map((row, rowIdx) => {
          return (
            <fieldset
              key={row.uiKey}
              style={{
                border: "1px solid #cfd8dc",
                borderRadius: "0.25rem",
                padding: "0.75rem 1rem",
                display: "grid",
                gap: "0.75rem",
                margin: 0,
              }}
            >
              <legend style={{ padding: "0 0.5rem", color: "#444", fontSize: "0.9rem" }}>
                Linha {rowIdx + 1}
              </legend>

              <label style={{ display: "grid", gap: "0.25rem" }}>
                <span style={{ fontSize: "0.85rem" }}>Etiqueta da linha (opcional)</span>
                <input
                  type="text"
                  value={row.label}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r, i) => (i === rowIdx ? { ...r, label: e.target.value } : r)),
                    )
                  }
                  style={{ padding: "0.4rem", fontSize: "0.95rem" }}
                />
              </label>

              {row.fields.map((field, fieldIdx) => (
                <FieldCard
                  key={field.uiKey}
                  field={field}
                  fieldIdx={fieldIdx}
                  siblings={row.fields.slice(0, fieldIdx)}
                  allowRepeating
                  availableTemplates={availableTemplates}
                  onPatch={(patch) => patchField(rowIdx, fieldIdx, patch)}
                  onRemove={() =>
                    setRows((prev) =>
                      prev.map((r, i) =>
                        i !== rowIdx
                          ? r
                          : { ...r, fields: r.fields.filter((_, j) => j !== fieldIdx) },
                      ),
                    )
                  }
                  removable={row.fields.length > 1 || rows.length > 1}
                  onPatchSub={(subIdx, patch) => patchSubField(rowIdx, fieldIdx, subIdx, patch)}
                />
              ))}

              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "space-between" }}>
                <button
                  type="button"
                  onClick={() =>
                    setRows((prev) =>
                      prev.map((r, i) =>
                        i === rowIdx ? { ...r, fields: [...r.fields, newField()] } : r,
                      ),
                    )
                  }
                  style={{ padding: "0.4rem 0.75rem", fontSize: "0.9rem" }}
                >
                  + Adicionar campo
                </button>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setRows((prev) => prev.filter((_, i) => i !== rowIdx))}
                    style={{ padding: "0.4rem 0.75rem", fontSize: "0.9rem" }}
                  >
                    Remover linha
                  </button>
                )}
              </div>
            </fieldset>
          );
        })}

        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, newRow()])}
          style={{ justifySelf: "start", padding: "0.4rem 0.75rem", fontSize: "0.9rem" }}
        >
          + Adicionar linha
        </button>
      </section>

      {error && (
        <p style={{ margin: 0, color: "#b00020" }} role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        style={{ padding: "0.75rem 1rem", fontSize: "1rem", justifySelf: "start" }}
      >
        {isPending ? "A criar…" : "Criar modelo"}
      </button>
    </form>
  );
}

interface FieldCardProps {
  field: EditorField;
  fieldIdx: number;
  siblings: EditorField[];
  allowRepeating: boolean;
  removable: boolean;
  availableTemplates: Array<Pick<RecordTemplate, "id" | "name" | "status" | "formSchema">>;
  onPatch: (patch: Partial<EditorField>) => void;
  onRemove: () => void;
  onPatchSub?: (subIdx: number, patch: Partial<EditorField>) => void;
}

function FieldCard({
  field,
  fieldIdx,
  siblings,
  allowRepeating,
  removable,
  availableTemplates,
  onPatch,
  onRemove,
  onPatchSub,
}: FieldCardProps) {
  const kindOptions = allowRepeating ? TOP_LEVEL_KINDS : LEAF_KINDS;
  return (
    <div
      style={{
        border: "1px solid #e0e0e0",
        borderRadius: "0.25rem",
        padding: "0.5rem 0.75rem",
        display: "grid",
        gap: "0.5rem",
        background: "#fafafa",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.85rem" }}>Identificador (snake_case)</span>
          <input
            type="text"
            value={field.id}
            onChange={(e) => onPatch({ id: e.target.value })}
            placeholder="ex.: kwh_consumo"
            style={{ padding: "0.4rem", fontSize: "0.95rem", fontFamily: "monospace" }}
          />
        </label>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.85rem" }}>Etiqueta</span>
          <input
            type="text"
            value={field.label}
            onChange={(e) => onPatch({ label: e.target.value })}
            placeholder="ex.: Consumo de eletricidade"
            style={{ padding: "0.4rem", fontSize: "0.95rem" }}
          />
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.85rem" }}>Tipo</span>
          <select
            value={field.kind}
            onChange={(e) => onPatch({ kind: e.target.value as EditorFieldKind })}
            style={{ padding: "0.3rem", fontSize: "0.9rem" }}
          >
            {kindOptions.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        {field.kind !== "repeating" && (
          <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => onPatch({ required: e.target.checked })}
            />
            <span style={{ fontSize: "0.85rem" }}>Obrigatório</span>
          </label>
        )}
      </div>

      {field.kind === "text" && (
        <label style={{ display: "grid", gap: "0.25rem", maxWidth: 200 }}>
          <span style={{ fontSize: "0.85rem" }}>Comprimento máximo</span>
          <input
            type="number"
            min={1}
            value={field.maxLength}
            onChange={(e) => onPatch({ maxLength: e.target.value })}
            style={{ padding: "0.35rem", fontSize: "0.9rem" }}
          />
        </label>
      )}

      {field.kind === "number" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.85rem" }}>Unidade</span>
            <input
              type="text"
              value={field.unit}
              onChange={(e) => onPatch({ unit: e.target.value })}
              placeholder="kWh, m³, kg…"
              style={{ padding: "0.35rem", fontSize: "0.9rem" }}
            />
          </label>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.85rem" }}>Mínimo</span>
            <input
              type="number"
              value={field.min}
              onChange={(e) => onPatch({ min: e.target.value })}
              style={{ padding: "0.35rem", fontSize: "0.9rem" }}
            />
          </label>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.85rem" }}>Máximo</span>
            <input
              type="number"
              value={field.max}
              onChange={(e) => onPatch({ max: e.target.value })}
              style={{ padding: "0.35rem", fontSize: "0.9rem" }}
            />
          </label>
        </div>
      )}

      {field.kind === "date" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.85rem" }}>Data mínima (YYYY-MM-DD)</span>
            <input
              type="date"
              value={field.min}
              onChange={(e) => onPatch({ min: e.target.value })}
              style={{ padding: "0.35rem", fontSize: "0.9rem" }}
            />
          </label>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.85rem" }}>Data máxima</span>
            <input
              type="date"
              value={field.max}
              onChange={(e) => onPatch({ max: e.target.value })}
              style={{ padding: "0.35rem", fontSize: "0.9rem" }}
            />
          </label>
        </div>
      )}

      {(field.kind === "select" || field.kind === "multi_select") && (
        <OptionsEditor field={field} onPatch={onPatch} />
      )}

      {field.kind === "multi_select" && (
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", maxWidth: 320 }}
        >
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.85rem" }}>Mínimo de seleções</span>
            <input
              type="number"
              min={1}
              value={field.minSelected}
              onChange={(e) => onPatch({ minSelected: e.target.value })}
              style={{ padding: "0.35rem", fontSize: "0.9rem" }}
            />
          </label>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.85rem" }}>Máximo de seleções</span>
            <input
              type="number"
              min={1}
              value={field.maxSelected}
              onChange={(e) => onPatch({ maxSelected: e.target.value })}
              style={{ padding: "0.35rem", fontSize: "0.9rem" }}
            />
          </label>
        </div>
      )}

      {field.kind === "calculated" && <CalculatedEditor field={field} onPatch={onPatch} />}

      {field.kind === "repeating" && (
        <RepeatingEditor
          field={field}
          fieldIdx={fieldIdx}
          onPatch={onPatch}
          onPatchSub={onPatchSub}
          availableTemplates={availableTemplates}
        />
      )}

      <ShowIfPicker field={field} siblings={siblings} onPatch={onPatch} />

      {MAPPABLE_KINDS.has(field.kind) && (
        <SourceMappingPicker
          field={field}
          availableTemplates={availableTemplates}
          onPatch={onPatch}
        />
      )}

      <button
        type="button"
        onClick={onRemove}
        disabled={!removable}
        style={{ justifySelf: "end", padding: "0.3rem 0.6rem", fontSize: "0.85rem" }}
      >
        Remover campo
      </button>
    </div>
  );
}

function OptionsEditor({
  field,
  onPatch,
}: {
  field: EditorField;
  onPatch: (patch: Partial<EditorField>) => void;
}) {
  function update(idx: number, patch: { value?: string; label?: string }) {
    onPatch({ options: field.options.map((o, i) => (i === idx ? { ...o, ...patch } : o)) });
  }
  function remove(idx: number) {
    onPatch({ options: field.options.filter((_, i) => i !== idx) });
  }
  return (
    <div style={{ display: "grid", gap: "0.4rem" }}>
      <span style={{ fontSize: "0.85rem" }}>Opções</span>
      {field.options.length === 0 && (
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#777" }}>
          Sem opções ainda — adicione pelo menos uma.
        </p>
      )}
      {field.options.map((opt, optIdx) => (
        <div
          key={`${field.uiKey}-opt-${optIdx}`}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.5rem" }}
        >
          <input
            type="text"
            placeholder="valor"
            value={opt.value}
            onChange={(e) => update(optIdx, { value: e.target.value })}
            style={{ padding: "0.3rem", fontSize: "0.9rem", fontFamily: "monospace" }}
          />
          <input
            type="text"
            placeholder="etiqueta"
            value={opt.label}
            onChange={(e) => update(optIdx, { label: e.target.value })}
            style={{ padding: "0.3rem", fontSize: "0.9rem" }}
          />
          <button
            type="button"
            onClick={() => remove(optIdx)}
            style={{ padding: "0.3rem 0.5rem", fontSize: "0.85rem" }}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onPatch({ options: [...field.options, { value: "", label: "" }] })}
        style={{ justifySelf: "start", padding: "0.3rem 0.6rem", fontSize: "0.85rem" }}
      >
        + Opção
      </button>
    </div>
  );
}

function RepeatingEditor({
  field,
  fieldIdx: _fieldIdx,
  onPatch,
  onPatchSub,
  availableTemplates,
}: {
  field: EditorField;
  fieldIdx: number;
  onPatch: (patch: Partial<EditorField>) => void;
  onPatchSub?: (subIdx: number, patch: Partial<EditorField>) => void;
  availableTemplates: Array<Pick<RecordTemplate, "id" | "name" | "status" | "formSchema">>;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: "0.5rem",
        border: "1px dashed #b0bec5",
        borderRadius: "0.25rem",
        padding: "0.5rem 0.75rem",
        background: "#f5f8fa",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.85rem" }}>Nome de cada linha</span>
          <input
            type="text"
            value={field.rowLabel}
            onChange={(e) => onPatch({ rowLabel: e.target.value })}
            placeholder="ex.: Veículo"
            style={{ padding: "0.35rem", fontSize: "0.9rem" }}
          />
        </label>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.85rem" }}>Mínimo de linhas</span>
          <input
            type="number"
            min={0}
            value={field.minRows}
            onChange={(e) => onPatch({ minRows: e.target.value })}
            style={{ padding: "0.35rem", fontSize: "0.9rem" }}
          />
        </label>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.85rem" }}>Máximo de linhas</span>
          <input
            type="number"
            min={1}
            value={field.maxRows}
            onChange={(e) => onPatch({ maxRows: e.target.value })}
            style={{ padding: "0.35rem", fontSize: "0.9rem" }}
          />
        </label>
      </div>

      <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "#555" }}>
        Sub-campos (não podem conter outras linhas repetidas):
      </p>

      {field.subFields.map((sub, subIdx) => (
        <FieldCard
          key={sub.uiKey}
          field={sub}
          fieldIdx={subIdx}
          siblings={field.subFields.slice(0, subIdx)}
          allowRepeating={false}
          availableTemplates={availableTemplates}
          removable={field.subFields.length > 1}
          onPatch={(patch) => onPatchSub?.(subIdx, patch)}
          onRemove={() => onPatch({ subFields: field.subFields.filter((_, i) => i !== subIdx) })}
        />
      ))}

      <button
        type="button"
        onClick={() => onPatch({ subFields: [...field.subFields, newField()] })}
        style={{ justifySelf: "start", padding: "0.3rem 0.6rem", fontSize: "0.85rem" }}
      >
        + Sub-campo
      </button>
    </div>
  );
}

function ShowIfPicker({
  field,
  siblings,
  onPatch,
}: {
  field: EditorField;
  siblings: EditorField[];
  onPatch: (patch: Partial<EditorField>) => void;
}) {
  const candidates = siblings.filter((s) => s.id.trim() && s.kind !== "repeating");

  function update(idx: number, patch: Partial<EditorShowIfPredicate>) {
    onPatch({ showIf: field.showIf.map((p, i) => (i === idx ? { ...p, ...patch } : p)) });
  }
  function remove(idx: number) {
    onPatch({ showIf: field.showIf.filter((_, i) => i !== idx) });
  }

  return (
    <details style={{ borderTop: "1px dotted #ddd", paddingTop: "0.5rem" }}>
      <summary style={{ fontSize: "0.85rem", cursor: "pointer", color: "#555" }}>
        Condição de visibilidade {field.showIf.length > 0 && `(${field.showIf.length})`}
      </summary>
      <div style={{ display: "grid", gap: "0.4rem", marginTop: "0.4rem" }}>
        {field.showIf.length > 0 && candidates.length === 0 && (
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#b00020" }}>
            Não existem campos anteriores neste âmbito para usar como referência. Reorganize os
            campos ou remova as condições.
          </p>
        )}
        {field.showIf.map((predicate, idx) => (
          <div
            key={predicate.uiKey}
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.4rem" }}
          >
            <select
              value={predicate.fieldId}
              onChange={(e) => update(idx, { fieldId: e.target.value })}
              style={{ padding: "0.3rem", fontSize: "0.85rem" }}
            >
              <option value="">— campo anterior —</option>
              {candidates.map((c) => (
                <option key={c.uiKey} value={c.id.trim()}>
                  {c.id.trim()} ({c.label || "?"})
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="valor exacto"
              value={predicate.equals}
              onChange={(e) => update(idx, { equals: e.target.value })}
              style={{ padding: "0.3rem", fontSize: "0.85rem" }}
            />
            <button
              type="button"
              onClick={() => remove(idx)}
              style={{ padding: "0.3rem 0.5rem", fontSize: "0.85rem" }}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onPatch({ showIf: [...field.showIf, newShowIf()] })}
          disabled={candidates.length === 0 && field.showIf.length === 0}
          style={{ justifySelf: "start", padding: "0.3rem 0.6rem", fontSize: "0.85rem" }}
        >
          + Condição (E)
        </button>
        <p style={{ margin: 0, fontSize: "0.75rem", color: "#777" }}>
          Todas as condições devem ser satisfeitas (E lógico). Campos ocultos não são validados.
        </p>
      </div>
    </details>
  );
}

function CalculatedEditor({
  field,
  onPatch,
}: {
  field: EditorField;
  onPatch: (patch: Partial<EditorField>) => void;
}) {
  return (
    <div style={{ display: "grid", gap: "0.4rem" }}>
      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span style={{ fontSize: "0.85rem" }}>
          Expressão (referencie outros campos pelo identificador)
        </span>
        <textarea
          value={field.expression}
          onChange={(e) => onPatch({ expression: e.target.value })}
          rows={2}
          placeholder="ex.: actividade * factor"
          style={{
            padding: "0.4rem",
            fontSize: "0.9rem",
            fontFamily: "monospace",
            resize: "vertical",
          }}
        />
      </label>
      <label style={{ display: "grid", gap: "0.25rem", maxWidth: 200 }}>
        <span style={{ fontSize: "0.85rem" }}>Unidade (opcional)</span>
        <input
          type="text"
          value={field.unit}
          onChange={(e) => onPatch({ unit: e.target.value })}
          placeholder="kg CO₂e, kWh…"
          style={{ padding: "0.35rem", fontSize: "0.9rem" }}
        />
      </label>
      <p style={{ margin: 0, fontSize: "0.75rem", color: "#777" }}>
        Operadores suportados: <code>+ - * /</code> e parênteses. Os identificadores devem existir
        no mesmo âmbito (linha principal ou sub-linha).
      </p>
    </div>
  );
}

function SourceMappingPicker({
  field,
  availableTemplates,
  onPatch,
}: {
  field: EditorField;
  availableTemplates: Array<Pick<RecordTemplate, "id" | "name" | "status" | "formSchema">>;
  onPatch: (patch: Partial<EditorField>) => void;
}) {
  const mapping = field.sourceMapping;
  const eligibleTemplates = availableTemplates.filter((t) => t.status !== "archived");
  const selectedTemplate = mapping
    ? availableTemplates.find((t) => t.id === mapping.sourceTemplateId)
    : undefined;
  const sourceFields = selectedTemplate
    ? selectedTemplate.formSchema.rows.flatMap((r) => r.fields).filter((f) => f.kind === field.kind)
    : [];

  return (
    <details style={{ borderTop: "1px dotted #ddd", paddingTop: "0.5rem" }}>
      <summary style={{ fontSize: "0.85rem", cursor: "pointer", color: "#555" }}>
        Pré-preencher de outro modelo {mapping && "(activo)"}
      </summary>
      <div style={{ display: "grid", gap: "0.4rem", marginTop: "0.4rem" }}>
        {eligibleTemplates.length === 0 ? (
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#777" }}>
            Não existem outros modelos disponíveis na organização.
          </p>
        ) : (
          <>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.8rem" }}>Modelo de origem</span>
              <select
                value={mapping?.sourceTemplateId ?? ""}
                onChange={(e) => {
                  const sourceTemplateId = e.target.value;
                  onPatch({
                    sourceMapping: sourceTemplateId
                      ? { sourceTemplateId, sourceFieldId: "" }
                      : null,
                  });
                }}
                style={{ padding: "0.3rem", fontSize: "0.85rem" }}
              >
                <option value="">— sem pré-preenchimento —</option>
                {eligibleTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            {mapping && selectedTemplate && (
              <label style={{ display: "grid", gap: "0.25rem" }}>
                <span style={{ fontSize: "0.8rem" }}>
                  Campo de origem (tipo deve coincidir: {field.kind})
                </span>
                <select
                  value={mapping.sourceFieldId}
                  onChange={(e) =>
                    onPatch({
                      sourceMapping: { ...mapping, sourceFieldId: e.target.value },
                    })
                  }
                  style={{ padding: "0.3rem", fontSize: "0.85rem" }}
                >
                  <option value="">— escolha um campo —</option>
                  {sourceFields.map((sf) => (
                    <option key={sf.id} value={sf.id}>
                      {sf.id} ({sf.label})
                    </option>
                  ))}
                </select>
                {sourceFields.length === 0 && (
                  <span style={{ fontSize: "0.75rem", color: "#b00020" }}>
                    O modelo "{selectedTemplate.name}" não tem campos do tipo {field.kind}.
                  </span>
                )}
              </label>
            )}
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#777" }}>
              Ao criar um novo registo, este campo é pré-preenchido com o valor do campo escolhido
              no registo submetido mais recente do modelo de origem.
            </p>
          </>
        )}
      </div>
    </details>
  );
}
