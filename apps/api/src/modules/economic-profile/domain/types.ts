// Domain types for what comes out of an IES extraction.
//
// The AI returns per-field {value, confidence}. The validator rewrites
// confidence (never the value) and adds warnings. Stored as JSONB on
// ies_extraction_logs.extraction_result and .validator_warnings.

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export interface ExtractedField<T> {
  value: T | null;
  confidence: Confidence;
}

// Money is a number in domain code (extraction tools return numbers and
// the validator's math is simpler in number-space). At the persistence
// boundary we serialize back to the numeric(20,2) string the DB expects —
// €-billions stay representable in JS numbers (53-bit precision floor is
// ~9 × 10¹⁵).
export interface ExtractedEconomicProfile {
  year: ExtractedField<number>;
  employees: ExtractedField<number>;
  turnover: ExtractedField<number>;
  ebitda: ExtractedField<number>;
  balanceSheetTotal: ExtractedField<number>;
  cae: ExtractedField<string>;
}

export type ProfileField =
  | "year"
  | "employees"
  | "turnover"
  | "ebitda"
  | "balanceSheetTotal"
  | "cae";

export type ValidatorRule =
  | "employees_negative"
  | "employees_implausible"
  | "turnover_negative"
  | "balance_sheet_negative"
  | "ebitda_implausible_margin"
  | "year_future"
  | "year_too_old"
  | "missing_required";

export interface ValidatorWarning {
  // The field that was downgraded. `null` when the warning is purely
  // informational (e.g., missing required field — there's no value to
  // downgrade because there's no value).
  field: ProfileField | null;
  rule: ValidatorRule;
  // pt-PT message for the user, citing the rule. The UI surfaces this
  // verbatim under the field with a yellow badge.
  message: string;
}

export interface ValidationResult {
  // Same shape as input, with confidence downgraded where rules fired.
  // Values are never mutated by the validator — the user owns those.
  profile: ExtractedEconomicProfile;
  warnings: ValidatorWarning[];
}

// Status lives on ies_extraction_logs.status — mirror the enum here so
// callers don't reach into @bgreen/db. Keep in sync with the pgEnum.
export type IesExtractionStatus =
  | "pending"
  | "extracting"
  | "awaiting_user_confirmation"
  | "confirmed"
  | "cancelled"
  | "failed_not_ies"
  | "failed_extraction"
  | "failed_validation";

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
