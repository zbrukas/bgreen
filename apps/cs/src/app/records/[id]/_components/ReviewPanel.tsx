"use client";

import { type ReviewRecordActionResult, reviewRecordAction } from "@/app/actions";
import { Checkmark } from "@carbon/icons-react";
import {
  Button,
  InlineNotification,
  RadioButton,
  RadioButtonGroup,
  Stack,
  TextArea,
  Tile,
} from "@carbon/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
    <Tile>
      <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
        Decisão de revisão
      </h2>
      <form onSubmit={handle} className="mt-4">
        <Stack gap={5}>
          <RadioButtonGroup
            name="decision"
            legendText="Decisão"
            orientation="vertical"
            valueSelected={decision}
            onChange={(value) => setDecision(value as Decision)}
          >
            <RadioButton labelText="Aprovar" value="approve" id="dec-approve" />
            <RadioButton
              labelText="Pedir alterações"
              value="request_changes"
              id="dec-changes"
            />
            <RadioButton labelText="Rejeitar" value="reject" id="dec-reject" />
          </RadioButtonGroup>

          <TextArea
            id="review-comment"
            labelText={`Comentário${commentRequired ? " (obrigatório)" : " (opcional)"}`}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder={
              decision === "approve"
                ? "Notas para o submetedor (opcional)"
                : "Explique o que precisa de ser ajustado"
            }
          />

          {error && (
            <InlineNotification
              kind="error"
              title="Não foi possível registar a decisão"
              subtitle={error}
              lowContrast
              hideCloseButton
            />
          )}

          <Button type="submit" kind="primary" disabled={isPending} renderIcon={Checkmark}>
            {isPending ? "A registar…" : "Registar decisão"}
          </Button>
        </Stack>
      </form>
    </Tile>
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
