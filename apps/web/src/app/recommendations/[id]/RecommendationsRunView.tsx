"use client";

// Polls one generation run every 2s until terminal. While the AI is
// running we show a progress block; on success we render the cards
// and let the user record feedback; on failure we render the pt-PT
// error message.

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
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
      // 2s polling — same cadence as IES extraction. The AI call takes
      // 60-90s so this still gives the user a smooth progress signal
      // without hammering the server.
      return 2000;
    },
    refetchIntervalInBackground: true,
  });

  // Local cache of the current user's selected kind per item. The
  // server is the source of truth, but we don't roundtrip a full
  // history fetch on every chip click — instead the mutation onSuccess
  // patches this state and the next history refresh confirms.
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
    return <p className="text-sm text-muted-foreground">A carregar geração…</p>;
  }
  if (query.isError || !query.data) {
    return (
      <Alert variant="destructive">
        Não foi possível obter o estado desta geração.{" "}
        <Link href="/recommendations" className="underline">
          Voltar ao histórico
        </Link>
      </Alert>
    );
  }

  const generation = query.data;
  const isOwner = generation.requestedByUserId === currentUserId;

  return (
    <div className="space-y-6">
      <AiBanner />

      <Card>
        <CardHeader>
          <CardTitle>{statusLabel(generation.status)}</CardTitle>
          <CardDescription>
            {COMPLETENESS_LABEL[generation.completenessMode]}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {generation.status === "pending" || generation.status === "running" ? (
            <div className="flex items-center gap-3">
              <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-primary" />
              A gerar recomendações. Esta página atualiza automaticamente. Pode
              demorar entre 60 e 90 segundos.
            </div>
          ) : null}
          {generation.status === "failed" && generation.errorMessage ? (
            <Alert variant="destructive">{generation.errorMessage}</Alert>
          ) : null}
          {generation.status === "cancelled" ? (
            <Alert variant="info">Esta geração foi cancelada.</Alert>
          ) : null}
          {generation.status === "ready" && isOwner ? (
            <RegenerateRow />
          ) : null}
        </CardContent>
      </Card>

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

// Small inline component because it's used only here and only inside
// the ready-state branch. Lives at the same depth as the card body.
function RegenerateRow() {
  return (
    <div className="flex justify-end">
      <Link href="/recommendations">
        <Button variant="outline" size="sm">
          Voltar ao histórico
        </Button>
      </Link>
    </div>
  );
}
