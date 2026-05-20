"use client";

import type { ViesLookupResult } from "@/lib/api-client";
import { validateNif } from "@bgreen/pt-data";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  type CreateOrganizationFormState,
  createOrganizationAction,
  lookupViesAction,
} from "../actions";
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
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [vies, setVies] = useState<ViesLookupResult | null>(null);
  const [viesLoading, setViesLoading] = useState(false);

  const nifFeedback = useMemo(() => {
    if (nif.trim() === "") return null;
    const result = validateNif(nif);
    if (result.valid) return { kind: "ok" as const, normalized: result.normalized };
    return { kind: "error" as const, reason: result.reason };
  }, [nif]);

  const validNormalizedNif = nifFeedback?.kind === "ok" ? nifFeedback.normalized : null;

  // Debounced VIES lookup whenever the NIF becomes valid. Auto-fills the
  // name field only if the user hasn't typed into it.
  const nameTouchedRef = useRef(nameTouched);
  nameTouchedRef.current = nameTouched;

  useEffect(() => {
    if (!validNormalizedNif) {
      setVies(null);
      setViesLoading(false);
      return;
    }
    let cancelled = false;
    setViesLoading(true);
    const timer = setTimeout(async () => {
      const result = await lookupViesAction(validNormalizedNif);
      if (cancelled) return;
      setVies(result);
      setViesLoading(false);
      if (result?.valid && result.name && !nameTouchedRef.current) {
        setName(result.name);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setViesLoading(false);
    };
  }, [validNormalizedNif]);

  const nameWasAutoFilled =
    vies?.valid === true && vies.name !== null && name === vies.name && !nameTouched;

  return (
    <form action={formAction} style={{ display: "grid", gap: "1rem", maxWidth: 480 }}>
      <h2 style={{ margin: 0 }}>Criar a sua organização</h2>
      <p style={{ margin: 0, color: "#555" }}>
        Indique o NIF — se a sua empresa estiver registada no VIES, preenchemos o nome
        automaticamente.
      </p>

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
          <span style={{ color: "#1f7a3d", fontSize: "0.85rem" }}>
            ✓ NIF válido.
            {viesLoading && <span style={{ color: "#777" }}> A consultar VIES…</span>}
            {!viesLoading && vies?.source === "unreachable" && (
              <span style={{ color: "#a36400" }}> VIES indisponível — preencha manualmente.</span>
            )}
            {!viesLoading && vies?.valid === false && (
              <span style={{ color: "#777" }}> Não registado no VIES.</span>
            )}
          </span>
        )}
        {nifFeedback?.kind === "error" && (
          <span style={{ color: "#b00020", fontSize: "0.85rem" }}>
            {nifReasonCopy[nifFeedback.reason] ?? "NIF inválido."}
          </span>
        )}
      </label>

      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Nome</span>
        <input
          name="name"
          type="text"
          required
          autoComplete="organization"
          maxLength={200}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameTouched(true);
          }}
          style={{
            padding: "0.5rem",
            fontSize: "1rem",
            borderColor: nameWasAutoFilled ? "#1f7a3d" : undefined,
            borderWidth: nameWasAutoFilled ? "2px" : undefined,
            borderStyle: nameWasAutoFilled ? "solid" : undefined,
          }}
        />
        {nameWasAutoFilled && (
          <span style={{ color: "#1f7a3d", fontSize: "0.85rem" }}>
            ✓ Verificado via VIES — pode editar se necessário.
          </span>
        )}
        {vies?.valid && vies.address && !nameTouched && (
          <span style={{ color: "#666", fontSize: "0.8rem" }}>{vies.address}</span>
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
