// Wire types for the V11.4 /reports surface. Mirror the apps/api
// shape; kept local so apps/web doesn't reach into internal module
// paths.

export type ReportTemplateId = "ghg-inventory" | "esrs-e1" | "custom";

export type ReportInstanceStatus =
  | "pending"
  | "running"
  | "ready"
  | "failed"
  | "cancelled";

export interface CommentarySection {
  title: string;
  narrative: string;
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
  periodStart: string;
  periodEnd: string;
  status: ReportInstanceStatus;
  s3Key: string | null;
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

export const TEMPLATE_LABEL: Record<ReportTemplateId, string> = {
  "ghg-inventory": "Inventário GEE",
  "esrs-e1": "ESRS E1 — Divulgação climática",
  custom: "Relatório personalizado",
};

export const STATUS_LABEL: Record<ReportInstanceStatus, string> = {
  pending: "Em fila",
  running: "Em geração",
  ready: "Pronto",
  failed: "Falhou",
  cancelled: "Cancelado",
};

export const STATUS_TAG_TYPE: Record<
  ReportInstanceStatus,
  "blue" | "green" | "red" | "cool-gray"
> = {
  pending: "blue",
  running: "blue",
  ready: "green",
  failed: "red",
  cancelled: "cool-gray",
};

// Terminal states stop the detail page's poll.
export const TERMINAL_REPORT_STATUSES: ReportInstanceStatus[] = [
  "ready",
  "failed",
  "cancelled",
];

export function isTerminalReportStatus(status: ReportInstanceStatus): boolean {
  return TERMINAL_REPORT_STATUSES.includes(status);
}

// Server-actions throw via this so the UI can branch on `.message`.
// Same Next.js boundary caveat as the V10/V9 *Error classes: the
// class doesn't survive serialisation; clients see a generic Error
// whose `.message` carries the code.
export class ReportsError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ReportsError";
  }
}
