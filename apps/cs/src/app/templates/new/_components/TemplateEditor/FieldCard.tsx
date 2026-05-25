"use client";

import { TrashCan } from "@carbon/icons-react";
import { Button, Checkbox, Select, SelectItem, TextInput } from "@carbon/react";
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
    <div className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <div className="grid grid-cols-2 gap-3">
        <TextInput
          id={`${field.uiKey}-id`}
          labelText="Identificador (snake_case)"
          value={field.id}
          onChange={(e) => onPatch({ id: e.target.value })}
          placeholder="ex.: kwh_consumo"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        />
        <TextInput
          id={`${field.uiKey}-label`}
          labelText="Etiqueta"
          value={field.label}
          onChange={(e) => onPatch({ label: e.target.value })}
          placeholder="ex.: Consumo de eletricidade"
        />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[12rem]">
          <Select
            id={`${field.uiKey}-kind`}
            labelText="Tipo"
            size="sm"
            value={field.kind}
            onChange={(e) => onPatch({ kind: e.target.value as EditorFieldKind })}
          >
            {kindOptions.map((k) => (
              <SelectItem key={k.value} value={k.value} text={k.label} />
            ))}
          </Select>
        </div>
        {field.kind !== "repeating" && (
          <Checkbox
            id={`${field.uiKey}-required`}
            labelText="Obrigatório"
            checked={field.required}
            onChange={(_e, { checked }) => onPatch({ required: checked })}
          />
        )}
      </div>

      {field.kind === "text" && (
        <div className="max-w-xs">
          <TextInput
            id={`${field.uiKey}-maxLength`}
            labelText="Comprimento máximo"
            type="number"
            min={1}
            value={field.maxLength}
            onChange={(e) => onPatch({ maxLength: e.target.value })}
          />
        </div>
      )}

      {field.kind === "number" && (
        <div className="grid grid-cols-3 gap-2">
          <TextInput
            id={`${field.uiKey}-unit`}
            labelText="Unidade"
            value={field.unit}
            onChange={(e) => onPatch({ unit: e.target.value })}
            placeholder="kWh, m³, kg…"
          />
          <TextInput
            id={`${field.uiKey}-min`}
            labelText="Mínimo"
            type="number"
            value={field.min}
            onChange={(e) => onPatch({ min: e.target.value })}
          />
          <TextInput
            id={`${field.uiKey}-max`}
            labelText="Máximo"
            type="number"
            value={field.max}
            onChange={(e) => onPatch({ max: e.target.value })}
          />
        </div>
      )}

      {field.kind === "date" && (
        <div className="grid grid-cols-2 gap-2">
          <TextInput
            id={`${field.uiKey}-min`}
            labelText="Data mínima"
            type="date"
            value={field.min}
            onChange={(e) => onPatch({ min: e.target.value })}
          />
          <TextInput
            id={`${field.uiKey}-max`}
            labelText="Data máxima"
            type="date"
            value={field.max}
            onChange={(e) => onPatch({ max: e.target.value })}
          />
        </div>
      )}

      {(field.kind === "select" || field.kind === "multi_select") && (
        <OptionsEditor field={field} onPatch={onPatch} />
      )}

      {field.kind === "multi_select" && (
        <div className="grid max-w-md grid-cols-2 gap-2">
          <TextInput
            id={`${field.uiKey}-minSelected`}
            labelText="Mínimo de seleções"
            type="number"
            min={1}
            value={field.minSelected}
            onChange={(e) => onPatch({ minSelected: e.target.value })}
          />
          <TextInput
            id={`${field.uiKey}-maxSelected`}
            labelText="Máximo de seleções"
            type="number"
            min={1}
            value={field.maxSelected}
            onChange={(e) => onPatch({ maxSelected: e.target.value })}
          />
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
        <Button
          type="button"
          kind="ghost"
          size="sm"
          onClick={onRemove}
          disabled={!removable}
          renderIcon={TrashCan}
        >
          Remover campo
        </Button>
      </div>
    </div>
  );
}
