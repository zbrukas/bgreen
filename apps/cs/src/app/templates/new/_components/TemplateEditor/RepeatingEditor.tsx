"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="space-y-3 rounded-md border border-dashed bg-muted/40 p-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Nome de cada linha</Label>
          <Input
            value={field.rowLabel}
            onChange={(e) => onPatch({ rowLabel: e.target.value })}
            placeholder="ex.: Veículo"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Mínimo de linhas</Label>
          <Input
            type="number"
            min={0}
            value={field.minRows}
            onChange={(e) => onPatch({ minRows: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Máximo de linhas</Label>
          <Input
            type="number"
            min={1}
            value={field.maxRows}
            onChange={(e) => onPatch({ maxRows: e.target.value })}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
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
        variant="outline"
        size="sm"
        onClick={() => onPatch({ subFields: [...field.subFields, newField()] })}
      >
        + Sub-campo
      </Button>
    </div>
  );
}
