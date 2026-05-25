// Wire-shape types for the /recommendations surface.
//
// Defined locally (not imported from apps/api) so the web app stays
// decoupled from the internal module layout — what counts is the JSON
// shape on the wire.

export type CompletenessMode = "FULL" | "PARTIAL" | "INCOMPLETE";

export type RecommendationsStatus =
  | "pending"
  | "running"
  | "ready"
  | "failed"
  | "cancelled";

export type RecommendationImpact = "alto" | "medio" | "baixo";
export type RecommendationEffort = "alto" | "medio" | "baixo";
export type RecommendationTimeHorizon = "curto" | "medio" | "longo";

export interface Recommendation {
  title: string;
  description: string;
  estimatedImpact: RecommendationImpact;
  implementationEffort: RecommendationEffort;
  timeHorizon: RecommendationTimeHorizon;
  rationale: string;
}

export interface GeneratedRecommendation {
  id: string;
  organizationId: string;
  requestedByUserId: string | null;
  status: RecommendationsStatus;
  completenessMode: CompletenessMode;
  recommendations: Recommendation[] | null;
  errorMessage: string | null;
  aiInputTokens: number | null;
  aiOutputTokens: number | null;
  inngestRunId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export type FeedbackKind =
  | "util"
  | "ja_implementada"
  | "nao_aplicavel"
  | "irrelevante"
  | "incorreta";

export interface RecommendationFeedback {
  id: string;
  generatedRecommendationId: string;
  recommendationIndex: number;
  userId: string;
  kind: FeedbackKind;
  createdAt: string;
  updatedAt: string;
}

export type FeedbackCounts = Partial<Record<FeedbackKind, number>>;

export interface HistoryEntry {
  generation: GeneratedRecommendation;
  feedbackCounts: FeedbackCounts;
}

// Terminal states stop polling on the detail page.
export const TERMINAL_REC_STATUSES: RecommendationsStatus[] = [
  "ready",
  "failed",
  "cancelled",
];

export function isTerminalRecStatus(status: RecommendationsStatus): boolean {
  return TERMINAL_REC_STATUSES.includes(status);
}

// pt-PT labels used by the chip row + history view. Kept here so the
// vocabulary lives in one place — consumers import the label, not the
// enum.
export const FEEDBACK_LABEL: Record<FeedbackKind, string> = {
  util: "Útil",
  ja_implementada: "Já implementada",
  nao_aplicavel: "Não aplicável",
  irrelevante: "Irrelevante",
  incorreta: "Incorreta",
};

export const COMPLETENESS_LABEL: Record<CompletenessMode, string> = {
  FULL: "Perfil completo",
  PARTIAL: "Perfil parcial",
  INCOMPLETE: "Perfil preliminar",
};

// Same boundary-friendly error class used by economic-profile-types.
// Lives here (not in recommendations-actions.ts) because Next.js
// "use server" files can only export async functions.
export class RecommendationsError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "RecommendationsError";
  }
}
