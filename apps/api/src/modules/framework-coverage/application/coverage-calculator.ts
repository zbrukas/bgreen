// CoverageCalculator — pure module. Given the catalog + mappings +
// org's submitted records + the org's CAE-3, returns one CoverageRow
// per applicable datapoint with deterministic status.
//
// Status rules (V10 plan §criteria):
//   - missing : no template is mapped to this datapoint.
//   - partial : at least one template is mapped, but no submitted
//               record exists yet for any mapped template.
//   - covered : at least one submitted record exists for a mapped
//               template. evidence.recordIds lists every such record.
//
// Submitted-or-better is the bar. Drafts and changes_requested don't
// count — V10's coverage view should match what a reviewer would
// accept as evidence in a report. The state set mirrors V5.2's
// `submitted | approved | certified` semantics.
//
// Applicability: each datapoint's SectorApplicability rule is
// evaluated against the org's CAE-3. With `includeNonApplicable:
// false` (default) the calculator drops non-applicable rows entirely
// per the V10 plan's deep-module spec. The route layer flips this
// based on the UI's "applicable to my sector only" toggle.
//
// Pure: no I/O, no exceptions. Same inputs → same output.

import type {
  Framework,
  FrameworkDatapoint,
  SectorApplicability,
} from "@bgreen/frameworks";
import { evaluateSectorApplicability } from "@bgreen/frameworks";
import type {
  CoverageMatrix,
  CoverageRow,
  CoverageStatus,
  TemplateDatapointMapping,
} from "../domain/types.js";

// Minimal record shape the calculator needs. Decoupled from
// @bgreen/types so the test layer can construct fixtures without
// pulling the full record schema.
export interface CalculatorRecord {
  id: string;
  templateId: string;
  status: string;
}

const SUBMITTED_OR_BETTER: ReadonlySet<string> = new Set([
  "submitted",
  "approved",
  "certified",
]);

export interface CalculateCoverageInput {
  framework: Framework;
  datapoints: readonly FrameworkDatapoint[];
  mappings: readonly TemplateDatapointMapping[];
  records: readonly CalculatorRecord[];
  // Org's CAE-3 (3-digit prefix). null for INCOMPLETE-mode orgs;
  // the applicability rule is permissive on null (returns true).
  cae3: string | null;
  // When true, returns non-applicable rows with applicable=false
  // and status untouched. When false (default), drops them.
  includeNonApplicable?: boolean;
}

export function calculateCoverage(input: CalculateCoverageInput): CoverageMatrix {
  // Build a (datapoint id → templateIds[]) index from mappings. Each
  // datapoint can have many templates and vice versa, so this is the
  // shape we want for the inner status loop.
  const templatesByDatapoint = new Map<string, string[]>();
  for (const m of input.mappings) {
    const list = templatesByDatapoint.get(m.frameworkDatapointId) ?? [];
    list.push(m.templateId);
    templatesByDatapoint.set(m.frameworkDatapointId, list);
  }

  // Records grouped by templateId, filtered to "submitted-or-better".
  // We keep the full record list per template so the evidence rollup
  // can emit every record id; partial-coverage flips to covered on
  // the first match.
  const recordsByTemplate = new Map<string, string[]>();
  for (const r of input.records) {
    if (!SUBMITTED_OR_BETTER.has(r.status)) continue;
    const list = recordsByTemplate.get(r.templateId) ?? [];
    list.push(r.id);
    recordsByTemplate.set(r.templateId, list);
  }

  const rows: CoverageRow[] = [];
  for (const dp of input.datapoints) {
    if (dp.framework !== input.framework) continue;
    const applicable = evaluateApplicability(dp.sectorApplicability, input.cae3);
    if (!applicable && !input.includeNonApplicable) continue;

    const templateIds = templatesByDatapoint.get(dp.id) ?? [];
    const recordIds: string[] = [];
    for (const templateId of templateIds) {
      const found = recordsByTemplate.get(templateId);
      if (found) recordIds.push(...found);
    }

    const status = deriveStatus(templateIds.length, recordIds.length);
    rows.push({
      datapoint: dp,
      status,
      applicable,
      evidence: { templateIds, recordIds },
    });
  }

  const counts = {
    covered: rows.filter((r) => r.status === "covered").length,
    partial: rows.filter((r) => r.status === "partial").length,
    missing: rows.filter((r) => r.status === "missing").length,
    total: rows.length,
  };

  return { framework: input.framework, rows, counts };
}

function deriveStatus(
  mappedTemplateCount: number,
  matchingRecordCount: number,
): CoverageStatus {
  if (mappedTemplateCount === 0) return "missing";
  if (matchingRecordCount === 0) return "partial";
  return "covered";
}

// Thin wrapper to keep the calling site readable. The actual rule lives
// in @bgreen/frameworks.
function evaluateApplicability(
  rule: SectorApplicability,
  cae3: string | null,
): boolean {
  return evaluateSectorApplicability(rule, cae3);
}
