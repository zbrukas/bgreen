"use client";

import { TextArea, TextInput } from "@carbon/react";
import type { EditorField } from "./template-editor-build";

export function CalculatedEditor({
  field,
  onPatch,
}: {
  field: EditorField;
  onPatch: (patch: Partial<EditorField>) => void;
}) {
  return (
    <div className="space-y-3">
      <TextArea
        id={`expression-${field.id}`}
        labelText="Expressão (referencie outros campos pelo identificador)"
        value={field.expression}
        onChange={(e) => onPatch({ expression: e.target.value })}
        rows={2}
        placeholder="ex.: actividade * factor"
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      />
      <div className="max-w-xs">
        <TextInput
          id={`unit-${field.id}`}
          labelText="Unidade (opcional)"
          value={field.unit}
          onChange={(e) => onPatch({ unit: e.target.value })}
          placeholder="kg CO₂e, kWh…"
        />
      </div>
      <p className="text-xs text-neutral-600">
        Operadores suportados:{" "}
        <code style={{ fontFamily: "'IBM Plex Mono', monospace" }}>+ - * /</code> e parênteses. Os
        identificadores devem existir no mesmo âmbito (linha principal ou sub-linha).
      </p>
    </div>
  );
}
