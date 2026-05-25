// Domain types for AI-generated recommendations.
//
// CompletenessMode is the classifier output (FULL / PARTIAL / INCOMPLETE)
// that picks the AI prompt template. Recommendation is the per-item
// wire shape produced by the AI and persisted on
// generated_recommendations.recommendations[].

export type CompletenessMode = "FULL" | "PARTIAL" | "INCOMPLETE";

export type RecommendationImpact = "alto" | "medio" | "baixo";
export type RecommendationEffort = "alto" | "medio" | "baixo";
export type RecommendationTimeHorizon = "curto" | "medio" | "longo";

export interface Recommendation {
  // pt-PT title, 5-12 words ("Migrar a frota para veículos elétricos").
  title: string;
  // Two-to-four sentence description in pt-PT, no markdown.
  description: string;
  // Self-rated by the model. Coarse buckets so the UI can render a
  // badge without parsing free text.
  estimatedImpact: RecommendationImpact;
  implementationEffort: RecommendationEffort;
  timeHorizon: RecommendationTimeHorizon;
  // 1-3 sentences citing the org's specific profile/records that
  // motivated this suggestion. "Porque a sua empresa tem CAE 351 e ..."
  rationale: string;
}

export type RecommendationsStatus =
  | "pending"
  | "running"
  | "ready"
  | "failed"
  | "cancelled";

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

export type RecommendationFeedbackKind =
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
  kind: RecommendationFeedbackKind;
  createdAt: string;
  updatedAt: string;
}

// Aggregated counts for the history view's "X úteis, Y já
// implementadas" hover. Keyed by feedback kind; missing keys are
// implicitly zero.
export type FeedbackCounts = Partial<Record<RecommendationFeedbackKind, number>>;
