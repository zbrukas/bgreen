"use client";

import { TrashCan } from "@carbon/icons-react";
import { Button } from "@carbon/react";
import type { LeafField } from "@bgreen/types";
import { FieldInput } from "./FieldInput";
import type { FormValues } from "./record-form-helpers";
import type { KeyedError } from "./utils";

interface RepeatingRowProps {
  field: { rowLabel: string; fields: LeafField[] };
  row: FormValues;
  idx: number;
  path: string;
  errorsByPath: Map<string, KeyedError[]>;
  onSubChange: (subFieldId: string, value: unknown) => void;
  onRemove: () => void;
}

export function RepeatingRow({
  field,
  row,
  idx,
  path,
  errorsByPath,
  onSubChange,
  onRemove,
}: RepeatingRowProps) {
  return (
    <fieldset className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <legend className="px-1 text-xs text-neutral-600">
        {field.rowLabel} {idx + 1}
      </legend>
      {field.fields.map((sub) => (
        <FieldInput
          key={sub.id}
          field={sub}
          scopeValues={row}
          value={row[sub.id]}
          pathPrefix={`${path}[${idx}].`}
          errorsByPath={errorsByPath}
          onChange={(v) => onSubChange(sub.id, v)}
        />
      ))}
      <div className="flex justify-end">
        <Button type="button" kind="ghost" size="sm" onClick={onRemove} renderIcon={TrashCan}>
          Remover linha
        </Button>
      </div>
    </fieldset>
  );
}
