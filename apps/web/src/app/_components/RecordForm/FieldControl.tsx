"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
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
        <Input
          id={path}
          value={typeof value === "string" ? value : ""}
          maxLength={field.maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "number":
      return (
        <Input
          id={path}
          inputMode="decimal"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "date":
      return (
        <Input
          id={path}
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
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— escolha —</option>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      );
    case "multi_select": {
      const selected = new Set(Array.isArray(value) ? (value as string[]) : []);
      return (
        <div className="space-y-1.5">
          {field.options.map((opt) => (
            <label key={opt.value} className="inline-flex w-full items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.has(opt.value)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(opt.value);
                  else next.delete(opt.value);
                  onChange(Array.from(next));
                }}
                className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
              />
              {opt.label}
            </label>
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
            "block rounded-md border bg-muted px-3 py-2 font-mono text-sm",
            display.kind === "value" ? "text-primary" : "text-muted-foreground",
          )}
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
            <Button type="button" variant="outline" size="sm" onClick={onAddRow}>
              + Adicionar {field.rowLabel.toLowerCase()}
            </Button>
          )}
        </div>
      );
    }
  }
}
