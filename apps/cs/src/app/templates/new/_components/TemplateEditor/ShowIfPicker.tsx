"use client";

import { Add, TrashCan } from "@carbon/icons-react";
import { Button, Select, SelectItem, TextInput } from "@carbon/react";
import {
  type EditorField,
  type EditorShowIfPredicate,
  newShowIf,
} from "./template-editor-build";

export function ShowIfPicker({
  field,
  siblings,
  onPatch,
}: {
  field: EditorField;
  siblings: EditorField[];
  onPatch: (patch: Partial<EditorField>) => void;
}) {
  const candidates = siblings.filter((s) => s.id.trim() && s.kind !== "repeating");

  function update(idx: number, patch: Partial<EditorShowIfPredicate>) {
    onPatch({ showIf: field.showIf.map((p, i) => (i === idx ? { ...p, ...patch } : p)) });
  }
  function remove(idx: number) {
    onPatch({ showIf: field.showIf.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-2">
      {field.showIf.length > 0 && candidates.length === 0 && (
        <p className="text-xs text-[var(--cds-text-error)]">
          Não existem campos anteriores neste âmbito para usar como referência. Reorganize os
          campos ou remova as condições.
        </p>
      )}
      {field.showIf.map((predicate, idx) => (
        <div key={predicate.uiKey} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <Select
            id={`${field.uiKey}-showif-field-${idx}`}
            labelText=""
            hideLabel
            size="sm"
            value={predicate.fieldId}
            onChange={(e) => update(idx, { fieldId: e.target.value })}
          >
            <SelectItem value="" text="— campo anterior —" />
            {candidates.map((c) => (
              <SelectItem
                key={c.uiKey}
                value={c.id.trim()}
                text={`${c.id.trim()} (${c.label || "?"})`}
              />
            ))}
          </Select>
          <TextInput
            id={`${field.uiKey}-showif-eq-${idx}`}
            labelText=""
            hideLabel
            size="sm"
            placeholder="valor exacto"
            value={predicate.equals}
            onChange={(e) => update(idx, { equals: e.target.value })}
          />
          <Button
            type="button"
            kind="danger--ghost"
            size="sm"
            onClick={() => remove(idx)}
            renderIcon={TrashCan}
            iconDescription="Remover"
            hasIconOnly
          />
        </div>
      ))}
      <Button
        type="button"
        kind="tertiary"
        size="sm"
        onClick={() => onPatch({ showIf: [...field.showIf, newShowIf()] })}
        disabled={candidates.length === 0 && field.showIf.length === 0}
        renderIcon={Add}
      >
        Condição (E)
      </Button>
      <p className="text-xs text-neutral-600">
        Todas as condições devem ser satisfeitas (E lógico). Campos ocultos não são validados.
      </p>
    </div>
  );
}
