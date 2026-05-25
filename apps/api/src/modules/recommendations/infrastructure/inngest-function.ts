// Inngest function that runs one recommendations generation.
//
// Triggered by `recommendations.generation.started` events. POST
// /recommendations creates the pending row + emits the event +
// returns immediately. The function picks the row up, calls the AI
// tool via RecommendationsService, persists the result.
//
// Concurrency cap mirrors the V6 IES pipeline — keeps a "regenerate"
// burst from saturating the Anthropic rate limit.

import type { RecommendationsService } from "../application/recommendations-service.js";
import { inngest } from "../../../inngest.js";

export interface RecommendationsGenerationStartedEvent {
  name: "recommendations.generation.started";
  data: {
    generatedRecommendationId: string;
  };
}

export function createRecommendationsGenerationFunction(service: RecommendationsService) {
  return inngest.createFunction(
    {
      id: "recommendations-generation",
      concurrency: { limit: 5 },
      // A regeneration takes 60-90s so the default 2 retries is fine —
      // anything transient gets a second chance, anything structural
      // surfaces fast.
      retries: 2,
    },
    { event: "recommendations.generation.started" },
    async ({ event, step, runId }) => {
      const { generatedRecommendationId } = event.data as {
        generatedRecommendationId: string;
      };
      const result = await step.run("run-generation", () =>
        service.runGeneration(generatedRecommendationId, runId),
      );
      return result;
    },
  );
}
