"use client";

import { validateNif } from "@bgreen/pt-data";
import { useActionState, useMemo, useState } from "react";
import { type CreateOrganizationFormState, createOrganizationAction } from "../actions";
import { CaePicker } from "./CaePicker";

const legalFormOptions: Array<{ value: string; label: string }> = [
  { value: "", label: "— Selecione (opcional) —" },
  { value: "sociedade_anonima", label: "Sociedade Anónima" },
  { value: "sociedade_quotas", label: "Sociedade por Quotas" },
  { value: "sociedade_unipessoal_quotas", label: "Sociedade Unipessoal por Quotas" },
  { value: "empresario_individual", label: "Empresário em Nome Individual" },
  { value: "associacao", label: "Associação" },
  { value: "cooperativa", label: "Cooperativa" },
  { value: "outro", label: "Outro" },
];

const sizeOptions: Array<{ value: string; label: string }> = [
  { value: "", label: "— Selecione (opcional) —" },
  { value: "micro", label: "Micro (<10 trabalhadores)" },
  { value: "pequena", label: "Pequena (10–49 trabalhadores)" },
  { value: "media", label: "Média (50–249 trabalhadores)" },
  { value: "grande", label: "Grande (≥250 trabalhadores)" },
];

const nifReasonCopy: Record<string, string> = {
  empty: "Indique um NIF.",
  non_numeric: "O NIF tem de conter apenas dígitos.",
  wrong_length: "O NIF deve ter exatamente 9 dígitos.",
  bad_checksum: "Dígito de controlo inválido.",
};

const initialState: CreateOrganizationFormState = { error: null };

export function CreateOrganizationForm() {
  const [state, formAction, isPending] = useActionState(createOrganizationAction, initialState);
  const [nif, setNif] = useState("");

  const nifFeedback = useMemo(() => {
    if (nif.trim() === "") return null;
    const result = validateNif(nif);
    if (result.valid) return { kind: "ok" as const };
    return { kind: "error" as const, reason: result.reason };
  }, [nif]);

  return (
    <form action={formAction} style={{ display: "grid", gap: "1rem", maxWidth: 480 }}>
      <h2 style={{ margin: 0 }}>Criar a sua organização</h2>
      <p style={{ margin: 0, color: "#555" }}>
        NIF e dimensão são opcionais por agora — pode adicioná-los mais tarde.
      </p>

      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Nome</span>
        <input
          name="name"
          type="text"
          required
          autoComplete="organization"
          maxLength={200}
          style={{ padding: "0.5rem", fontSize: "1rem" }}
        />
      </label>

      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>NIF</span>
        <input
          name="nif"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={11}
          value={nif}
          onChange={(e) => setNif(e.target.value)}
          style={{
            padding: "0.5rem",
            fontSize: "1rem",
            borderColor:
              nifFeedback?.kind === "ok"
                ? "#1f7a3d"
                : nifFeedback?.kind === "error"
                  ? "#b00020"
                  : undefined,
            borderWidth: nifFeedback ? "2px" : undefined,
            borderStyle: nifFeedback ? "solid" : undefined,
          }}
        />
        {nifFeedback?.kind === "ok" && (
          <span style={{ color: "#1f7a3d", fontSize: "0.85rem" }}>✓ NIF válido.</span>
        )}
        {nifFeedback?.kind === "error" && (
          <span style={{ color: "#b00020", fontSize: "0.85rem" }}>
            {nifReasonCopy[nifFeedback.reason] ?? "NIF inválido."}
          </span>
        )}
      </label>

      <CaePicker name="caeCode" />

      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Forma jurídica</span>
        <select name="legalForm" defaultValue="" style={{ padding: "0.5rem", fontSize: "1rem" }}>
          {legalFormOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Dimensão</span>
        <select
          name="selfReportedSize"
          defaultValue=""
          style={{ padding: "0.5rem", fontSize: "1rem" }}
        >
          {sizeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {state.error && (
        <p style={{ color: "#b00020", margin: 0 }} role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || nifFeedback?.kind === "error"}
        style={{ padding: "0.75rem 1rem", fontSize: "1rem" }}
      >
        {isPending ? "A criar…" : "Criar organização"}
      </button>
    </form>
  );
}
