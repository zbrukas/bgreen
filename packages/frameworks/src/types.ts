// V10.1 — domain types for the framework datapoint catalog.
//
// Shapes are deliberately narrow. `code` is the framework's own
// identifier (ESRS calls them "datapoint IDs" — E1-1, E1-6, etc.; GHG
// uses scope labels; GRI uses disclosure numbers like 305-1). The
// `id` field is a stable internal slug we use everywhere downstream
// (template mappings, audit rows, AI prompt context).

export type Framework = "esrs" | "ghg" | "gri";

// Sector applicability rule. v1 supports two shapes:
//   - "all"        → datapoint applies to every CAE-3.
//   - "cae3-list"  → applies only to listed CAE-3 prefixes.
//
// Future shapes (CAE-3 range, dimensao filter, multi-axis) extend the
// union; the consumer (CoverageCalculator in V10.2) lives in apps/api
// and discriminates on `kind`.
export type SectorApplicability =
  | { kind: "all" }
  | { kind: "cae3-list"; values: readonly string[] };

export interface FrameworkDatapoint {
  // Stable internal slug. Used as the FK target for template mappings,
  // audit rows, and the AI prompt. Format: `<framework>-<code>` so the
  // slug carries enough context to be human-readable in logs.
  id: string;
  framework: Framework;
  // Pillar / topic — for ESRS it's the topical standard (E1, E2, S1…);
  // for GHG it's the scope (1, 2, 3); for GRI it's the series (305,
  // 302, …). Used to group rows in the coverage matrix UI.
  topic: string;
  // Framework-issued code, surfaced verbatim in the UI ("E1-6",
  // "Scope 2", "305-1").
  code: string;
  // pt-PT title, ≤ 80 chars. Shown as the matrix row label.
  title: string;
  // pt-PT 1-2 sentence description. Shown in the per-row explanation
  // panel before the AI-generated narrative loads.
  description: string;
  sectorApplicability: SectorApplicability;
  // Framework revision tag — see CLAUDE.md "Versioning".
  version: string;
}

// Pure: given a sector applicability rule and the org's CAE-3, return
// true if the datapoint applies. CoverageCalculator uses this to drop
// non-applicable rows from the coverage matrix (with the UI filter on).
export function evaluateSectorApplicability(
  rule: SectorApplicability,
  cae3: string | null,
): boolean {
  if (rule.kind === "all") return true;
  if (!cae3) {
    // No CAE-3 known yet (INCOMPLETE-mode org) — be permissive. Better
    // to show the row + flag it as "applicability unknown" downstream
    // than to silently hide it.
    return true;
  }
  return rule.values.includes(cae3);
}
