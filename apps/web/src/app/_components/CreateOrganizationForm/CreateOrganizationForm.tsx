"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { PostalCodeLookupResult, ViesLookupResult } from "@/lib/api-client";
import { cn } from "@/lib/utils";
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

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <div>
        <h2 className="text-lg font-medium">Criar a sua organização</h2>
        <p className="text-sm text-muted-foreground">
          Indique o NIF — se a sua empresa estiver registada no VIES, preenchemos o nome
          automaticamente.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nif">NIF</Label>
        <Input
          id="nif"
          name="nif"
          inputMode="numeric"
          autoComplete="off"
          maxLength={11}
          value={nif}
          onChange={(e) => setNif(e.target.value)}
          className={cn(
            nifFeedback?.kind === "ok" && "border-emerald-500",
            nifFeedback?.kind === "error" && "border-destructive",
          )}
        />
        {nifFeedback?.kind === "ok" && (
          <p className="text-xs text-emerald-700">
            ✓ NIF válido.
            {viesLoading && <span className="text-muted-foreground"> A consultar VIES…</span>}
            {!viesLoading && vies?.source === "unreachable" && (
              <span className="text-amber-700"> VIES indisponível — preencha manualmente.</span>
            )}
            {!viesLoading && vies?.valid === false && (
              <span className="text-muted-foreground"> Não registado no VIES.</span>
            )}
          </p>
        )}
        {nifFeedback?.kind === "error" && (
          <p className="text-xs text-destructive">
            {nifReasonCopy[nifFeedback.reason] ?? "NIF inválido."}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="org-name">Nome</Label>
        <Input
          id="org-name"
          name="name"
          required
          autoComplete="organization"
          maxLength={200}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameTouched(true);
          }}
          className={cn(nameWasAutoFilled && "border-emerald-500")}
        />
        {nameWasAutoFilled && (
          <p className="text-xs text-emerald-700">
            ✓ Verificado via VIES — pode editar se necessário.
          </p>
        )}
        {vies?.valid && vies.address && !nameTouched && (
          <p className="text-xs text-muted-foreground">{vies.address}</p>
        )}
      </div>

      <CaePicker name="caeCode" />

      <div className="space-y-1.5">
        <Label htmlFor="legalForm">Forma jurídica</Label>
        <Select id="legalForm" name="legalForm" defaultValue="">
          {legalFormOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="selfReportedSize">Dimensão</Label>
        <Select id="selfReportedSize" name="selfReportedSize" defaultValue="">
          {sizeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      <fieldset className="space-y-3 rounded-md border p-4">
        <legend className="px-2 text-xs text-muted-foreground">Endereço (opcional)</legend>

        <div className="space-y-1.5">
          <Label htmlFor="postalCode">Código postal</Label>
          <Input
            id="postalCode"
            name="postalCode"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="0000-000"
            maxLength={8}
            value={postalCode}
            onChange={(e) => onPostalCodeChange(e.target.value)}
            className={cn(
              postalLookup?.found === true && "border-emerald-500",
              postalCode !== "" && !postalCodeValid && "border-destructive",
            )}
          />
          {postalLoading && <p className="text-xs text-muted-foreground">A consultar morada…</p>}
          {!postalLoading && postalLookup?.found === false && (
            <p className="text-xs text-amber-700">
              Código postal não encontrado — preencha manualmente.
            </p>
          )}
          {!postalLoading && addressWasAutoFilled && (
            <p className="text-xs text-emerald-700">✓ Morada preenchida automaticamente.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="addressLine">Morada</Label>
          <Input
            id="addressLine"
            name="addressLine"
            autoComplete="street-address"
            placeholder="Rua, número, andar…"
            maxLength={200}
            value={addressLine}
            onChange={(e) => {
              setAddressLine(e.target.value);
              setAddressTouched(true);
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="freguesia">Freguesia</Label>
            <Input
              id="freguesia"
              name="freguesia"
              maxLength={100}
              value={freguesia}
              onChange={(e) => {
                setFreguesia(e.target.value);
                setAddressTouched(true);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="concelho">Concelho</Label>
            <Input
              id="concelho"
              name="concelho"
              maxLength={100}
              value={concelho}
              onChange={(e) => {
                setConcelho(e.target.value);
                setAddressTouched(true);
              }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="distrito">Distrito</Label>
          <Input
            id="distrito"
            name="distrito"
            maxLength={100}
            value={distrito}
            onChange={(e) => {
              setDistrito(e.target.value);
              setAddressTouched(true);
            }}
          />
        </div>
      </fieldset>

      {state.error && <Alert variant="destructive">{state.error}</Alert>}

      <Button
        type="submit"
        disabled={
          isPending || nifFeedback?.kind === "error" || (postalCode !== "" && !postalCodeValid)
        }
        size="lg"
      >
        {isPending ? "A criar…" : "Criar organização"}
      </Button>
    </form>
  );
}
