"use client";

// Polls the IES extraction log every 2s until terminal. The big states:
//
//   pending / extracting        → progress spinner
//   awaiting_user_confirmation  → editable result form + Confirm / Cancel
//   confirmed                   → success card + link to dashboard
//   failed_*                    → error banner with the pt-PT message
//   cancelled                   → cancellation card
//
// Confirm/Cancel are useMutations; on success they invalidate the
// per-log query so the UI snaps to the terminal state without an extra
// round-trip.

import {
  cancelExtraction,
  confirmExtraction,
  getExtractionStatus,
} from "@/lib/economic-profile-actions";
import { type ExtractionEdits, isTerminalStatus } from "@/lib/economic-profile-types";
import { InlineNotification, Tile } from "@carbon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmedBlock } from "./_components/ConfirmedBlock";
import { FailureBlock } from "./_components/FailureBlock";
import { ProgressBlock } from "./_components/ProgressBlock";
import { ResultForm } from "./_components/ResultForm";
import { STATUS_COPY, confirmErrorMessage } from "./_components/copy";

export function ExtractionStatusView({ logId }: { logId: string }) {
  const router = useRouter();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["ies-extraction", logId],
    queryFn: () => getExtractionStatus(logId),
    // Poll while not terminal. Returning false stops the poll loop.
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status && isTerminalStatus(status)) return false;
      return 2000;
    },
    refetchIntervalInBackground: true,
  });

  // Editable copy of the extracted values. Initialised when the
  // extraction lands (the effect inside the form below).
  const [edits, setEdits] = useState<ExtractionEdits>({});

  const confirm = useMutation({
    mutationFn: () => confirmExtraction(logId, edits),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ies-extraction", logId] });
      qc.invalidateQueries({ queryKey: ["economic-profiles"] });
    },
  });

  const cancel = useMutation({
    mutationFn: () => cancelExtraction(logId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ies-extraction", logId] });
    },
  });

  if (query.isLoading) {
    return <p className="text-sm text-neutral-600">A carregar estado…</p>;
  }
  if (query.isError || !query.data) {
    return (
      <InlineNotification
        kind="error"
        title="Sem estado"
        subtitle="Não foi possível obter o estado desta extração."
        lowContrast
        hideCloseButton
      />
    );
  }

  const log = query.data;

  return (
    <Tile>
      <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
        {log.originalFilename ?? "IES"}
      </h2>
      <p className="mt-1 text-sm text-neutral-700">{STATUS_COPY[log.status]}</p>
      <div className="mt-4 space-y-4">
        {log.status === "pending" || log.status === "extracting" ? <ProgressBlock /> : null}

        {log.status === "awaiting_user_confirmation" && log.extractionResult ? (
          <ResultForm
            extraction={log.extractionResult}
            warnings={log.validatorWarnings ?? []}
            edits={edits}
            onChange={setEdits}
            onConfirm={() => confirm.mutate()}
            onCancel={() => cancel.mutate()}
            isConfirming={confirm.isPending}
            isCancelling={cancel.isPending}
            confirmError={confirm.isError ? confirmErrorMessage(confirm.error) : null}
          />
        ) : null}

        {log.status === "confirmed" ? (
          <ConfirmedBlock onContinue={() => router.push("/economic-profile")} />
        ) : null}

        {log.status === "cancelled" ? (
          <div>
            <InlineNotification
              kind="info"
              title="Carregamento cancelado"
              subtitle="Pode voltar ao perfil económico."
              lowContrast
              hideCloseButton
            />
            <p className="mt-2 text-sm">
              <Link
                href="/economic-profile"
                className="text-[var(--cds-link-primary)] hover:underline"
              >
                ← Voltar ao perfil económico
              </Link>
            </p>
          </div>
        ) : null}

        {(log.status === "failed_not_ies" ||
          log.status === "failed_extraction" ||
          log.status === "failed_validation") &&
        log.errorMessage ? (
          <FailureBlock message={log.errorMessage} status={log.status} />
        ) : null}
      </div>
    </Tile>
  );
}
