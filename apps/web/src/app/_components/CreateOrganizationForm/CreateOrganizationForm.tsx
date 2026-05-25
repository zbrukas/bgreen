"use client";

import type { PostalCodeLookupResult, ViesLookupResult } from "@/lib/api-client";
import { Checkmark } from "@carbon/icons-react";
import {
  Button,
  InlineNotification,
  Select,
  SelectItem,
  Stack,
  TextInput,
} from "@carbon/react";
import { validateNif } from "@bgreen/pt-data";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  type CreateOrganizationFormState,
  createOrganizationAction,
  lookupPostalCodeAction,
  lookupViesAction,
} from "../../actions";
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

  function onPostalCodeChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 7);
    setPostalCode(digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits);
  }

  // NIF helper-text resolves to ok/loading/warn/error variants. Carbon
  // exposes invalid/warn/helperText as discrete props — only one fires
  // at a time visually.
  const nifInvalid = nifFeedback?.kind === "error";
  const nifInvalidText = nifInvalid
    ? (nifReasonCopy[nifFeedback.reason] ?? "NIF inválido.")
    : undefined;
  const nifWarn = !nifInvalid && !viesLoading && vies?.source === "unreachable";
  const nifWarnText = nifWarn ? "VIES indisponível — preencha manualmente." : undefined;
  const nifHelperText =
    nifInvalid || nifWarn
      ? undefined
      : nifFeedback?.kind === "ok"
        ? viesLoading
          ? "✓ NIF válido. A consultar VIES…"
          : vies?.valid === false
            ? "✓ NIF válido. Não registado no VIES."
            : "✓ NIF válido."
        : undefined;

  const postalInvalid = postalCode !== "" && !postalCodeValid;
  const postalWarn = !postalInvalid && !postalLoading && postalLookup?.found === false;

  return (
    <form action={formAction} className="max-w-lg">
      <Stack gap={5}>
        <div>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 500, margin: 0 }}>
            Criar a sua organização
          </h2>
          <p className="mt-1 text-sm text-neutral-700">
            Indique o NIF — se a sua empresa estiver registada no VIES, preenchemos o nome
            automaticamente.
          </p>
        </div>

        <TextInput
          id="nif"
          name="nif"
          labelText="NIF"
          inputMode="numeric"
          autoComplete="off"
          maxLength={11}
          value={nif}
          onChange={(e) => setNif(e.target.value)}
          invalid={nifInvalid}
          invalidText={nifInvalidText}
          warn={nifWarn}
          warnText={nifWarnText}
          helperText={nifHelperText}
        />

        <div>
          <TextInput
            id="org-name"
            name="name"
            labelText="Nome"
            required
            autoComplete="organization"
            maxLength={200}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameTouched(true);
            }}
            helperText={
              nameWasAutoFilled ? "✓ Verificado via VIES — pode editar se necessário." : undefined
            }
          />
          {vies?.valid && vies.address && !nameTouched && (
            <p className="mt-1 text-xs text-neutral-600">{vies.address}</p>
          )}
        </div>

        <CaePicker name="caeCode" />

        <Select id="legalForm" name="legalForm" labelText="Forma jurídica" defaultValue="">
          {legalFormOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} text={opt.label} />
          ))}
        </Select>

        <Select
          id="selfReportedSize"
          name="selfReportedSize"
          labelText="Dimensão"
          defaultValue=""
        >
          {sizeOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} text={opt.label} />
          ))}
        </Select>

        <fieldset className="space-y-4 rounded-md border border-neutral-200 p-4">
          <legend className="px-2 text-xs text-neutral-600">Endereço (opcional)</legend>

          <TextInput
            id="postalCode"
            name="postalCode"
            labelText="Código postal"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="0000-000"
            maxLength={8}
            value={postalCode}
            onChange={(e) => onPostalCodeChange(e.target.value)}
            invalid={postalInvalid}
            invalidText={postalInvalid ? "Use o formato XXXX-XXX." : undefined}
            warn={postalWarn}
            warnText={
              postalWarn ? "Código postal não encontrado — preencha manualmente." : undefined
            }
            helperText={
              postalLoading
                ? "A consultar morada…"
                : addressWasAutoFilled
                  ? "✓ Morada preenchida automaticamente."
                  : undefined
            }
          />

          <TextInput
            id="addressLine"
            name="addressLine"
            labelText="Morada"
            autoComplete="street-address"
            placeholder="Rua, número, andar…"
            maxLength={200}
            value={addressLine}
            onChange={(e) => {
              setAddressLine(e.target.value);
              setAddressTouched(true);
            }}
          />

          <div className="grid grid-cols-2 gap-3">
            <TextInput
              id="freguesia"
              name="freguesia"
              labelText="Freguesia"
              maxLength={100}
              value={freguesia}
              onChange={(e) => {
                setFreguesia(e.target.value);
                setAddressTouched(true);
              }}
            />
            <TextInput
              id="concelho"
              name="concelho"
              labelText="Concelho"
              maxLength={100}
              value={concelho}
              onChange={(e) => {
                setConcelho(e.target.value);
                setAddressTouched(true);
              }}
            />
          </div>

          <TextInput
            id="distrito"
            name="distrito"
            labelText="Distrito"
            maxLength={100}
            value={distrito}
            onChange={(e) => {
              setDistrito(e.target.value);
              setAddressTouched(true);
            }}
          />
        </fieldset>

        {state.error && (
          <InlineNotification
            kind="error"
            title="Não foi possível criar a organização"
            subtitle={state.error}
            lowContrast
            hideCloseButton
          />
        )}

        <Button
          type="submit"
          kind="primary"
          size="lg"
          disabled={
            isPending || nifFeedback?.kind === "error" || (postalCode !== "" && !postalCodeValid)
          }
          renderIcon={Checkmark}
        >
          {isPending ? "A criar…" : "Criar organização"}
        </Button>
      </Stack>
    </form>
  );
}
