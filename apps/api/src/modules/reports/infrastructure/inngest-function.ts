// Inngest function that runs one report generation.
//
// Triggered by `report.generation.started` events. POST /reports
// creates the pending row + emits the event + returns immediately.
// The function picks the row up, calls the AI tool + apps/pdf +
// S3 + email via ReportService.runGeneration. Mirrors V9's
// recommendations pipeline shape.
//
// Concurrency cap matches V9 (5) — a "Regenerar" burst from a single
// org can't saturate the Anthropic rate limit. Retries 2x because
// AI failures degrade gracefully (commentary becomes null); the
// hard failure path is S3 / PDF, which usually doesn't recover in
// a single retry.

import type { ReportService } from "../application/report-service.js";
import { inngest } from "../../../inngest.js";

export interface ReportGenerationStartedEvent {
  name: "report.generation.started";
  data: {
    reportId: string;
  };
}

export function createReportGenerationFunction(service: ReportService) {
  return inngest.createFunction(
    {
      id: "report-generation",
      concurrency: { limit: 5 },
      retries: 2,
    },
    { event: "report.generation.started" },
    async ({ event, step, runId }) => {
      const { reportId } = event.data as { reportId: string };
      return step.run("run-generation", () => service.runGeneration(reportId, runId));
    },
  );
}
