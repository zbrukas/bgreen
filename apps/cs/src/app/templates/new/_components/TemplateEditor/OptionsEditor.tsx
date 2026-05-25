"use client";

import { Add, TrashCan } from "@carbon/icons-react";
import { Button, TextInput } from "@carbon/react";
import type { EditorField } from "./template-editor-build";

export function OptionsEditor({
  field,
  onPatch,
}: {
  field: EditorField;
  onPatch: (patch: Partial<EditorField>) => void;
}) {
  function update(idx: number, patch: { value?: string; label?: string }) {
    onPatch({ options: field.options.map((o, i) => (i === idx ? { ...o, ...patch } : o)) });
  }
  function remove(idx: number) {
    onPatch({ options: field.options.filter((_, i) => i !== idx) });
  }
  return (
    <div className="space-y-2">
      <p className="cds--label" style={{ marginBottom: 0 }}>
        Opções
      </p>
      {field.options.length === 0 && (
        <p className="text-xs text-neutral-600">Sem opções ainda — adicione pelo menos uma.</p>
      )}
      {field.options.map((opt, optIdx) => (
        <div
          key={`${field.uiKey}-opt-${optIdx}`}
          className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"
        >
          <TextInput
            id={`${field.uiKey}-opt-value-${optIdx}`}
            labelText=""
            hideLabel
            placeholder="valor"
            value={opt.value}
            onChange={(e) => update(optIdx, { value: e.target.value })}
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          />
          <TextInput
            id={`${field.uiKey}-opt-label-${optIdx}`}
            labelText=""
            hideLabel
            placeholder="etiqueta"
            value={opt.label}
            onChange={(e) => update(optIdx, { label: e.target.value })}
          />
          <Button
            type="button"
            kind="ghost"
            size="sm"
            onClick={() => remove(optIdx)}
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
        onClick={() => onPatch({ options: [...field.options, { value: "", label: "" }] })}
        renderIcon={Add}
      >
        Opção
      </Button>
    </div>
  );
}
