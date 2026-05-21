"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { type ReviewRecordActionResult, reviewRecordAction } from "../actions";

type Decision = "approve" | "request_changes" | "reject";

export function ReviewPanel({ recordId }: { recordId: string }) {
  const router = useRouter();
  const [decision, setDecision] = useState<Decision>("approve");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const commentRequired = decision !== "approve";

  function handle(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (commentRequired && comment.trim() === "") {
      setError("Indique um comentário para esta decisão.");
      return;
    }
    startTransition(async () => {
      const result: ReviewRecordActionResult = await reviewRecordAction({
        id: recordId,
        decision,
        comment: comment.trim() === "" ? null : comment.trim(),
      });
      if (!result.ok) {
        setError(translateError(result.error));
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Decisão de revisão</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handle} className="space-y-3">
          <div className="space-y-1.5">
            {(
              [
                { value: "approve", label: "Aprovar" },
                { value: "request_changes", label: "Pedir alterações" },
                { value: "reject", label: "Rejeitar" },
              ] satisfies Array<{ value: Decision; label: string }>
            ).map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="decision"
                  value={opt.value}
                  checked={decision === opt.value}
                  onChange={() => setDecision(opt.value)}
                  className="h-4 w-4 border-input text-primary focus:ring-ring"
                />
                {opt.label}
              </label>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="review-comment">
              Comentário
              {commentRequired ? (
                <span className="text-destructive"> *</span>
              ) : (
                <span className="text-muted-foreground"> (opcional)</span>
              )}
            </Label>
            <Textarea
              id="review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={
                decision === "approve"
                  ? "Notas para o submetedor (opcional)"
                  : "Explique o que precisa de ser ajustado"
              }
            />
          </div>

          {error && <Alert variant="destructive">{error}</Alert>}

          <Button type="submit" disabled={isPending}>
            {isPending ? "A registar…" : "Registar decisão"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function translateError(code: string): string {
  switch (code) {
    case "not_reviewable":
      return "Este registo já não está pendente de revisão.";
    case "comment_required":
      return "Comentário obrigatório para esta decisão.";
    case "forbidden":
      return "Sem permissão para rever este registo.";
    case "record_not_found":
      return "Registo não encontrado.";
    case "not_signed_in":
      return "Sessão expirada. Inicie sessão novamente.";
    case "network_error":
      return "Erro de rede. Tente novamente.";
    default:
      return `Erro: ${code}`;
  }
}
