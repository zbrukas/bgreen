"use client";

import type {
  ExtractedEconomicProfile,
  ProfileField,
  ValidatorWarning,
} from "@/lib/economic-profile-types";
import { Tag, TextInput } from "@carbon/react";
import { CONFIDENCE_LABEL, CONFIDENCE_TAG_TYPE, FIELD_LABELS } from "./copy";

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
  const effective = edit !== undefined ? edit : extracted.value;
  const inputValue = effective === null || effective === undefined ? "" : String(effective);
  const warningText =
    warnings.length > 0 ? warnings.map((w) => `⚠︎ ${w.message}`).join(" ") : undefined;

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="cds--label" style={{ marginBottom: 0 }}>
          {FIELD_LABELS[field]}
        </span>
        <Tag type={CONFIDENCE_TAG_TYPE[extracted.confidence]} size="sm">
          {CONFIDENCE_LABEL[extracted.confidence]}
        </Tag>
      </div>
      <TextInput
        id={id}
        labelText=""
        hideLabel
        type={isNumeric ? "number" : "text"}
        value={inputValue}
        warn={warnings.length > 0}
        warnText={warningText}
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
    </div>
  );
}
