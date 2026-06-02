// Extracts GHG emissions totals from a submitted record's values by a
// field-id convention. Phase 2 of the carbon-footprint report: the
// builder finds the org's latest submitted record under a template
// whose schema carries these fields, and reads the scope totals out.
//
// CONVENTION (single source of truth): the field ids below match the
// seeded ESG "Ambiente (ESRS E1)" template. If templates collect
// emissions under different ids, adjust EMISSION_FIELDS — nothing else
// changes. Extraction is best-effort and returns null when none of the
// recognised fields are present, so non-emissions templates are
// transparently ignored.

import type { FormSchema, RecordValues } from "@bgreen/types";

export const EMISSION_FIELDS = {
  scope1: "scope1_tco2e",
  scope2Location: "scope2_loc",
  scope2Market: "scope2_mkt",
  // Repeating field holding one sub-row per Scope 3 category.
  scope3Repeating: "scope3_categorias",
  // Sub-field ids inside each Scope 3 sub-row.
  scope3RowValue: "emissoes_tco2e",
  scope3RowCategory: "categoria",
} as const;

const KNOWN_TOP_LEVEL_IDS: ReadonlySet<string> = new Set([
  EMISSION_FIELDS.scope1,
  EMISSION_FIELDS.scope2Location,
  EMISSION_FIELDS.scope2Market,
  EMISSION_FIELDS.scope3Repeating,
]);

export interface EmissionsSourceRow {
  scope: "1" | "2" | "3";
  category: string;
  source: string;
  tco2e: number;
}

export interface EmissionsExtract {
  scope1Total: number;
  scope2LocationTotal: number;
  scope2MarketTotal: number | null;
  scope3Total: number | null;
  // Coarse per-scope source rows for the deck table/donut. Detail is
  // limited to what the template collects (today: one row per scope,
  // plus one row per Scope 3 category sub-row).
  sources: EmissionsSourceRow[];
}

// Does this schema collect any recognised emissions field? Used to
// skip templates that aren't emissions inventories.
export function templateHasEmissions(schema: FormSchema): boolean {
  for (const row of schema.rows) {
    for (const field of row.fields) {
      if (KNOWN_TOP_LEVEL_IDS.has(field.id)) return true;
    }
  }
  return false;
}

// Coerce a stored value (number, or pt-PT string like "12,5") to a
// finite number, or null.
function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

// Build a value→label map for the Scope 3 category select, so source
// rows read "1 — Bens e serviços adquiridos" instead of the raw "c1"
// option code. Returns an empty map when the field/options aren't found.
function scope3CategoryLabels(schema: FormSchema): Map<string, string> {
  const labels = new Map<string, string>();
  for (const row of schema.rows) {
    for (const field of row.fields) {
      if (field.kind !== "repeating" || field.id !== EMISSION_FIELDS.scope3Repeating) continue;
      for (const sub of field.fields) {
        if (sub.kind === "select" && sub.id === EMISSION_FIELDS.scope3RowCategory) {
          for (const opt of sub.options) labels.set(opt.value, opt.label);
        }
      }
    }
  }
  return labels;
}

export function extractEmissions(
  values: RecordValues,
  schema: FormSchema,
): EmissionsExtract | null {
  const categoryLabels = scope3CategoryLabels(schema);
  const scope1 = num(values[EMISSION_FIELDS.scope1]);
  const scope2Loc = num(values[EMISSION_FIELDS.scope2Location]);
  const scope2Mkt = num(values[EMISSION_FIELDS.scope2Market]);

  // Scope 3: sum the repeating sub-rows.
  let scope3Total: number | null = null;
  const scope3Rows: EmissionsSourceRow[] = [];
  const rep = values[EMISSION_FIELDS.scope3Repeating];
  if (Array.isArray(rep)) {
    let sum = 0;
    let any = false;
    for (const row of rep) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const v = num(r[EMISSION_FIELDS.scope3RowValue]);
      if (v === null) continue;
      any = true;
      sum += v;
      const cat = r[EMISSION_FIELDS.scope3RowCategory];
      const code = typeof cat === "string" && cat.length > 0 ? cat : null;
      const source = code ? (categoryLabels.get(code) ?? code) : "Categoria";
      scope3Rows.push({ scope: "3", category: "Cadeia de valor", source, tco2e: v });
    }
    if (any) scope3Total = sum;
  }

  // No recognised fields → not an emissions record.
  if (scope1 === null && scope2Loc === null && scope2Mkt === null && scope3Total === null) {
    return null;
  }

  const s1 = scope1 ?? 0;
  const s2loc = scope2Loc ?? 0;

  const sources: EmissionsSourceRow[] = [];
  if (s1 > 0) {
    sources.push({ scope: "1", category: "Emissões diretas", source: "Total Âmbito 1", tco2e: s1 });
  }
  if (s2loc > 0) {
    sources.push({
      scope: "2",
      category: "Energia adquirida",
      source: "Eletricidade (localização)",
      tco2e: s2loc,
    });
  }
  sources.push(...scope3Rows);

  return {
    scope1Total: s1,
    scope2LocationTotal: s2loc,
    scope2MarketTotal: scope2Mkt,
    scope3Total,
    sources,
  };
}
