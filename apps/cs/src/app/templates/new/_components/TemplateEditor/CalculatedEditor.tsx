"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EditorField } from "./template-editor-build";

export function CalculatedEditor({
  field,
  onPatch,
}: {
  field: EditorField;
  onPatch: (patch: Partial<EditorField>) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs">Expressão (referencie outros campos pelo identificador)</Label>
        <Textarea
          value={field.expression}
          onChange={(e) => onPatch({ expression: e.target.value })}
          rows={2}
          placeholder="ex.: actividade * factor"
          className="font-mono"
        />
      </div>
      <div className="max-w-xs space-y-1">
        <Label className="text-xs">Unidade (opcional)</Label>
        <Input
          value={field.unit}
          onChange={(e) => onPatch({ unit: e.target.value })}
          placeholder="kg CO₂e, kWh…"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Operadores suportados: <code className="font-mono">+ - * /</code> e parênteses. Os
        identificadores devem existir no mesmo âmbito (linha principal ou sub-linha).
      </p>
    </div>
  );
}
