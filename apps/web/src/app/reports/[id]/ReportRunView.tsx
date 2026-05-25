"use client";

// V11.4 — polls one report run every 3s until terminal.
//
// States rendered:
//   pending / running       → progress block ("A gerar relatório…")
//   ready                   → AI commentary (if any) + download button
//   failed                  → pt-PT error message from the row
//   cancelled               → info banner

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getReport, getReportDownloadUrl } from "@/lib/reports-actions";
import {
  STATUS_LABEL,
  TEMPLATE_LABEL,
  isTerminalReportStatus,
} from "@/lib/reports-types";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
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
      // 3s — generation is ~60s; we don't need sub-second snappiness.
      return 3000;
    },
    refetchIntervalInBackground: true,
  });

  // Download URL is a server action that hits apps/api with the
  // user's session token, follows the 302, and returns the presigned
  // S3 URL. We open it in a new tab to start the download.
  const download = useMutation({
    mutationFn: () => getReportDownloadUrl(reportId),
    onSuccess: (url) => {
      // window.open in a new tab so the polling page doesn't unmount.
      if (typeof window !== "undefined") window.open(url, "_blank");
    },
  });

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">A carregar estado…</p>;
  }
  if (query.isError || !query.data) {
    return (
      <Alert variant="destructive">
        Não foi possível obter o estado deste relatório.{" "}
        <Link href="/reports" className="underline">
          Voltar ao histórico
        </Link>
      </Alert>
    );
  }

  const report = query.data;

  return (
    <div className="space-y-6">
      <AiBanner />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-base">
            <span>{TEMPLATE_LABEL[report.templateId]}</span>
            <StatusBadge status={report.status} />
          </CardTitle>
          <CardDescription>
            Período: {report.periodStart} → {report.periodEnd}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {report.status === "pending" || report.status === "running" ? (
            <div className="flex items-center gap-3 text-muted-foreground">
              <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-primary" />
              A gerar relatório. Esta página atualiza automaticamente. Pode
              demorar até 90 segundos.
            </div>
          ) : null}

          {report.status === "failed" && report.errorMessage ? (
            <Alert variant="destructive">{report.errorMessage}</Alert>
          ) : null}

          {report.status === "cancelled" ? (
            <Alert variant="info">Geração cancelada.</Alert>
          ) : null}

          {report.status === "ready" ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Concluído. {STATUS_LABEL.ready}.
              </p>
              <Button
                onClick={() => download.mutate()}
                disabled={download.isPending}
              >
                {download.isPending ? "A preparar…" : "Descarregar PDF"}
              </Button>
              {download.isError ? (
                <Alert variant="destructive">
                  Não foi possível preparar o download. Tente novamente.
                </Alert>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {report.status === "ready" && report.commentary ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo executivo</CardTitle>
            <CardDescription>
              Pré-visualização do comentário incluído no PDF.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {report.commentary.sections.map((section, i) => (
              <article key={i} className="space-y-2">
                <h3 className="text-sm font-semibold">{section.title}</h3>
                <p className="text-muted-foreground">{section.narrative}</p>
                {section.callouts.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    {section.callouts.map((c, j) => (
                      <li key={j}>{c}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integridade</CardTitle>
          <CardDescription>
            Hash SHA-256 dos dados de entrada — auditável.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <code className="break-all text-xs text-muted-foreground">
            {report.inputDataHash}
          </code>
        </CardContent>
      </Card>
    </div>
  );
}
