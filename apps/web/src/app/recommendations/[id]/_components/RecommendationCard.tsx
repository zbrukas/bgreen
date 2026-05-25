"use client";

import type {
  FeedbackKind,
  Recommendation,
  RecommendationEffort,
  RecommendationImpact,
  RecommendationTimeHorizon,
} from "@/lib/recommendations-types";
import { Tag, Tile } from "@carbon/react";
import { useState } from "react";
import { FeedbackChips } from "./FeedbackChips";

const IMPACT_LABEL: Record<RecommendationImpact, string> = {
  alto: "Impacto alto",
  medio: "Impacto médio",
  baixo: "Impacto baixo",
};

const IMPACT_TAG_TYPE: Record<RecommendationImpact, "green" | "blue" | "cool-gray"> = {
  alto: "green",
  medio: "blue",
  baixo: "cool-gray",
};

const EFFORT_LABEL: Record<RecommendationEffort, string> = {
  alto: "Esforço alto",
  medio: "Esforço médio",
  baixo: "Esforço baixo",
};

const EFFORT_TAG_TYPE: Record<RecommendationEffort, "warm-gray" | "blue" | "cool-gray"> = {
  alto: "warm-gray",
  medio: "blue",
  baixo: "cool-gray",
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
    <Tile>
      <div className="flex items-baseline gap-3">
        <span
          className="text-sm text-neutral-600"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>{recommendation.title}</h3>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Tag type={IMPACT_TAG_TYPE[recommendation.estimatedImpact]}>
          {IMPACT_LABEL[recommendation.estimatedImpact]}
        </Tag>
        <Tag type={EFFORT_TAG_TYPE[recommendation.implementationEffort]}>
          {EFFORT_LABEL[recommendation.implementationEffort]}
        </Tag>
        <Tag type="outline">{HORIZON_LABEL[recommendation.timeHorizon]}</Tag>
      </div>
      <div className="mt-4 space-y-3">
        <p className="text-sm leading-relaxed">{recommendation.description}</p>
        <button
          type="button"
          onClick={() => setShowRationale((v) => !v)}
          className="text-xs font-medium text-[var(--cds-link-primary)] hover:underline"
        >
          {showRationale ? "Esconder justificação" : "Ver justificação"}
        </button>
        {showRationale ? (
          <p className="text-xs leading-relaxed text-neutral-600">
            {recommendation.rationale}
          </p>
        ) : null}
        <FeedbackChips
          selected={feedback}
          onSelect={onFeedback}
          disabled={feedbackDisabled}
        />
      </div>
    </Tile>
  );
}
