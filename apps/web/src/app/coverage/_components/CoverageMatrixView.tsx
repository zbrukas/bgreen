"use client";

// V10.4 — interactive coverage matrix.

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
import { Recommend } from "@carbon/icons-react";
import { Button, Checkbox, InlineNotification, Tile } from "@carbon/react";
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

  const onToggleApplicable = (next: boolean) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (next) params.set("includeNonApplicable", "true");
    else params.delete("includeNonApplicable");
    router.push(`/coverage?${params.toString()}`);
  };

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
          <Checkbox
            id="applicable-only"
            labelText="Apenas aplicáveis ao meu setor"
            checked={!initialIncludeNonApplicable}
            onChange={(_e, { checked }) => onToggleApplicable(!checked)}
          />
          <Button
            kind="primary"
            onClick={() => check.mutate()}
            disabled={check.isPending || initialMatrix.rows.length === 0}
            size="sm"
            renderIcon={Recommend}
          >
            {check.isPending ? "A gerar…" : "Explicar cobertura"}
          </Button>
        </div>
      </div>

      {aiError ? (
        <InlineNotification
          kind="warning"
          title="Atenção"
          subtitle={aiError}
          lowContrast
          hideCloseButton
        />
      ) : null}

      {filteredRows.length === 0 ? (
        <Tile>
          <p className="py-6 text-center text-sm text-neutral-600">
            Nenhum datapoint corresponde ao filtro actual.
          </p>
        </Tile>
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
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-[var(--cds-interactive)] bg-[var(--cds-interactive)] text-[#37323e]"
          : "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100"
      }`}
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
    <Tile>
      <div className="flex flex-wrap items-baseline gap-3">
        <span
          className="text-xs text-neutral-600"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          {datapoint.code}
        </span>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>{datapoint.title}</h3>
        <div className="ml-auto flex items-center gap-2">
          <StatusBadge status={status} />
          {!applicable ? <span className="text-xs text-neutral-600">não aplicável</span> : null}
        </div>
      </div>
      <p className="mt-2 text-sm text-neutral-700">{datapoint.description}</p>
      <div className="mt-3 space-y-3 text-sm">
        {status !== "missing" ? (
          <p className="text-xs text-neutral-600">
            {evidence.templateIds.length} modelo(s) mapeado(s) · {evidence.recordIds.length}{" "}
            registo(s) submetido(s)
          </p>
        ) : null}

        <button
          type="button"
          onClick={onToggle}
          className="text-xs font-medium text-[var(--cds-link-primary)] hover:underline"
        >
          {expanded ? "Esconder" : isMissing ? "Como começar" : "Ver detalhes"}
        </button>

        {expanded ? (
          <div className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
            {explanation ? (
              <>
                <p className="text-sm leading-relaxed">{explanation.explanation}</p>
                <p className="text-xs font-medium">Próximo passo</p>
                <p className="text-sm leading-relaxed text-neutral-600">
                  {explanation.suggestedNextStep}
                </p>
              </>
            ) : (
              <p className="text-xs text-neutral-600">
                Clique em «Explicar cobertura» para gerar explicações.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </Tile>
  );
}
