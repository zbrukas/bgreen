// V10.2 — domain types for the framework coverage checker.
//
// CoverageStatus is the authoritative deterministic flag, computed
// by CoverageCalculator from records + mappings. V10.3's AI pass adds
// `explanation` + `suggestedNextStep` on top of these rows but doesn't
// change `status`.

import type { Framework, FrameworkDatapoint } from "@bgreen/frameworks";

export type CoverageStatus = "covered" | "partial" | "missing";

// One row of the coverage matrix. `evidence` rolls up which templates
// satisfy the datapoint + which submitted records are the evidence.
// Empty arrays in "missing" / "partial" cases are valid — the UI uses
// them to render the "as soon as you submit a record, this turns
// green" copy.
export interface CoverageRow {
  datapoint: FrameworkDatapoint;
  status: CoverageStatus;
  // True when the datapoint applies to the org's CAE-3 (per the
  // catalog's SectorApplicability rule).
  applicable: boolean;
  evidence: {
    templateIds: string[];
    recordIds: string[];
  };
}

export interface CoverageMatrix {
  framework: Framework;
  rows: CoverageRow[];
  // Summary counters — handy for the UI badges and the AI prompt.
  // Counted across the rows actually returned (i.e., after the
  // applicability filter is applied by the calculator).
  counts: {
    covered: number;
    partial: number;
    missing: number;
    total: number;
  };
}

// One persisted mapping row. Kept narrow — the audit + UI consume the
// fields, not Drizzle's full row shape.
export interface TemplateDatapointMapping {
  id: string;
  templateId: string;
  frameworkDatapointId: string;
  createdByUserId: string;
  createdAt: string;
}
