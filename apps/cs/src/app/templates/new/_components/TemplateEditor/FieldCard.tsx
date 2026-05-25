"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { RecordTemplate } from "@bgreen/types";
import { CalculatedEditor } from "./CalculatedEditor";
import { LEAF_KINDS, MAPPABLE_KINDS, TOP_LEVEL_KINDS } from "./field-kinds";
import { OptionsEditor } from "./OptionsEditor";
import { RepeatingEditor } from "./RepeatingEditor";
import { ShowIfPicker } from "./ShowIfPicker";
import { SourceMappingPicker } from "./SourceMappingPicker";
import type { EditorField, EditorFieldKind } from "./template-editor-build";

interface FieldCardProps {
  field: EditorField;
  fieldIdx: number;
  siblings: EditorField[];
  allowRepeating: boolean;
  removable: boolean;
  availableTemplates: Array<Pick<RecordTemplate, "id" | "name" | "status" | "formSchema">>;
  onPatch: (patch: Partial<EditorField>) => void;
  onRemove: () => void;
  onPatchSub?: (subIdx: number, patch: Partial<EditorField>) => void;
}

export function FieldCard({
  field,
  fieldIdx,
  siblings,
  allowRepeating,
  removable,
  availableTemplates,
  onPatch,
  onRemove,
  onPatchSub,
}: FieldCardProps) {
  const kindOptions = allowRepeating ? TOP_LEVEL_KINDS : LEAF_KINDS;
  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Identificador (snake_case)</Label>
          <Input
            value={field.id}
            onChange={(e) => onPatch({ id: e.target.value })}
            placeholder="ex.: kwh_consumo"
            className="font-mono"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Etiqueta</Label>
          <Input
            value={field.label}
            onChange={(e) => onPatch({ label: e.target.value })}
            placeholder="ex.: Consumo de eletricidade"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Tipo</Label>
          <Select
            value={field.kind}
            onChange={(e) => onPatch({ kind: e.target.value as EditorFieldKind })}
            className="h-8 w-auto py-0 text-sm"
          >
            {kindOptions.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </div>
        {field.kind !== "repeating" && (
          <label className="inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => onPatch({ required: e.target.checked })}
              className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
            />
            <span>Obrigatório</span>
          </label>
        )}
      </div>

      {field.kind === "text" && (
        <div className="max-w-xs space-y-1">
          <Label className="text-xs">Comprimento máximo</Label>
          <Input
            type="number"
            min={1}
            value={field.maxLength}
            onChange={(e) => onPatch({ maxLength: e.target.value })}
          />
        </div>
      )}

      {field.kind === "number" && (
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Unidade</Label>
            <Input
              value={field.unit}
              onChange={(e) => onPatch({ unit: e.target.value })}
              placeholder="kWh, m³, kg…"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mínimo</Label>
            <Input
              type="number"
              value={field.min}
              onChange={(e) => onPatch({ min: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Máximo</Label>
            <Input
              type="number"
              value={field.max}
              onChange={(e) => onPatch({ max: e.target.value })}
            />
          </div>
        </div>
      )}

      {field.kind === "date" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Data mínima</Label>
            <Input
              type="date"
              value={field.min}
              onChange={(e) => onPatch({ min: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data máxima</Label>
            <Input
              type="date"
              value={field.max}
              onChange={(e) => onPatch({ max: e.target.value })}
            />
          </div>
        </div>
      )}

      {(field.kind === "select" || field.kind === "multi_select") && (
        <OptionsEditor field={field} onPatch={onPatch} />
      )}

      {field.kind === "multi_select" && (
        <div className="grid max-w-md grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Mínimo de seleções</Label>
            <Input
              type="number"
              min={1}
              value={field.minSelected}
              onChange={(e) => onPatch({ minSelected: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Máximo de seleções</Label>
            <Input
              type="number"
              min={1}
              value={field.maxSelected}
              onChange={(e) => onPatch({ maxSelected: e.target.value })}
            />
          </div>
        </div>
      )}

      {field.kind === "calculated" && <CalculatedEditor field={field} onPatch={onPatch} />}

      {field.kind === "repeating" && (
        <RepeatingEditor
          field={field}
          fieldIdx={fieldIdx}
          onPatch={onPatch}
          onPatchSub={onPatchSub}
          availableTemplates={availableTemplates}
        />
      )}

      <ShowIfPicker field={field} siblings={siblings} onPatch={onPatch} />

      {MAPPABLE_KINDS.has(field.kind) && (
        <SourceMappingPicker
          field={field}
          availableTemplates={availableTemplates}
          onPatch={onPatch}
        />
      )}

      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={!removable}>
          Remover campo
        </Button>
      </div>
    </div>
  );
}
