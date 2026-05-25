"use client";

// V10.4 — interactive coverage matrix.
//
// SSR loads the deterministic matrix and passes it as a prop. This
// client component owns:
//   - status filter chips
//   - "applicable to my sector only" toggle (default on; flipping it
//     navigates to ?includeNonApplicable=true so the server re-renders
//     with the broader matrix — keeping the SSR boundary the source
//     of truth)
//   - "Explicar cobertura" mutation that calls POST /check and merges
//     the explanations back onto the rows
//   - per-row expansion to surface the AI explanation + suggested
//     next step

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { checkCoverage } from "@/lib/coverage-actions";
import {
  type CoverageCheckResult,
  type CoverageMatrix,
  type CoverageRow,
  type CoverageStatus,
  type Framework,
  type RowExplanation,
  STATUS_LABEL,
} from "@/lib/coverage-types";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AiBanner } from "./AiBanner";
import { StatusBadge } from "./StatusBadge";

interface CoverageMatrixViewProps {
  framework: Framework;
  initialMatrix: CoverageMatrix;
  initialIncludeNonApplicable: boolean;
}

type StatusFilter = "all" | CoverageStatus;

export function CoverageMatrixView({
  framework,
  initialMatrix,
  initialIncludeNonApplicable,
}: CoverageMatrixViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Toggle drives a server re-render via URL state. The matrix prop
  // updates on the next request; we don't try to merge client-side.
  const onToggleApplicable = (next: boolean) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (next) params.set("includeNonApplicable", "true");
    else params.delete("includeNonApplicable");
    router.push(`/coverage?${params.toString()}`);
  };

  // Client-side state for status filter + per-run explanations. The
  // matrix itself stays in props (server source of truth).
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [explanations, setExplanations] = useState<RowExplanation[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const check = useMutation({
    mutationFn: () =>
      checkCoverage(framework, {
        includeNonApplicable: initialIncludeNonApplicable,
      }),
    onSuccess: (result: CoverageCheckResult) => {
      setExplanations(result.explanations);
      setAiError(result.aiError);
      // Expand every row with a new explanation so the user sees the
      // narrative without clicking through each row.
      setExpandedRows(new Set(result.explanations.map((e) => e.datapointId)));
    },
  });

  const explanationsById = useMemo(() => {
    const map = new Map<string, RowExplanation>();
    for (const e of explanations) map.set(e.datapointId, e);
    return map;
  }, [explanations]);

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return initialMatrix.rows;
    return initialMatrix.rows.filter((r) => r.status === statusFilter);
  }, [initialMatrix.rows, statusFilter]);

  const toggleExpanded = (datapointId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(datapointId)) next.delete(datapointId);
      else next.add(datapointId);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <AiBanner />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusFilterChip
            label="Todos"
            count={initialMatrix.counts.total}
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          />
          <StatusFilterChip
            label={STATUS_LABEL.covered}
            count={initialMatrix.counts.covered}
            active={statusFilter === "covered"}
            onClick={() => setStatusFilter("covered")}
          />
          <StatusFilterChip
            label={STATUS_LABEL.partial}
            count={initialMatrix.counts.partial}
            active={statusFilter === "partial"}
            onClick={() => setStatusFilter("partial")}
          />
          <StatusFilterChip
            label={STATUS_LABEL.missing}
            count={initialMatrix.counts.missing}
            active={statusFilter === "missing"}
            onClick={() => setStatusFilter("missing")}
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={!initialIncludeNonApplicable}
              onChange={(e) => onToggleApplicable(!e.target.checked)}
              className="h-4 w-4"
            />
            Apenas aplicáveis ao meu setor
          </label>
          <Button
            onClick={() => check.mutate()}
            disabled={check.isPending || initialMatrix.rows.length === 0}
            size="sm"
          >
            {check.isPending ? "A gerar…" : "Explicar cobertura"}
          </Button>
        </div>
      </div>

      {aiError ? <Alert variant="warning">{aiError}</Alert> : null}

      {filteredRows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhum datapoint corresponde ao filtro actual.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRows.map((row) => (
            <CoverageRowCard
              key={row.datapoint.id}
              row={row}
              explanation={explanationsById.get(row.datapoint.id)}
              expanded={expandedRows.has(row.datapoint.id)}
              onToggle={() => toggleExpanded(row.datapoint.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface StatusFilterChipProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function StatusFilterChip({ label, count, active, onClick }: StatusFilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {label}
      <span className="ml-1 opacity-80">({count})</span>
    </button>
  );
}

interface CoverageRowCardProps {
  row: CoverageRow;
  explanation: RowExplanation | undefined;
  expanded: boolean;
  onToggle: () => void;
}

function CoverageRowCard({ row, explanation, expanded, onToggle }: CoverageRowCardProps) {
  const { datapoint, status, applicable, evidence } = row;
  const isMissing = status === "missing";
  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-xs font-mono text-muted-foreground">{datapoint.code}</span>
          <CardTitle className="text-base">{datapoint.title}</CardTitle>
          <div className="ml-auto flex items-center gap-2">
            <StatusBadge status={status} />
            {!applicable ? (
              <span className="text-xs text-muted-foreground">não aplicável</span>
            ) : null}
          </div>
        </div>
        <CardDescription>{datapoint.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {status !== "missing" ? (
          <p className="text-xs text-muted-foreground">
            {evidence.templateIds.length} modelo(s) mapeado(s) ·{" "}
            {evidence.recordIds.length} registo(s) submetido(s)
          </p>
        ) : null}

        <button
          type="button"
          onClick={onToggle}
          className="text-xs font-medium text-primary hover:underline"
        >
          {expanded
            ? "Esconder"
            : isMissing
              ? "Como começar"
              : "Ver detalhes"}
        </button>

        {expanded ? (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            {explanation ? (
              <>
                <p className="text-sm leading-relaxed">{explanation.explanation}</p>
                <p className="text-xs font-medium text-foreground">Próximo passo</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {explanation.suggestedNextStep}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Clique em &laquo;Explicar cobertura&raquo; para gerar explicações.
              </p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
