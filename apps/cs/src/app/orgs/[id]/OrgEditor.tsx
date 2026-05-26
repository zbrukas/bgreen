"use client";

import { Save } from "@carbon/icons-react";
import {
  Button,
  InlineNotification,
  Select,
  SelectItem,
  Stack,
  TextInput,
} from "@carbon/react";
import { useState, useTransition } from "react";
import type { OrgDetail, UpdateOrgInput } from "@/lib/api-client";
import { updateOrgAction } from "./actions";

interface OrgEditorProps {
  organization: OrgDetail["organization"];
}

const LEGAL_FORMS = ["sa", "lda", "unipessoal", "cooperativa", "outra"] as const;
const SIZES = ["micro", "pequena", "media", "grande"] as const;

const LEGAL_LABEL: Record<(typeof LEGAL_FORMS)[number], string> = {
  sa: "Sociedade Anónima (SA)",
  lda: "Sociedade por Quotas (Lda.)",
  unipessoal: "Unipessoal",
  cooperativa: "Cooperativa",
  outra: "Outra",
};

const SIZE_LABEL: Record<(typeof SIZES)[number], string> = {
  micro: "Micro",
  pequena: "Pequena",
  media: "Média",
  grande: "Grande",
};

function nullableString(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function OrgEditor({ organization }: OrgEditorProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    const patch: UpdateOrgInput = {
      name: typeof formData.get("name") === "string" ? String(formData.get("name")) : undefined,
      nif: nullableString(formData.get("nif")),
      caeCode: nullableString(formData.get("caeCode")),
      legalForm: nullableString(formData.get("legalForm")),
      selfReportedSize: nullableString(formData.get("selfReportedSize")),
      postalCode: nullableString(formData.get("postalCode")),
      addressLine: nullableString(formData.get("addressLine")),
      freguesia: nullableString(formData.get("freguesia")),
      concelho: nullableString(formData.get("concelho")),
      distrito: nullableString(formData.get("distrito")),
      logoUrl: nullableString(formData.get("logoUrl")),
      brandPrimaryColor: nullableString(formData.get("brandPrimaryColor")),
    };
    const result = await updateOrgAction(organization.id, patch);
    if (!result.ok) setError(result.error);
    else setSaved(true);
  }

  return (
    <form
      action={(formData) => {
        startTransition(() => {
          onSubmit(formData);
        });
      }}
    >
      <Stack gap={6}>
        {error && (
          <InlineNotification
            kind="error"
            title="Erro ao guardar"
            subtitle={error}
            lowContrast
            hideCloseButton
          />
        )}
        {saved && (
          <InlineNotification
            kind="success"
            title="Guardado"
            subtitle="As alterações foram aplicadas."
            lowContrast
            onClose={() => setSaved(false)}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            id="name"
            name="name"
            labelText="Nome"
            defaultValue={organization.name}
            required
          />
          <TextInput
            id="nif"
            name="nif"
            labelText="NIF"
            defaultValue={organization.nif ?? ""}
          />
          <TextInput
            id="caeCode"
            name="caeCode"
            labelText="CAE"
            defaultValue={organization.caeCode ?? ""}
          />
          <Select
            id="legalForm"
            name="legalForm"
            labelText="Forma legal"
            defaultValue={organization.legalForm ?? ""}
          >
            <SelectItem value="" text="—" />
            {LEGAL_FORMS.map((lf) => (
              <SelectItem key={lf} value={lf} text={LEGAL_LABEL[lf]} />
            ))}
          </Select>
          <Select
            id="selfReportedSize"
            name="selfReportedSize"
            labelText="Dimensão auto-declarada"
            defaultValue={organization.selfReportedSize ?? ""}
          >
            <SelectItem value="" text="—" />
            {SIZES.map((s) => (
              <SelectItem key={s} value={s} text={SIZE_LABEL[s]} />
            ))}
          </Select>
          <TextInput
            id="postalCode"
            name="postalCode"
            labelText="Código postal"
            defaultValue={organization.postalCode ?? ""}
          />
          <TextInput
            id="addressLine"
            name="addressLine"
            labelText="Morada"
            defaultValue={organization.addressLine ?? ""}
          />
          <TextInput
            id="freguesia"
            name="freguesia"
            labelText="Freguesia"
            defaultValue={organization.freguesia ?? ""}
          />
          <TextInput
            id="concelho"
            name="concelho"
            labelText="Concelho"
            defaultValue={organization.concelho ?? ""}
          />
          <TextInput
            id="distrito"
            name="distrito"
            labelText="Distrito"
            defaultValue={organization.distrito ?? ""}
          />
          <TextInput
            id="logoUrl"
            name="logoUrl"
            labelText="URL do logótipo"
            defaultValue={organization.logoUrl ?? ""}
          />
          <TextInput
            id="brandPrimaryColor"
            name="brandPrimaryColor"
            labelText="Cor principal (#RRGGBB)"
            defaultValue={organization.brandPrimaryColor ?? ""}
            placeholder="#63b995"
          />
        </div>
        <div>
          <Button type="submit" kind="primary" renderIcon={Save} disabled={pending}>
            {pending ? "A guardar…" : "Guardar"}
          </Button>
        </div>
      </Stack>
    </form>
  );
}
