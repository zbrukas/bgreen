// Wire-shape types for the /economic-profile surface. Defined locally
// (not imported from apps/api) so the web app stays decoupled from the
// internal module layout — what counts is the JSON shape on the wire.

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export interface ExtractedField<T> {
  value: T | null;
  confidence: Confidence;
}

export interface ExtractedEconomicProfile {
  year: ExtractedField<number>;
  employees: ExtractedField<number>;
  turnover: ExtractedField<number>;
  ebitda: ExtractedField<number>;
  balanceSheetTotal: ExtractedField<number>;
  cae: ExtractedField<string>;
}

export type IesExtractionStatus =
  | "pending"
  | "extracting"
  | "awaiting_user_confirmation"
  | "confirmed"
  | "cancelled"
  | "failed_not_ies"
  | "failed_extraction"
  | "failed_validation";

export type ProfileField =
  | "year"
  | "employees"
  | "turnover"
  | "ebitda"
  | "balanceSheetTotal"
  | "cae";

export interface ValidatorWarning {
  field: ProfileField | null;
  rule: string;
  message: string;
}

export interface IesExtractionLog {
  id: string;
  organizationId: string;
  uploadedByUserId: string | null;
  s3Key: string | null;
  s3DeletedAt: string | null;
  originalFilename: string | null;
  fileSizeBytes: number | null;
  status: IesExtractionStatus;
  year: number | null;
  classificationResult: unknown;
  extractionResult: ExtractedEconomicProfile | null;
  validatorWarnings: ValidatorWarning[] | null;
  errorMessage: string | null;
  inngestRunId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface OrganizationEconomicProfile {
  id: string;
  organizationId: string;
  year: number;
  employees: number | null;
  turnover: number | null;
  ebitda: number | null;
  balanceSheetTotal: number | null;
  cae: string | null;
  source: "ies_extracted" | "manual" | "edited_after_extraction";
  confirmedAt: string;
  iesExtractionLogId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractionEdits {
  year?: number;
  employees?: number | null;
  turnover?: number | null;
  ebitda?: number | null;
  balanceSheetTotal?: number | null;
  cae?: string | null;
}

export interface ManualEntryInput {
  year: number;
  employees: number | null;
  turnover: number | null;
  ebitda: number | null;
  balanceSheetTotal: number | null;
  cae: string | null;
}

// Terminal states stop polling. Used by the status page's useQuery
// refetchInterval guard.
export const TERMINAL_STATUSES: IesExtractionStatus[] = [
  "confirmed",
  "cancelled",
  "failed_not_ies",
  "failed_extraction",
  "failed_validation",
];

export function isTerminalStatus(status: IesExtractionStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

// Stable error class for the UI. `code` matches the apps/api error
// envelope (e.g., "too_large", "not_pdf", "wrong_status"). Lives here
// (not in economic-profile-actions.ts) because Next.js "use server" files
// can only export async functions.
//
// Note on Next.js boundary: server actions serialise thrown errors. The
// IesError instance does not survive the client/server boundary; the
// client sees a generic Error whose `.message` carries the code. The
// UI parses the code from `error.message`. The class is still useful
// inside the server action layer for stack-friendly throws.
export class IesError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "IesError";
  }
}
