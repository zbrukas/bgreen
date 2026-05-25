"use client";

// One card per AI recommendation. Renders title + impact/effort/horizon
// badges, the description, an expandable rationale block (collapsed by
// default to keep the screen scannable), and the feedback chip row.

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  FeedbackKind,
  Recommendation,
  RecommendationEffort,
  RecommendationImpact,
  RecommendationTimeHorizon,
} from "@/lib/recommendations-types";
import { useState } from "react";
import { FeedbackChips } from "./FeedbackChips";

const IMPACT_LABEL: Record<RecommendationImpact, string> = {
  alto: "Impacto alto",
  medio: "Impacto médio",
  baixo: "Impacto baixo",
};

const IMPACT_VARIANT: Record<RecommendationImpact, "success" | "info" | "secondary"> = {
  alto: "success",
  medio: "info",
  baixo: "secondary",
};

const EFFORT_LABEL: Record<RecommendationEffort, string> = {
  alto: "Esforço alto",
  medio: "Esforço médio",
  baixo: "Esforço baixo",
};

const EFFORT_VARIANT: Record<RecommendationEffort, "warning" | "info" | "secondary"> = {
  alto: "warning",
  medio: "info",
  baixo: "secondary",
};

const HORIZON_LABEL: Record<RecommendationTimeHorizon, string> = {
  curto: "Curto prazo",
  medio: "Médio prazo",
  longo: "Longo prazo",
};

interface RecommendationCardProps {
  index: number;
  recommendation: Recommendation;
  feedback: FeedbackKind | null;
  onFeedback: (kind: FeedbackKind) => void;
  feedbackDisabled?: boolean;
}

export function RecommendationCard({
  index,
  recommendation,
  feedback,
  onFeedback,
  feedbackDisabled,
}: RecommendationCardProps) {
  const [showRationale, setShowRationale] = useState(false);
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-mono text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
          <CardTitle className="text-base">{recommendation.title}</CardTitle>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={IMPACT_VARIANT[recommendation.estimatedImpact]}>
            {IMPACT_LABEL[recommendation.estimatedImpact]}
          </Badge>
          <Badge variant={EFFORT_VARIANT[recommendation.implementationEffort]}>
            {EFFORT_LABEL[recommendation.implementationEffort]}
          </Badge>
          <Badge variant="outline">{HORIZON_LABEL[recommendation.timeHorizon]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-relaxed">{recommendation.description}</p>
        <button
          type="button"
          onClick={() => setShowRationale((v) => !v)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {showRationale ? "Esconder justificação" : "Ver justificação"}
        </button>
        {showRationale ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {recommendation.rationale}
          </p>
        ) : null}
        <FeedbackChips
          selected={feedback}
          onSelect={onFeedback}
          disabled={feedbackDisabled}
        />
      </CardContent>
    </Card>
  );
}
