// Rich table: optional merged header band (colSpan groups), zebra rows,
// and highlighted total/subtotal rows. Dynamic colors (zebra surface,
// total-row fill) are applied via inline style — driven by the brand
// theme — mirroring how the existing status pills color themselves
// inline rather than via static CSS.

import type { BrandTheme } from "./brand.js";
import { formatNumber } from "./format.js";

export interface RichTableColumn {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  width?: string;
  mono?: boolean;
}

// A merged top header cell spanning `span` columns.
export interface RichTableHeaderGroup {
  label: string;
  span: number;
}

export interface RichTableRow {
  cells: Record<string, string | number>;
  emphasis?: "none" | "total" | "subtotal";
}

export interface RichTableProps {
  columns: RichTableColumn[];
  headerGroups?: RichTableHeaderGroup[];
  rows: RichTableRow[];
  zebra?: boolean;
  theme: BrandTheme;
  caption?: string;
  numberFormat?: (n: number) => string;
}

export function RichTable({
  columns,
  headerGroups,
  rows,
  zebra = true,
  theme,
  caption,
  numberFormat = (n) => formatNumber(n, 1),
}: RichTableProps) {
  return (
    <table className="rich-table">
      {caption ? <caption className="rich-table-caption">{caption}</caption> : null}
      <thead>
        {headerGroups && headerGroups.length > 0 ? (
          <tr className="rich-table-group-row">
            {headerGroups.map((g, i) => (
              <th key={i} colSpan={g.span} style={{ backgroundColor: theme.secondary, color: "#ffffff" }}>
                {g.label}
              </th>
            ))}
          </tr>
        ) : null}
        <tr className="rich-table-head-row">
          {columns.map((c) => (
            <th
              key={c.key}
              className={alignClass(c.align)}
              style={{ backgroundColor: theme.primary, color: "#ffffff", width: c.width }}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => {
          const isTotal = row.emphasis === "total";
          const isSubtotal = row.emphasis === "subtotal";
          const zebraBg = zebra && !isTotal && !isSubtotal && ri % 2 === 1 ? theme.surface : undefined;
          const bg = isTotal ? theme.surface : isSubtotal ? theme.surface : zebraBg;
          return (
            <tr
              key={ri}
              className={isTotal ? "rich-table-total" : isSubtotal ? "rich-table-subtotal" : ""}
              style={bg ? { backgroundColor: bg } : undefined}
            >
              {columns.map((c) => {
                const raw = row.cells[c.key];
                const text = typeof raw === "number" ? numberFormat(raw) : (raw ?? "");
                return (
                  <td
                    key={c.key}
                    className={`${alignClass(c.align)}${c.mono ? " mono" : ""}`}
                    style={isTotal ? { fontWeight: 700 } : undefined}
                  >
                    {text}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function alignClass(align?: "left" | "right" | "center"): string {
  if (align === "right") return "num";
  if (align === "center") return "center";
  return "";
}
