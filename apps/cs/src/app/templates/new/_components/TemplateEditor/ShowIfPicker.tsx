"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
    <details className="border-t border-dotted pt-3">
      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
        Condição de visibilidade {field.showIf.length > 0 && `(${field.showIf.length})`}
      </summary>
      <div className="mt-2 space-y-2">
        {field.showIf.length > 0 && candidates.length === 0 && (
          <p className="text-xs text-destructive">
            Não existem campos anteriores neste âmbito para usar como referência. Reorganize os
            campos ou remova as condições.
          </p>
        )}
        {field.showIf.map((predicate, idx) => (
          <div key={predicate.uiKey} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <Select
              value={predicate.fieldId}
              onChange={(e) => update(idx, { fieldId: e.target.value })}
              className="h-8 text-xs"
            >
              <option value="">— campo anterior —</option>
              {candidates.map((c) => (
                <option key={c.uiKey} value={c.id.trim()}>
                  {c.id.trim()} ({c.label || "?"})
                </option>
              ))}
            </Select>
            <Input
              placeholder="valor exacto"
              value={predicate.equals}
              onChange={(e) => update(idx, { equals: e.target.value })}
              className="h-8 text-xs"
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(idx)}>
              ✕
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPatch({ showIf: [...field.showIf, newShowIf()] })}
          disabled={candidates.length === 0 && field.showIf.length === 0}
        >
          + Condição (E)
        </Button>
        <p className="text-xs text-muted-foreground">
          Todas as condições devem ser satisfeitas (E lógico). Campos ocultos não são validados.
        </p>
      </div>
    </details>
  );
}
