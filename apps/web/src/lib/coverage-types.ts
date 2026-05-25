// V10.4 — wire types for the framework-coverage surface.
//
// Mirrors the apps/api shapes; kept local so the web layer doesn't
// import from internal module paths.

export type Framework = "esrs" | "ghg" | "gri";
export type CoverageStatus = "covered" | "partial" | "missing";

export interface SectorApplicability {
  kind: "all" | "cae3-list";
  values?: string[];
}

export interface FrameworkDatapoint {
  id: string;
  framework: Framework;
  topic: string;
  code: string;
  title: string;
  description: string;
  sectorApplicability: SectorApplicability;
  version: string;
}

export interface CoverageRow {
  datapoint: FrameworkDatapoint;
  status: CoverageStatus;
  applicable: boolean;
  evidence: {
    templateIds: string[];
    recordIds: string[];
  };
}

export interface CoverageMatrix {
  framework: Framework;
  rows: CoverageRow[];
  counts: {
    covered: number;
    partial: number;
    missing: number;
    total: number;
  };
}

export interface RowExplanation {
  datapointId: string;
  explanation: string;
  suggestedNextStep: string;
}

export interface CoverageCheckResult {
  matrix: CoverageMatrix;
  explanations: RowExplanation[];
  // pt-PT message when the AI pass failed. The matrix is always
  // populated regardless — the UI surfaces this alongside the rows.
  aiError: string | null;
}

export interface TemplateDatapointMapping {
  id: string;
  templateId: string;
  frameworkDatapointId: string;
  createdByUserId: string;
  createdAt: string;
}

export const FRAMEWORK_LABEL: Record<Framework, string> = {
  esrs: "CSRD / ESRS",
  ghg: "GHG Protocol",
  gri: "GRI",
};

export const STATUS_LABEL: Record<CoverageStatus, string> = {
  covered: "Coberto",
  partial: "Parcial",
  missing: "Em falta",
};

export const STATUS_BADGE_VARIANT: Record<
  CoverageStatus,
  "success" | "warning" | "destructive"
> = {
  covered: "success",
  partial: "warning",
  missing: "destructive",
};

// Server-actions throw via this so the UI can branch on `.message`.
// Server-action serialization strips the class — clients see a generic
// Error whose `.message` carries the code (same pattern as IesError /
// RecommendationsError).
export class CoverageError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "CoverageError";
  }
}
