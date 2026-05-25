"use client";

import type { Field, LeafField } from "@bgreen/types";
import { FieldControl } from "./FieldControl";
import { type FormValues, isVisible } from "./record-form-helpers";
import type { KeyedError } from "./utils";

interface FieldInputProps {
  field: Field | LeafField;
  scopeValues: FormValues;
  value: unknown;
  pathPrefix: string;
  errorsByPath: Map<string, KeyedError[]>;
  rowKeys?: string[];
  onChange: (v: unknown) => void;
  onSubChange?: (rowIdx: number, subFieldId: string, value: unknown) => void;
  onAddRow?: () => void;
  onRemoveRow?: (idx: number) => void;
}

export function FieldInput({
  field,
  scopeValues,
  value,
  pathPrefix,
  errorsByPath,
  rowKeys,
  onChange,
  onSubChange,
  onAddRow,
  onRemoveRow,
}: FieldInputProps) {
  if (!isVisible(field, scopeValues)) return null;
  const path = `${pathPrefix}${field.id}`;
  const errors = errorsByPath.get(path) ?? [];

  return (
    <div className="space-y-1.5">
      <label htmlFor={path} className="block space-y-1">
        <span className="text-sm">
          {field.label}
          {field.required && field.kind !== "repeating" ? (
            <span className="text-destructive"> *</span>
          ) : null}
          {field.kind === "number" && field.unit && (
            <span className="text-xs text-muted-foreground"> ({field.unit})</span>
          )}
        </span>
        {field.description && (
          <span className="block text-xs text-muted-foreground">{field.description}</span>
        )}
        <FieldControl
          field={field}
          path={path}
          value={value}
          scopeValues={scopeValues}
          onChange={onChange}
          errorsByPath={errorsByPath}
          rowKeys={rowKeys}
          onSubChange={onSubChange}
          onAddRow={onAddRow}
          onRemoveRow={onRemoveRow}
        />
      </label>
      {errors.map((e) => (
        <p key={e.uiKey} className="text-xs text-destructive" role="alert">
          {e.message}
        </p>
      ))}
    </div>
  );
}
