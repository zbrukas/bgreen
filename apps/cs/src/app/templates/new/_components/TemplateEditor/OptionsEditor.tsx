"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <Label className="text-xs">Opções</Label>
      {field.options.length === 0 && (
        <p className="text-xs text-muted-foreground">Sem opções ainda — adicione pelo menos uma.</p>
      )}
      {field.options.map((opt, optIdx) => (
        <div key={`${field.uiKey}-opt-${optIdx}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <Input
            placeholder="valor"
            value={opt.value}
            onChange={(e) => update(optIdx, { value: e.target.value })}
            className="font-mono"
          />
          <Input
            placeholder="etiqueta"
            value={opt.label}
            onChange={(e) => update(optIdx, { label: e.target.value })}
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => remove(optIdx)}>
            ✕
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onPatch({ options: [...field.options, { value: "", label: "" }] })}
      >
        + Opção
      </Button>
    </div>
  );
}
