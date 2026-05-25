"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type {
  ExtractedEconomicProfile,
  ExtractionEdits,
  ProfileField,
  ValidatorWarning,
} from "@/lib/economic-profile-types";
import { NUMERIC_FIELDS } from "./copy";
import { FieldRow } from "./FieldRow";

export function ResultForm({
  extraction,
  warnings,
  edits,
  onChange,
  onConfirm,
  onCancel,
  isConfirming,
  isCancelling,
  confirmError,
}: {
  extraction: ExtractedEconomicProfile;
  warnings: ValidatorWarning[];
  edits: ExtractionEdits;
  onChange: (next: ExtractionEdits) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming: boolean;
  isCancelling: boolean;
  confirmError: string | null;
}) {
  const warningsByField = new Map<ProfileField | "_global", ValidatorWarning[]>();
  for (const w of warnings) {
    const key = w.field ?? "_global";
    const list = warningsByField.get(key) ?? [];
    list.push(w);
    warningsByField.set(key, list);
  }

  function setField<K extends ProfileField>(
    field: K,
    value: ExtractionEdits[K] | undefined,
  ): void {
    const next = { ...edits };
    if (value === undefined) delete next[field];
    else next[field] = value;
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Reveja os valores extraídos. Cada campo mostra a confiança da IA — pode editar antes de
        confirmar.
      </p>
      <div className="grid gap-4">
        {(["year", "employees", "turnover", "ebitda", "balanceSheetTotal", "cae"] as ProfileField[]).map(
          (field) => (
            <FieldRow
              key={field}
              field={field}
              extracted={extraction[field]}
              edit={edits[field]}
              isNumeric={NUMERIC_FIELDS.includes(field)}
              warnings={warningsByField.get(field) ?? []}
              onChange={(v) => setField(field, v as ExtractionEdits[typeof field])}
            />
          ),
        )}
      </div>
      {confirmError ? <Alert variant="destructive">{confirmError}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onConfirm} disabled={isConfirming || isCancelling}>
          {isConfirming ? "A guardar…" : "Confirmar e guardar"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={isConfirming || isCancelling}>
          {isCancelling ? "A cancelar…" : "Cancelar"}
        </Button>
      </div>
    </div>
  );
}
