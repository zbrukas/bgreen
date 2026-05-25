"use client";

// V11.4 — polls one report run every 3s until terminal.

import { getReport, getReportDownloadUrl } from "@/lib/reports-actions";
import {
  STATUS_LABEL,
  TEMPLATE_LABEL,
  isTerminalReportStatus,
} from "@/lib/reports-types";
import { Download } from "@carbon/icons-react";
import { Button, InlineNotification, Tile } from "@carbon/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AiBanner } from "../_components/AiBanner";
import { StatusBadge } from "../_components/StatusBadge";

interface ReportRunViewProps {
  reportId: string;
}

export function ReportRunView({ reportId }: ReportRunViewProps) {
  const query = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => getReport(reportId),
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status && isTerminalReportStatus(status)) return false;
      return 3000;
    },
    refetchIntervalInBackground: true,
  });

  const download = useMutation({
    mutationFn: () => getReportDownloadUrl(reportId),
    onSuccess: (url) => {
      if (typeof window !== "undefined") window.open(url, "_blank");
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
        subtitle="Não foi possível obter o estado deste relatório."
        lowContrast
        hideCloseButton
      />
    );
  }

  const report = query.data;

  return (
    <div className="space-y-6">
      <AiBanner />

      <Tile>
        <div className="flex items-center gap-3">
          <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
            {TEMPLATE_LABEL[report.templateId]}
          </h2>
          <StatusBadge status={report.status} />
        </div>
        <p className="mt-1 text-sm text-neutral-600">
          Período: {report.periodStart} → {report.periodEnd}
        </p>
        <div className="mt-4 space-y-3 text-sm">
          {report.status === "pending" || report.status === "running" ? (
            <div className="flex items-center gap-3 text-neutral-700">
              <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-[var(--cds-interactive)]" />
              A gerar relatório. Esta página atualiza automaticamente. Pode demorar até 90 segundos.
            </div>
          ) : null}

          {report.status === "failed" && report.errorMessage ? (
            <InlineNotification
              kind="error"
              title="Geração falhou"
              subtitle={report.errorMessage}
              lowContrast
              hideCloseButton
            />
          ) : null}

          {report.status === "cancelled" ? (
            <InlineNotification
              kind="info"
              title="Cancelada"
              subtitle="Geração cancelada."
              lowContrast
              hideCloseButton
            />
          ) : null}

          {report.status === "ready" ? (
            <div className="space-y-3">
              <p className="text-xs text-neutral-600">Concluído. {STATUS_LABEL.ready}.</p>
              <Button
                kind="primary"
                onClick={() => download.mutate()}
                disabled={download.isPending}
                renderIcon={Download}
              >
                {download.isPending ? "A preparar…" : "Descarregar PDF"}
              </Button>
              {download.isError ? (
                <InlineNotification
                  kind="error"
                  title="Erro no download"
                  subtitle="Não foi possível preparar o download. Tente novamente."
                  lowContrast
                  hideCloseButton
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </Tile>

      {report.status === "ready" && report.commentary ? (
        <Tile>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
            Resumo executivo
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Pré-visualização do comentário incluído no PDF.
          </p>
          <div className="mt-4 space-y-4 text-sm">
            {report.commentary.sections.map((section, i) => (
              <article key={i} className="space-y-2">
                <h3 className="text-sm font-semibold">{section.title}</h3>
                <p className="text-neutral-600">{section.narrative}</p>
                {section.callouts.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5 text-xs text-neutral-600">
                    {section.callouts.map((c, j) => (
                      <li key={j}>{c}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </Tile>
      ) : null}

      <Tile>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
          Integridade
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Hash SHA-256 dos dados de entrada — auditável.
        </p>
        <code
          className="mt-2 block break-all text-xs text-neutral-600"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          {report.inputDataHash}
        </code>
      </Tile>
    </div>
  );
}
