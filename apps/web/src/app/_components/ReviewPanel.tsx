"use client";

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
    <form
      onSubmit={handle}
      style={{
        marginTop: "1.5rem",
        padding: "1rem",
        border: "1px solid #cfd8dc",
        borderRadius: "0.25rem",
        background: "#f9fbfc",
        display: "grid",
        gap: "0.75rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Decisão de revisão</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        {(
          [
            { value: "approve", label: "Aprovar" },
            { value: "request_changes", label: "Pedir alterações" },
            { value: "reject", label: "Rejeitar" },
          ] satisfies Array<{ value: Decision; label: string }>
        ).map((opt) => (
          <label
            key={opt.value}
            style={{ display: "inline-flex", gap: "0.5rem", fontSize: "0.95rem" }}
          >
            <input
              type="radio"
              name="decision"
              value={opt.value}
              checked={decision === opt.value}
              onChange={() => setDecision(opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>

      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span style={{ fontSize: "0.9rem" }}>
          Comentário{commentRequired ? <span style={{ color: "#b00020" }}> *</span> : " (opcional)"}
        </span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder={
            decision === "approve"
              ? "Notas para o submetedor (opcional)"
              : "Explique o que precisa de ser ajustado"
          }
          style={{ padding: "0.5rem", fontSize: "0.95rem", fontFamily: "inherit" }}
        />
      </label>

      {error && (
        <p style={{ margin: 0, color: "#b00020", fontSize: "0.9rem" }} role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        style={{
          justifySelf: "start",
          padding: "0.5rem 1rem",
          fontSize: "0.95rem",
          background: "#1f7a3d",
          color: "white",
          border: "none",
          borderRadius: "0.25rem",
        }}
      >
        {isPending ? "A registar…" : "Registar decisão"}
      </button>
    </form>
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
