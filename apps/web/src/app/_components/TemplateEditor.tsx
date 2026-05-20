"use client";

import type { FormSchema } from "@bgreen/types";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createTemplateAction } from "../actions";

type FieldKind = "text" | "number" | "date" | "select";

interface EditorField {
  uiKey: string;
  id: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  maxLength: string;
  unit: string;
  min: string;
  max: string;
  options: Array<{ value: string; label: string }>;
}

interface EditorRow {
  uiKey: string;
  label: string;
  fields: EditorField[];
}

function newField(): EditorField {
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
  };
}

function newRow(): EditorRow {
  return { uiKey: crypto.randomUUID(), label: "", fields: [newField()] };
}

const ID_PATTERN = /^[a-z][a-z0-9_]*$/;

interface BuildError {
  message: string;
}

function isFieldEmpty(f: EditorField): boolean {
  return (
    f.id.trim() === "" &&
    f.label.trim() === "" &&
    f.maxLength.trim() === "" &&
    f.unit.trim() === "" &&
    f.min.trim() === "" &&
    f.max.trim() === "" &&
    f.options.length === 0
  );
}

function buildFormSchema(rows: EditorRow[]): { ok: true; schema: FormSchema } | BuildError {
  const seenIds = new Set<string>();
  const builtRows: FormSchema["rows"] = [];

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    if (!row) continue;
    const fields: FormSchema["rows"][number]["fields"] = [];
    for (let fieldIdx = 0; fieldIdx < row.fields.length; fieldIdx++) {
      const f = row.fields[fieldIdx];
      if (!f) continue;
      // Skip fully blank placeholder fields so the default empty row
      // doesn't fail submission when the user only filled others.
      if (isFieldEmpty(f)) continue;

      const where = `Linha ${rowIdx + 1}, campo ${fieldIdx + 1}`;
      const id = f.id.trim();
      if (!ID_PATTERN.test(id)) {
        return {
          message: `${where}: identificador "${f.id}" inválido. Use letras minúsculas, dígitos e underscore (ex.: kwh_consumo).`,
        };
      }
      if (seenIds.has(id)) {
        return { message: `${where}: identificador "${id}" está duplicado.` };
      }
      seenIds.add(id);
      const label = f.label.trim();
      if (!label) {
        return { message: `${where}: indique uma etiqueta para "${id}".` };
      }
      const base = { id, label, required: f.required } as const;
      switch (f.kind) {
        case "text":
          fields.push({
            ...base,
            kind: "text",
            ...(f.maxLength.trim() ? { maxLength: Number(f.maxLength) } : {}),
          });
          break;
        case "number":
          fields.push({
            ...base,
            kind: "number",
            ...(f.unit.trim() ? { unit: f.unit.trim() } : {}),
            ...(f.min.trim() ? { min: Number(f.min) } : {}),
            ...(f.max.trim() ? { max: Number(f.max) } : {}),
          });
          break;
        case "date":
          fields.push({
            ...base,
            kind: "date",
            ...(f.min.trim() ? { min: f.min.trim() } : {}),
            ...(f.max.trim() ? { max: f.max.trim() } : {}),
          });
          break;
        case "select": {
          const opts = f.options
            .map((o) => ({ value: o.value.trim(), label: o.label.trim() }))
            .filter((o) => o.value && o.label);
          if (opts.length === 0) {
            return { message: `${where} ("${id}"): adicione pelo menos uma opção.` };
          }
          fields.push({ ...base, kind: "select", options: opts });
          break;
        }
      }
    }
    if (fields.length > 0) {
      builtRows.push({ id: crypto.randomUUID(), label: row.label.trim() || undefined, fields });
    }
  }
  if (builtRows.length === 0) {
    return { message: "Adicione pelo menos um campo com identificador e etiqueta." };
  }
  return { ok: true, schema: { version: 1, rows: builtRows } };
}

export function TemplateEditor() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState<EditorRow[]>([newRow()]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function updateRow(idx: number, patch: Partial<EditorRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function updateField(rowIdx: number, fieldIdx: number, patch: Partial<EditorField>) {
    setRows((prev) =>
      prev.map((r, i) =>
        i !== rowIdx
          ? r
          : { ...r, fields: r.fields.map((f, j) => (j === fieldIdx ? { ...f, ...patch } : f)) },
      ),
    );
  }

  function addField(rowIdx: number) {
    setRows((prev) =>
      prev.map((r, i) => (i === rowIdx ? { ...r, fields: [...r.fields, newField()] } : r)),
    );
  }

  function removeField(rowIdx: number, fieldIdx: number) {
    setRows((prev) =>
      prev.map((r, i) =>
        i !== rowIdx ? r : { ...r, fields: r.fields.filter((_, j) => j !== fieldIdx) },
      ),
    );
  }

  function addOption(rowIdx: number, fieldIdx: number) {
    updateField(rowIdx, fieldIdx, {
      options: [...(rows[rowIdx]?.fields[fieldIdx]?.options ?? []), { value: "", label: "" }],
    });
  }

  function updateOption(
    rowIdx: number,
    fieldIdx: number,
    optIdx: number,
    patch: { value?: string; label?: string },
  ) {
    const opts = rows[rowIdx]?.fields[fieldIdx]?.options ?? [];
    const next = opts.map((o, i) => (i === optIdx ? { ...o, ...patch } : o));
    updateField(rowIdx, fieldIdx, { options: next });
  }

  function removeOption(rowIdx: number, fieldIdx: number, optIdx: number) {
    const opts = rows[rowIdx]?.fields[fieldIdx]?.options ?? [];
    updateField(rowIdx, fieldIdx, { options: opts.filter((_, i) => i !== optIdx) });
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
      style={{ display: "grid", gap: "1.5rem", maxWidth: 720, fontFamily: "system-ui, sans-serif" }}
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
        {rows.map((row, rowIdx) => (
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
                onChange={(e) => updateRow(rowIdx, { label: e.target.value })}
                style={{ padding: "0.4rem", fontSize: "0.95rem" }}
              />
            </label>

            {row.fields.map((field, fieldIdx) => (
              <div
                key={field.uiKey}
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
                      onChange={(e) => updateField(rowIdx, fieldIdx, { id: e.target.value })}
                      placeholder="ex.: kwh_consumo"
                      style={{ padding: "0.4rem", fontSize: "0.95rem", fontFamily: "monospace" }}
                    />
                  </label>
                  <label style={{ display: "grid", gap: "0.25rem" }}>
                    <span style={{ fontSize: "0.85rem" }}>Etiqueta</span>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateField(rowIdx, fieldIdx, { label: e.target.value })}
                      placeholder="ex.: Consumo de eletricidade"
                      style={{ padding: "0.4rem", fontSize: "0.95rem" }}
                    />
                  </label>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                    <span style={{ fontSize: "0.85rem" }}>Tipo</span>
                    <select
                      value={field.kind}
                      onChange={(e) =>
                        updateField(rowIdx, fieldIdx, { kind: e.target.value as FieldKind })
                      }
                      style={{ padding: "0.3rem", fontSize: "0.9rem" }}
                    >
                      <option value="text">Texto</option>
                      <option value="number">Número</option>
                      <option value="date">Data</option>
                      <option value="select">Lista</option>
                    </select>
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) =>
                        updateField(rowIdx, fieldIdx, { required: e.target.checked })
                      }
                    />
                    <span style={{ fontSize: "0.85rem" }}>Obrigatório</span>
                  </label>
                </div>

                {field.kind === "text" && (
                  <label style={{ display: "grid", gap: "0.25rem", maxWidth: 200 }}>
                    <span style={{ fontSize: "0.85rem" }}>Comprimento máximo</span>
                    <input
                      type="number"
                      min={1}
                      value={field.maxLength}
                      onChange={(e) => updateField(rowIdx, fieldIdx, { maxLength: e.target.value })}
                      style={{ padding: "0.35rem", fontSize: "0.9rem" }}
                    />
                  </label>
                )}

                {field.kind === "number" && (
                  <div
                    style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}
                  >
                    <label style={{ display: "grid", gap: "0.25rem" }}>
                      <span style={{ fontSize: "0.85rem" }}>Unidade</span>
                      <input
                        type="text"
                        value={field.unit}
                        onChange={(e) => updateField(rowIdx, fieldIdx, { unit: e.target.value })}
                        placeholder="kWh, m³, kg…"
                        style={{ padding: "0.35rem", fontSize: "0.9rem" }}
                      />
                    </label>
                    <label style={{ display: "grid", gap: "0.25rem" }}>
                      <span style={{ fontSize: "0.85rem" }}>Mínimo</span>
                      <input
                        type="number"
                        value={field.min}
                        onChange={(e) => updateField(rowIdx, fieldIdx, { min: e.target.value })}
                        style={{ padding: "0.35rem", fontSize: "0.9rem" }}
                      />
                    </label>
                    <label style={{ display: "grid", gap: "0.25rem" }}>
                      <span style={{ fontSize: "0.85rem" }}>Máximo</span>
                      <input
                        type="number"
                        value={field.max}
                        onChange={(e) => updateField(rowIdx, fieldIdx, { max: e.target.value })}
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
                        onChange={(e) => updateField(rowIdx, fieldIdx, { min: e.target.value })}
                        style={{ padding: "0.35rem", fontSize: "0.9rem" }}
                      />
                    </label>
                    <label style={{ display: "grid", gap: "0.25rem" }}>
                      <span style={{ fontSize: "0.85rem" }}>Data máxima</span>
                      <input
                        type="date"
                        value={field.max}
                        onChange={(e) => updateField(rowIdx, fieldIdx, { max: e.target.value })}
                        style={{ padding: "0.35rem", fontSize: "0.9rem" }}
                      />
                    </label>
                  </div>
                )}

                {field.kind === "select" && (
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
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr auto",
                          gap: "0.5rem",
                        }}
                      >
                        <input
                          type="text"
                          placeholder="valor"
                          value={opt.value}
                          onChange={(e) =>
                            updateOption(rowIdx, fieldIdx, optIdx, { value: e.target.value })
                          }
                          style={{ padding: "0.3rem", fontSize: "0.9rem", fontFamily: "monospace" }}
                        />
                        <input
                          type="text"
                          placeholder="etiqueta"
                          value={opt.label}
                          onChange={(e) =>
                            updateOption(rowIdx, fieldIdx, optIdx, { label: e.target.value })
                          }
                          style={{ padding: "0.3rem", fontSize: "0.9rem" }}
                        />
                        <button
                          type="button"
                          onClick={() => removeOption(rowIdx, fieldIdx, optIdx)}
                          style={{ padding: "0.3rem 0.5rem", fontSize: "0.85rem" }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addOption(rowIdx, fieldIdx)}
                      style={{
                        justifySelf: "start",
                        padding: "0.3rem 0.6rem",
                        fontSize: "0.85rem",
                      }}
                    >
                      + Opção
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => removeField(rowIdx, fieldIdx)}
                  disabled={row.fields.length === 1 && rows.length === 1}
                  style={{
                    justifySelf: "end",
                    padding: "0.3rem 0.6rem",
                    fontSize: "0.85rem",
                  }}
                >
                  Remover campo
                </button>
              </div>
            ))}

            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "space-between" }}>
              <button
                type="button"
                onClick={() => addField(rowIdx)}
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
        ))}

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
