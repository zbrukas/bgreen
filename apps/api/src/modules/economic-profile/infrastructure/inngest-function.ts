// Inngest function that runs the IES extraction pipeline.
//
// Triggered by `ies.extraction.started` events. V6.4's POST /economic-profile/ies
// endpoint will: (1) insert the ies_extraction_logs row with status=pending,
// (2) send this event with the new log id, (3) return immediately. The
// function picks it up and walks the pipeline.
//
// We wrap the orchestrator in a single `step.run`. Inngest retries the
// whole function on transient failures, and the orchestrator persists
// per-step progress to the DB so a re-run sees the existing state and
// can skip done work (the `extracting` status acts as the idempotency
// guard — but for V6.3 the orchestrator just re-runs from the top, which
// is safe because each step is replayable: download is idempotent, AI
// calls are stateless, persist is upsert-like via `update`).

import type { IesExtractionService } from "../application/ies-extraction-service.js";
import { inngest } from "../../../inngest.js";

export interface IesExtractionStartedEvent {
  name: "ies.extraction.started";
  data: {
    logId: string;
  };
}

export function createIesExtractionFunction(service: IesExtractionService) {
  return inngest.createFunction(
    {
      id: "ies-extraction-pipeline",
      // Cap concurrency so a runaway upload burst can't blow through
      // the Anthropic rate limit. 5 in-flight extractions is plenty
      // for v1 traffic.
      concurrency: { limit: 5 },
      retries: 2,
    },
    { event: "ies.extraction.started" },
    async ({ event, step, runId }) => {
      const { logId } = event.data as { logId: string };
      const result = await step.run("run-pipeline", () =>
        service.runPipeline(logId, runId),
      );
      return result;
    },
  );
}
