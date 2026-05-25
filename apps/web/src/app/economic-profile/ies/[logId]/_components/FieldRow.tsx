"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  ExtractedEconomicProfile,
  ProfileField,
  ValidatorWarning,
} from "@/lib/economic-profile-types";
import { CONFIDENCE_LABEL, CONFIDENCE_VARIANT, FIELD_LABELS } from "./copy";

export function FieldRow({
  field,
  extracted,
  edit,
  isNumeric,
  warnings,
  onChange,
}: {
  field: ProfileField;
  extracted: ExtractedEconomicProfile[ProfileField];
  edit: number | string | null | undefined;
  isNumeric: boolean;
  warnings: ValidatorWarning[];
  onChange: (value: number | string | null | undefined) => void;
}) {
  const id = `field-${field}`;
  // Display value: edit if present (even if null), otherwise the
  // extracted value. Null → empty string in the input.
  const effective = edit !== undefined ? edit : extracted.value;
  const inputValue = effective === null || effective === undefined ? "" : String(effective);

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor={id}>{FIELD_LABELS[field]}</Label>
        <Badge variant={CONFIDENCE_VARIANT[extracted.confidence]}>
          {CONFIDENCE_LABEL[extracted.confidence]}
        </Badge>
      </div>
      <Input
        id={id}
        type={isNumeric ? "number" : "text"}
        value={inputValue}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(null);
            return;
          }
          if (isNumeric) {
            const n = Number(raw);
            onChange(Number.isFinite(n) ? n : undefined);
          } else {
            onChange(raw);
          }
        }}
      />
      {warnings.length > 0 ? (
        <ul className="text-xs text-amber-700">
          {warnings.map((w) => (
            <li key={w.rule}>⚠︎ {w.message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
