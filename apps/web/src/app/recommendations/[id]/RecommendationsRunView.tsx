"use client";

// Polls one generation run every 2s until terminal. While the AI is
// running we show a progress block; on success we render the cards
// and let the user record feedback; on failure we render the pt-PT
// error message.

import {
  getRecommendation,
  submitRecommendationFeedback,
} from "@/lib/recommendations-actions";
import {
  COMPLETENESS_LABEL,
  type FeedbackKind,
  type RecommendationFeedback,
  isTerminalRecStatus,
} from "@/lib/recommendations-types";
import { ArrowLeft } from "@carbon/icons-react";
import { Button, InlineNotification, Tile } from "@carbon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AiBanner } from "../_components/AiBanner";
import { statusLabel } from "../_components/status";
import { RecommendationCard } from "./_components/RecommendationCard";

interface RecommendationsRunViewProps {
  generationId: string;
  currentUserId: string;
}

export function RecommendationsRunView({
  generationId,
  currentUserId,
}: RecommendationsRunViewProps) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["recommendation", generationId],
    queryFn: () => getRecommendation(generationId),
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status && isTerminalRecStatus(status)) return false;
      return 2000;
    },
    refetchIntervalInBackground: true,
  });

  const [feedbackByIndex, setFeedbackByIndex] = useState<Record<number, FeedbackKind>>({});

  const feedback = useMutation({
    mutationFn: (input: { recommendationIndex: number; kind: FeedbackKind }) =>
      submitRecommendationFeedback({
        generationId,
        recommendationIndex: input.recommendationIndex,
        kind: input.kind,
      }),
    onSuccess: (row: RecommendationFeedback) => {
      setFeedbackByIndex((prev) => ({ ...prev, [row.recommendationIndex]: row.kind }));
      qc.invalidateQueries({ queryKey: ["recommendations-history"] });
    },
  });

  if (query.isLoading) {
    return <p className="text-sm text-neutral-600">A carregar geração…</p>;
  }
  if (query.isError || !query.data) {
    return (
      <InlineNotification
        kind="error"
        title="Sem estado"
        subtitle="Não foi possível obter o estado desta geração."
        lowContrast
        hideCloseButton
      />
    );
  }

  const generation = query.data;
  const isOwner = generation.requestedByUserId === currentUserId;

  return (
    <div className="space-y-6">
      <AiBanner />

      <Tile>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
          {statusLabel(generation.status)}
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          {COMPLETENESS_LABEL[generation.completenessMode]}
        </p>
        <div className="mt-4 space-y-3">
          {generation.status === "pending" || generation.status === "running" ? (
            <div className="flex items-center gap-3 text-sm text-neutral-700">
              <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-[var(--cds-interactive)]" />
              A gerar recomendações. Esta página atualiza automaticamente. Pode demorar entre 60 e
              90 segundos.
            </div>
          ) : null}
          {generation.status === "failed" && generation.errorMessage ? (
            <InlineNotification
              kind="error"
              title="Geração falhou"
              subtitle={generation.errorMessage}
              lowContrast
              hideCloseButton
            />
          ) : null}
          {generation.status === "cancelled" ? (
            <InlineNotification
              kind="info"
              title="Cancelada"
              subtitle="Esta geração foi cancelada."
              lowContrast
              hideCloseButton
            />
          ) : null}
          {generation.status === "ready" && isOwner ? (
            <div className="flex justify-end">
              <Button kind="tertiary" size="sm" href="/recommendations" renderIcon={ArrowLeft}>
                Voltar ao histórico
              </Button>
            </div>
          ) : null}
        </div>
      </Tile>

      {generation.status === "ready" && generation.recommendations ? (
        <section className="space-y-4">
          {generation.recommendations.map((rec, index) => (
            <RecommendationCard
              key={index}
              index={index}
              recommendation={rec}
              feedback={feedbackByIndex[index] ?? null}
              onFeedback={(kind) =>
                feedback.mutate({ recommendationIndex: index, kind })
              }
              feedbackDisabled={feedback.isPending}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}
