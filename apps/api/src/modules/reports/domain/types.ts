// V11.1 — domain types for the report lifecycle.
//
// `ReportTemplateId` is an app-level enum kept stable in code so the
// React templates in apps/pdf and the migration's free-text column
// agree without duplicating an enum.

export const REPORT_TEMPLATE_IDS = ["ghg-inventory", "esrs-e1", "custom"] as const;

export type ReportTemplateId = (typeof REPORT_TEMPLATE_IDS)[number];

export function isReportTemplateId(value: string): value is ReportTemplateId {
  return (REPORT_TEMPLATE_IDS as readonly string[]).includes(value);
}

export type ReportInstanceStatus =
  | "pending"
  | "running"
  | "ready"
  | "failed"
  | "cancelled";

// One section of the AI-generated commentary. V11.3 fills this; V11.1
// persists `null` until the AI step lands.
export interface CommentarySection {
  title: string;
  narrative: string;
  // Optional pull-quotes / highlights — rendered as accent boxes in
  // the PDF template.
  callouts: string[];
}

export interface ReportCommentary {
  sections: CommentarySection[];
}

export interface ReportInstance {
  id: string;
  organizationId: string;
  requestedByUserId: string | null;
  templateId: ReportTemplateId;
  // ISO yyyy-mm-dd. Coverage period the report describes.
  periodStart: string;
  periodEnd: string;
  status: ReportInstanceStatus;
  s3Key: string | null;
  // SHA-256 hex digest (64 chars) of the canonicalised input data.
  // Stable across reruns; auditors recompute by re-collecting data
  // + re-hashing.
  inputDataHash: string;
  commentary: ReportCommentary | null;
  aiInputTokens: number | null;
  aiOutputTokens: number | null;
  inngestRunId: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
