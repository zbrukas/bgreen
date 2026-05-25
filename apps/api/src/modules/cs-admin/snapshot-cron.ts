import type { Inngest } from "inngest";
import type { CsHealthService } from "./application/health-service.js";

// V12.2 — daily snapshot cron. 04:00 UTC keeps it well clear of the
// 18:00–22:00 user-facing peak. Concurrency 1 so a slow run never
// overlaps with the next day's invocation (also makes manual backfills
// safe: rerun the same date and ON CONFLICT updates the existing row).
export function createCsSnapshotFunction(
  inngest: Inngest,
  healthService: CsHealthService,
) {
  return inngest.createFunction(
    { id: "cs.snapshot.daily", concurrency: { limit: 1 } },
    { cron: "TZ=UTC 0 4 * * *" },
    async ({ step }) => {
      const { inserted, pruned } = await step.run("snapshot", () =>
        healthService.takeDailySnapshot(),
      );
      return { inserted, pruned };
    },
  );
}
