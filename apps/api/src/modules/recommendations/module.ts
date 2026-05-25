export { classifyCompleteness } from "./application/completeness.js";
export type { CompletenessSignals } from "./application/completeness.js";
export { ProfileGatherer } from "./application/profile-gatherer.js";
export type { ProfileSnapshot } from "./application/profile-gatherer.js";
export {
  RecommendationsService,
  type FeedbackError,
  type FeedbackResult,
  type RecommendationHistoryEntry,
  type RecommendationsEventSender,
  type RunGenerationOutcome,
  type StartRecommendationsError,
  type StartRecommendationsResult,
} from "./application/recommendations-service.js";
export {
  type GenerateRecommendationsInput,
  type GenerateRecommendationsOutput,
  generateRecommendationsInputSchema,
  generateRecommendationsOutputSchema,
  generateRecommendationsTool,
} from "./application/tools/generate-recommendations-tool.js";
export type {
  CompletenessMode,
  FeedbackCounts,
  GeneratedRecommendation,
  Recommendation,
  RecommendationEffort,
  RecommendationFeedback,
  RecommendationFeedbackKind,
  RecommendationImpact,
  RecommendationsStatus,
  RecommendationTimeHorizon,
} from "./domain/types.js";
export {
  DrizzleGeneratedRecommendationRepository,
  type GeneratedRecommendationRepository,
} from "./infrastructure/generated-recommendation-repository.js";
export {
  DrizzleRecommendationFeedbackRepository,
  type RecommendationFeedbackRepository,
} from "./infrastructure/recommendation-feedback-repository.js";
export { createRecommendationsGenerationFunction } from "./infrastructure/inngest-function.js";
export { recommendationsRoutes } from "./api/routes.js";
