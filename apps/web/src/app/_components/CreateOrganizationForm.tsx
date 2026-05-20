"use client";

import type { PostalCodeLookupResult, ViesLookupResult } from "@/lib/api-client";
import { validateNif } from "@bgreen/pt-data";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  type CreateOrganizationFormState,
  createOrganizationAction,
  lookupPostalCodeAction,
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
  const [postalCode, setPostalCode] = useState("");
  const [freguesia, setFreguesia] = useState("");
  const [concelho, setConcelho] = useState("");
  const [distrito, setDistrito] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [postalLookup, setPostalLookup] = useState<PostalCodeLookupResult | null>(null);
  const [postalLoading, setPostalLoading] = useState(false);
  const [addressTouched, setAddressTouched] = useState(false);

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

  // Debounced postal-code lookup. Mirrors the VIES pattern.
  const addressTouchedRef = useRef(addressTouched);
  addressTouchedRef.current = addressTouched;

  const postalCodeValid = /^\d{4}-\d{3}$/.test(postalCode);

  useEffect(() => {
    if (!postalCodeValid) {
      setPostalLookup(null);
      setPostalLoading(false);
      return;
    }
    let cancelled = false;
    setPostalLoading(true);
    const timer = setTimeout(async () => {
      const result = await lookupPostalCodeAction(postalCode);
      if (cancelled) return;
      setPostalLookup(result);
      setPostalLoading(false);
      if (result?.found && !addressTouchedRef.current) {
        if (result.freguesia) setFreguesia(result.freguesia);
        if (result.concelho) setConcelho(result.concelho);
        if (result.distrito) setDistrito(result.distrito);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setPostalLoading(false);
    };
  }, [postalCode, postalCodeValid]);

  const addressWasAutoFilled =
    postalLookup?.found === true &&
    !addressTouched &&
    freguesia === (postalLookup.freguesia ?? "") &&
    concelho === (postalLookup.concelho ?? "") &&
    distrito === (postalLookup.distrito ?? "");

  // Auto-format postal code as user types: insert dash after 4 digits.
  function onPostalCodeChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 7);
    setPostalCode(digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits);
  }

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

      <fieldset
        style={{
          display: "grid",
          gap: "0.75rem",
          border: "1px solid #e0e0e0",
          borderRadius: "0.25rem",
          padding: "0.75rem 1rem",
          margin: 0,
        }}
      >
        <legend style={{ padding: "0 0.5rem", fontSize: "0.9rem", color: "#444" }}>
          Endereço (opcional)
        </legend>

        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Código postal</span>
          <input
            name="postalCode"
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="0000-000"
            maxLength={8}
            value={postalCode}
            onChange={(e) => onPostalCodeChange(e.target.value)}
            style={{
              padding: "0.5rem",
              fontSize: "1rem",
              borderColor:
                postalLookup?.found === true
                  ? "#1f7a3d"
                  : postalCode !== "" && !postalCodeValid
                    ? "#b00020"
                    : undefined,
              borderWidth: postalLookup || (postalCode && !postalCodeValid) ? "2px" : undefined,
              borderStyle: postalLookup || (postalCode && !postalCodeValid) ? "solid" : undefined,
            }}
          />
          {postalLoading && (
            <span style={{ color: "#777", fontSize: "0.85rem" }}>A consultar morada…</span>
          )}
          {!postalLoading && postalLookup?.found === false && (
            <span style={{ color: "#a36400", fontSize: "0.85rem" }}>
              Código postal não encontrado — preencha manualmente.
            </span>
          )}
          {!postalLoading && addressWasAutoFilled && (
            <span style={{ color: "#1f7a3d", fontSize: "0.85rem" }}>
              ✓ Morada preenchida automaticamente.
            </span>
          )}
        </label>

        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Morada</span>
          <input
            name="addressLine"
            type="text"
            autoComplete="street-address"
            placeholder="Rua, número, andar…"
            maxLength={200}
            value={addressLine}
            onChange={(e) => {
              setAddressLine(e.target.value);
              setAddressTouched(true);
            }}
            style={{ padding: "0.5rem", fontSize: "1rem" }}
          />
        </label>

        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span>Freguesia</span>
            <input
              name="freguesia"
              type="text"
              maxLength={100}
              value={freguesia}
              onChange={(e) => {
                setFreguesia(e.target.value);
                setAddressTouched(true);
              }}
              style={{ padding: "0.5rem", fontSize: "1rem" }}
            />
          </label>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span>Concelho</span>
            <input
              name="concelho"
              type="text"
              maxLength={100}
              value={concelho}
              onChange={(e) => {
                setConcelho(e.target.value);
                setAddressTouched(true);
              }}
              style={{ padding: "0.5rem", fontSize: "1rem" }}
            />
          </label>
        </div>

        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Distrito</span>
          <input
            name="distrito"
            type="text"
            maxLength={100}
            value={distrito}
            onChange={(e) => {
              setDistrito(e.target.value);
              setAddressTouched(true);
            }}
            style={{ padding: "0.5rem", fontSize: "1rem" }}
          />
        </label>
      </fieldset>

      {state.error && (
        <p style={{ color: "#b00020", margin: 0 }} role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={
          isPending || nifFeedback?.kind === "error" || (postalCode !== "" && !postalCodeValid)
        }
        style={{ padding: "0.75rem 1rem", fontSize: "1rem" }}
      >
        {isPending ? "A criar…" : "Criar organização"}
      </button>
    </form>
  );
}
