"use client";

import { useActionState } from "react";
import { type CreateOrganizationFormState, createOrganizationAction } from "../actions";

const legalFormOptions: Array<{ value: string; label: string }> = [
  { value: "", label: "— Selecione (opcional) —" },
  { value: "sociedade_anonima", label: "Sociedade Anónima" },
  { value: "sociedade_quotas", label: "Sociedade por Quotas" },
  {
    value: "sociedade_unipessoal_quotas",
    label: "Sociedade Unipessoal por Quotas",
  },
  { value: "empresario_individual", label: "Empresário em Nome Individual" },
  { value: "associacao", label: "Associação" },
  { value: "cooperativa", label: "Cooperativa" },
  { value: "outro", label: "Outro" },
];

const initialState: CreateOrganizationFormState = { error: null };

export function CreateOrganizationForm() {
  const [state, formAction, isPending] = useActionState(createOrganizationAction, initialState);

  return (
    <form action={formAction} style={{ display: "grid", gap: "1rem", maxWidth: 420 }}>
      <h2 style={{ margin: 0 }}>Criar a sua organização</h2>
      <p style={{ margin: 0, color: "#555" }}>
        Para começar, indique o nome da sua organização. Mais detalhes (NIF, CAE, endereço) entram
        na fase V3.
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
        <span>Forma jurídica</span>
        <select name="legalForm" defaultValue="" style={{ padding: "0.5rem", fontSize: "1rem" }}>
          {legalFormOptions.map((opt) => (
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
        disabled={isPending}
        style={{ padding: "0.75rem 1rem", fontSize: "1rem" }}
      >
        {isPending ? "A criar…" : "Criar organização"}
      </button>
    </form>
  );
}
