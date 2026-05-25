"use client";

import { StatCard } from "@bgreen/ui";
import { Document } from "@carbon/icons-react";
import type { TemplateScoreHistory } from "@/lib/scores-actions";

// V8.3 — 6 most recent points feed the sparkline. PRD acceptance
// criterion: "trend sparkline (last 6 entries)".
const SPARKLINE_WINDOW = 6;

type TierTagType = "green" | "blue" | "purple" | "warm-gray";

function tierTag(tier: string): { label: string; type: TierTagType } {
  // Best-effort match against the PRD example buckets (C/B/A). Custom
  // tier labels render with the neutral tone.
  if (tier === "A") return { label: "Tier A", type: "green" };
  if (tier === "B") return { label: "Tier B", type: "blue" };
  if (tier === "C") return { label: "Tier C", type: "purple" };
  return { label: `Tier ${tier}`, type: "warm-gray" };
}

export function ScoreCard({ history }: { history: TemplateScoreHistory }) {
  const latest = history.scores.at(-1);
  if (!latest) return null;

  const recent = history.scores.slice(-SPARKLINE_WINDOW);
  const trendValues = recent.map((p) => p.percent);

  // Delta vs the prior submission. Null when there is only one entry.
  const previous = history.scores.at(-2);
  const delta = previous
    ? {
        value: `${latest.total >= previous.total ? "+" : ""}${(latest.total - previous.total).toFixed(0)}`,
        direction:
          latest.total > previous.total
            ? ("up" as const)
            : latest.total < previous.total
              ? ("down" as const)
              : ("flat" as const),
        suffix: "vs. submissão anterior",
      }
    : undefined;

  return (
    <StatCard
      label={history.templateName}
      value={latest.total.toFixed(0)}
      unit="/ 100"
      tier={tierTag(latest.tier)}
      sparkline={trendValues}
      delta={delta}
      icon={Document}
    />
  );
}
