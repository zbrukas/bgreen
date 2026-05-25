"use client";

import { Add } from "@carbon/icons-react";
import { Button, TextInput } from "@carbon/react";
import type { RecordTemplate } from "@bgreen/types";
import { FieldCard } from "./FieldCard";
import { type EditorField, newField } from "./template-editor-build";

export function RepeatingEditor({
  field,
  fieldIdx: _fieldIdx,
  onPatch,
  onPatchSub,
  availableTemplates,
}: {
  field: EditorField;
  fieldIdx: number;
  onPatch: (patch: Partial<EditorField>) => void;
  onPatchSub?: (subIdx: number, patch: Partial<EditorField>) => void;
  availableTemplates: Array<Pick<RecordTemplate, "id" | "name" | "status" | "formSchema">>;
}) {
  return (
    <div className="space-y-3 rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-3">
      <div className="grid grid-cols-3 gap-2">
        <TextInput
          id={`${field.uiKey}-rowLabel`}
          labelText="Nome de cada linha"
          value={field.rowLabel}
          onChange={(e) => onPatch({ rowLabel: e.target.value })}
          placeholder="ex.: Veículo"
        />
        <TextInput
          id={`${field.uiKey}-minRows`}
          labelText="Mínimo de linhas"
          type="number"
          min={0}
          value={field.minRows}
          onChange={(e) => onPatch({ minRows: e.target.value })}
        />
        <TextInput
          id={`${field.uiKey}-maxRows`}
          labelText="Máximo de linhas"
          type="number"
          min={1}
          value={field.maxRows}
          onChange={(e) => onPatch({ maxRows: e.target.value })}
        />
      </div>

      <p className="text-xs text-neutral-600">
        Sub-campos (não podem conter outras linhas repetidas):
      </p>

      {field.subFields.map((sub, subIdx) => (
        <FieldCard
          key={sub.uiKey}
          field={sub}
          fieldIdx={subIdx}
          siblings={field.subFields.slice(0, subIdx)}
          allowRepeating={false}
          availableTemplates={availableTemplates}
          removable={field.subFields.length > 1}
          onPatch={(patch) => onPatchSub?.(subIdx, patch)}
          onRemove={() => onPatch({ subFields: field.subFields.filter((_, i) => i !== subIdx) })}
        />
      ))}

      <Button
        type="button"
        kind="tertiary"
        size="sm"
        onClick={() => onPatch({ subFields: [...field.subFields, newField()] })}
        renderIcon={Add}
      >
        Sub-campo
      </Button>
    </div>
  );
}
