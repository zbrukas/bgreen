"use client";

import { cn } from "@/lib/utils";
import { Add } from "@carbon/icons-react";
import { Button, Checkbox, Select, SelectItem, TextInput } from "@carbon/react";
import type { Field, LeafField } from "@bgreen/types";
import type { FormValues } from "./record-form-helpers";
import { RepeatingRow } from "./RepeatingRow";
import {
  type KeyedError,
  computeCalculatedDisplay,
  formatNumber,
} from "./utils";

interface FieldControlProps {
  field: Field | LeafField;
  path: string;
  value: unknown;
  scopeValues: FormValues;
  errorsByPath: Map<string, KeyedError[]>;
  rowKeys?: string[];
  onChange: (v: unknown) => void;
  onSubChange?: (rowIdx: number, subFieldId: string, value: unknown) => void;
  onAddRow?: () => void;
  onRemoveRow?: (idx: number) => void;
}

export function FieldControl({
  field,
  path,
  value,
  scopeValues,
  errorsByPath,
  rowKeys,
  onChange,
  onSubChange,
  onAddRow,
  onRemoveRow,
}: FieldControlProps) {
  switch (field.kind) {
    case "text":
      return (
        <TextInput
          id={path}
          labelText=""
          hideLabel
          value={typeof value === "string" ? value : ""}
          maxLength={field.maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "number":
      return (
        <TextInput
          id={path}
          labelText=""
          hideLabel
          inputMode="decimal"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "date":
      return (
        <TextInput
          id={path}
          labelText=""
          hideLabel
          type="date"
          value={typeof value === "string" ? value : ""}
          min={field.min}
          max={field.max}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "select":
      return (
        <Select
          id={path}
          labelText=""
          hideLabel
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <SelectItem value="" text="— escolha —" />
          {field.options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} text={opt.label} />
          ))}
        </Select>
      );
    case "multi_select": {
      const selected = new Set(Array.isArray(value) ? (value as string[]) : []);
      return (
        <div className="space-y-1.5">
          {field.options.map((opt) => (
            <Checkbox
              key={opt.value}
              id={`${path}-${opt.value}`}
              labelText={opt.label}
              checked={selected.has(opt.value)}
              onChange={(_e, { checked }) => {
                const next = new Set(selected);
                if (checked) next.add(opt.value);
                else next.delete(opt.value);
                onChange(Array.from(next));
              }}
            />
          ))}
        </div>
      );
    }
    case "calculated": {
      const display = computeCalculatedDisplay(field.expression, scopeValues);
      return (
        <output
          id={path}
          className={cn(
            "block rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm",
            display.kind === "value" ? "text-[var(--cds-link-primary)]" : "text-neutral-600",
          )}
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          {display.kind === "value"
            ? `${formatNumber(display.value)}${field.unit ? ` ${field.unit}` : ""}`
            : display.kind === "empty"
              ? "—"
              : display.message}
        </output>
      );
    }
    case "repeating": {
      const rows = Array.isArray(value) ? (value as FormValues[]) : [];
      const keys = rowKeys ?? [];
      return (
        <div className="space-y-2">
          {rows.map((row, idx) => (
            <RepeatingRow
              key={keys[idx] ?? `${path}-fallback-${idx}`}
              field={field}
              row={row}
              idx={idx}
              path={path}
              errorsByPath={errorsByPath}
              onSubChange={(subId, v) => onSubChange?.(idx, subId, v)}
              onRemove={() => onRemoveRow?.(idx)}
            />
          ))}
          {(field.maxRows === undefined || rows.length < field.maxRows) && (
            <Button
              type="button"
              kind="tertiary"
              size="sm"
              onClick={onAddRow}
              renderIcon={Add}
            >
              Adicionar {field.rowLabel.toLowerCase()}
            </Button>
          )}
        </div>
      );
    }
  }
}
