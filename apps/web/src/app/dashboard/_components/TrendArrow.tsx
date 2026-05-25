import type { RecordScorePoint } from "@/lib/scores-actions";

// Coarse arrow comparing first vs last point in the visible window.
// Threshold of 0.5 percentage points avoids jitter from rounding when
// the values are essentially flat.
export function TrendArrow({ points }: { points: RecordScorePoint[] }) {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;
  const delta = last.percent - first.percent;
  if (Math.abs(delta) < 0.5) return <span>tendência →</span>;
  if (delta > 0) return <span className="text-emerald-700">tendência ↑</span>;
  return <span className="text-amber-700">tendência ↓</span>;
}
