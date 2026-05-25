import type { Field, LeafField } from "@bgreen/types";
import { formatNumber } from "./utils";

function renderValue(field: Field | LeafField, value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  switch (field.kind) {
    case "select":
      return field.options.find((o) => o.value === value)?.label ?? String(value);
    case "multi_select":
      if (!Array.isArray(value)) return "—";
      if (value.length === 0) return "—";
      return value
        .map((v) => field.options.find((o) => o.value === v)?.label ?? String(v))
        .join(", ");
    case "number":
      return field.unit ? `${value} ${field.unit}` : String(value);
    case "calculated":
      if (typeof value !== "number") return "—";
      return field.unit ? `${formatNumber(value)} ${field.unit}` : formatNumber(value);
    case "repeating":
      if (!Array.isArray(value) || value.length === 0) return "—";
      return `${value.length} ${value.length === 1 ? "linha" : "linhas"}`;
    default:
      return String(value);
  }
}

export function ReadOnlyField({ field, value }: { field: Field | LeafField; value: unknown }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2 text-sm">
      <dt className="font-medium">{field.label}:</dt>
      <dd className="text-muted-foreground">{renderValue(field, value)}</dd>
    </div>
  );
}
