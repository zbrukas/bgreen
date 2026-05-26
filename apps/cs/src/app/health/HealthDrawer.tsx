"use client";

import type { CsHealthRow, CsHealthTier } from "@bgreen/types";
import { Close } from "@carbon/icons-react";
import {
  Button,
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
  Tag,
} from "@carbon/react";
import { useEffect, useState } from "react";
import type { CsHealthDetail } from "@/lib/api-client";
import { getHealthDetail } from "./actions";

interface HealthDrawerProps {
  organizationId: string;
  tierLabel: Record<CsHealthTier, string>;
  tierTag: Record<CsHealthTier, "green" | "warm-gray" | "red">;
  onClose: () => void;
}

export function HealthDrawer({
  organizationId,
  tierLabel,
  tierTag,
  onClose,
}: HealthDrawerProps) {
  const [detail, setDetail] = useState<CsHealthDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getHealthDetail(organizationId).then((d) => {
      if (cancelled) return;
      setDetail(d);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Detalhe de saúde"
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col overflow-y-auto border-l border-[--cds-border-subtle] bg-white shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-[--cds-border-subtle] px-6 py-4">
        <div>
          <div className="font-mono text-xs text-[--cds-text-secondary]">
            {organizationId}
          </div>
          {detail && (
            <div className="mt-1 flex items-center gap-2">
              <Tag size="md" type={tierTag[detail.healthTier]}>
                {tierLabel[detail.healthTier]}
              </Tag>
              <span className="font-mono text-xl text-[--cds-text-primary]">
                {detail.healthScore}
              </span>
            </div>
          )}
        </div>
        <Button
          kind="ghost"
          size="sm"
          renderIcon={Close}
          iconDescription="Fechar"
          hasIconOnly
          onClick={onClose}
        />
      </div>
      <div className="space-y-6 px-6 py-6">
        {loading && <p className="text-sm text-[--cds-text-secondary]">A carregar…</p>}
        {detail && (
          <>
            <SignalsList row={detail.row} />
            <Sparkline
              title="Score (últimos 90 dias)"
              points={detail.snapshots.map((s) => s.metrics.healthScore)}
            />
            <StagnantPanel row={detail.row} />
          </>
        )}
        {!loading && !detail && (
          <p className="text-sm text-[--cds-text-error]">Não foi possível carregar o detalhe.</p>
        )}
      </div>
    </div>
  );
}

function SignalsList({ row }: { row: CsHealthRow }) {
  const rows: Array<[string, string]> = [
    ["Criada", new Date(row.createdAt).toLocaleDateString("pt-PT")],
    ["Dias desde criação", String(row.daysSinceCreated)],
    [
      "Ativado em 30d",
      row.activatedIn30d ? "Sim" : row.daysToFirstRecord !== null ? "Tardio" : "Não",
    ],
    [
      "Cobertura",
      row.coveragePercent === null
        ? "Sem modelos atribuídos"
        : `${row.coveragePercent.toFixed(0)}%  (${row.requiredTemplatesWithCurrentPeriodData}/${row.requiredTemplatesCount})`,
    ],
    ["Registos (trimestre)", `${row.recordsCurrentQuarter} (anterior ${row.recordsPreviousQuarter})`],
    ["Tendência", row.engagementTrend],
    [
      "Último login",
      row.lastLoginAt === null
        ? "Nunca"
        : new Date(row.lastLoginAt).toLocaleString("pt-PT"),
    ],
    ["WAU / MAU", `${row.wauCount} / ${row.mauCount}`],
    [
      "YoY Score",
      row.latestScoreYoyDelta === null
        ? "—"
        : `${(row.latestScoreYoyDelta * 100).toFixed(1)}%`,
    ],
  ];
  return (
    <StructuredListWrapper aria-label="Sinais de saúde">
      <StructuredListHead>
        <StructuredListRow head>
          <StructuredListCell head>Sinal</StructuredListCell>
          <StructuredListCell head>Valor</StructuredListCell>
        </StructuredListRow>
      </StructuredListHead>
      <StructuredListBody>
        {rows.map(([k, v]) => (
          <StructuredListRow key={k}>
            <StructuredListCell>{k}</StructuredListCell>
            <StructuredListCell>{v}</StructuredListCell>
          </StructuredListRow>
        ))}
      </StructuredListBody>
    </StructuredListWrapper>
  );
}

function StagnantPanel({ row }: { row: CsHealthRow }) {
  const total = row.stagnantWorkflowsCount;
  if (total === 0) {
    return (
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[--cds-text-secondary]">
          Itens parados
        </h3>
        <p className="text-sm text-[--cds-text-secondary]">Sem trabalho parado há mais de 14 dias.</p>
      </div>
    );
  }
  const byDef = Object.entries(row.stagnantWorkflowsByDefinition);
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[--cds-text-secondary]">
        Itens parados ({total})
      </h3>
      <p className="mb-2 text-sm text-[--cds-text-secondary]">
        Workflows não-terminais sem transição há mais de 14 dias. Mais antigo:{" "}
        {row.oldestStagnantWorkflowDays ?? "—"}d.
      </p>
      <ul className="space-y-1 text-sm">
        {byDef.map(([def, count]) => (
          <li key={def} className="flex justify-between rounded-sm bg-[--cds-layer] px-3 py-2">
            <span className="font-mono text-xs">{def}</span>
            <span>{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Tiny hand-rolled sparkline. No external chart dep for this size.
function Sparkline({ title, points }: { title: string; points: number[] }) {
  if (points.length === 0) {
    return (
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[--cds-text-secondary]">
          {title}
        </h3>
        <p className="text-sm text-[--cds-text-secondary]">
          Sem snapshots suficientes (a snapshot diária ainda não acumulou dados).
        </p>
      </div>
    );
  }
  const w = 600;
  const h = 60;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(1, max - min);
  const path = points
    .map((p, i) => {
      const x = (i / Math.max(1, points.length - 1)) * w;
      const y = h - ((p - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[--cds-text-secondary]">
        {title}
      </h3>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={title}
        className="w-full"
        preserveAspectRatio="none"
      >
        <path d={path} fill="none" stroke="var(--cds-interactive)" strokeWidth={1.5} />
      </svg>
      <div className="mt-1 flex justify-between text-xs text-[--cds-text-secondary]">
        <span>min {min}</span>
        <span>{points.length} dias</span>
        <span>max {max}</span>
      </div>
    </div>
  );
}
