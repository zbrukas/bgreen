import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TemplateScoreHistory } from "@/lib/scores-actions";
import { Sparkline } from "../Sparkline";
import { TrendArrow } from "./TrendArrow";

// V8.3 — 6 most recent points feed the sparkline. PRD acceptance
// criterion: "trend sparkline (last 6 entries)".
const SPARKLINE_WINDOW = 6;

function tierBadgeVariant(tier: string): "success" | "info" | "warning" | "secondary" {
  // Best-effort match against the PRD example buckets (C/B/A). Custom
  // tier labels fall through to secondary.
  if (tier === "A") return "success";
  if (tier === "B") return "info";
  if (tier === "C") return "warning";
  return "secondary";
}

export function ScoreCard({ history }: { history: TemplateScoreHistory }) {
  // Last entry = most recent (scores arrive ascending from the API).
  const latest = history.scores.at(-1);
  if (!latest) return null;

  const recent = history.scores.slice(-SPARKLINE_WINDOW);
  const trendValues = recent.map((p) => p.percent);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{history.templateName}</CardTitle>
        <CardDescription className="flex items-center gap-2">
          <span className="text-2xl font-semibold text-foreground">
            {latest.total.toFixed(0)}
          </span>
          <span className="text-sm text-muted-foreground">/ 100</span>
          <Badge variant={tierBadgeVariant(latest.tier)} className="ml-auto">
            Tier {latest.tier}
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Sparkline values={trendValues} domain={{ min: 0, max: 100 }} />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {recent.length === 1
              ? "1 entrada"
              : `Últimas ${recent.length} de ${history.scores.length}`}
          </span>
          <TrendArrow points={recent} />
        </div>
      </CardContent>
    </Card>
  );
}
