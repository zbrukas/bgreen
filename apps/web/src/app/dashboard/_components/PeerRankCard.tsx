"use client";

import {
  type BenchmarkComparison,
  DIMENSAO_LABEL,
  isBenchmarkInsufficientData,
} from "@/lib/economic-profile-types";
import { InlineNotification, Tile } from "@carbon/react";
import { formatMoney, formatRatio } from "./format";

export function PeerRankCard({ comparison }: { comparison: BenchmarkComparison }) {
  const { profile, aggregate, deltas } = comparison;

  if (isBenchmarkInsufficientData(aggregate)) {
    return (
      <Tile>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
          Comparação setorial — {profile.year}
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Dados setoriais insuficientes para a sua dimensão / CAE este ano.
        </p>
        <div className="mt-3">
          <InlineNotification
            kind="info"
            title="Sem dados de pares"
            subtitle="Confirme a dimensão e o CAE no perfil económico para desbloquear a comparação."
            lowContrast
            hideCloseButton
          />
        </div>
      </Tile>
    );
  }

  const dimensaoLabel = profile.dimensao ? DIMENSAO_LABEL[profile.dimensao] : "—";

  return (
    <Tile>
      <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
        Comparação setorial — {profile.year}
      </h2>
      <p className="mt-1 text-sm text-neutral-600">
        CAE-3 {aggregate.cae3} · {dimensaoLabel} · {aggregate.nCompanies} empresas (dados de{" "}
        {aggregate.vintageYear})
      </p>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <BenchmarkBar
          label="Volume de negócios"
          you={profile.turnover}
          peer={aggregate.medianTurnover}
          delta={deltas.turnoverVsMedian}
          format={formatMoney}
        />
        <BenchmarkBar
          label="Margem EBITDA"
          you={profile.ebitdaMargin}
          peer={aggregate.medianEbitdaMargin}
          delta={deltas.ebitdaMarginVsMedian}
          format={formatRatio}
        />
      </div>
    </Tile>
  );
}

// Horizontal bar comparison: your value relative to peer P50 baseline.
// Bar lengths are normalized to the larger of (you, peer) so they share
// the same scale visually. Delta sign drives the colour cue.
function BenchmarkBar({
  label,
  you,
  peer,
  delta,
  format,
}: {
  label: string;
  you: number | null;
  peer: number | null;
  delta: number | null;
  format: (v: number | null) => string;
}) {
  const yourPct = you !== null && peer !== null && Math.max(you, peer) > 0
    ? Math.max(0, Math.min(100, (you / Math.max(you, peer)) * 100))
    : 0;
  const peerPct = you !== null && peer !== null && Math.max(you, peer) > 0
    ? Math.max(0, Math.min(100, (peer / Math.max(you, peer)) * 100))
    : 0;
  const sign = delta === null ? "" : delta > 0 ? "+" : "";
  const deltaCopy = delta === null ? "—" : `${sign}${format(delta)}`;
  const deltaColor =
    delta === null
      ? "text-neutral-500"
      : delta > 0
        ? "text-[var(--cds-support-success)]"
        : delta < 0
          ? "text-[var(--cds-support-warning)]"
          : "text-neutral-500";

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-600">{label}</span>
        <span className={`text-xs font-medium ${deltaColor}`}>{deltaCopy}</span>
      </div>
      <div className="space-y-1.5">
        <BarRow legend="Você" value={format(you)} pct={yourPct} tone="brand" />
        <BarRow legend="Mediana setor" value={format(peer)} pct={peerPct} tone="neutral" />
      </div>
    </div>
  );
}

function BarRow({
  legend,
  value,
  pct,
  tone,
}: {
  legend: string;
  value: string;
  pct: number;
  tone: "brand" | "neutral";
}) {
  return (
    <div>
      <div className="mb-0.5 flex items-baseline justify-between gap-3 text-xs">
        <span className="text-neutral-600">{legend}</span>
        <span className="font-medium text-neutral-900">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-sm bg-neutral-100">
        <div
          className="h-full rounded-sm"
          style={{
            width: `${pct}%`,
            backgroundColor: tone === "brand" ? "var(--cds-interactive)" : "#c6c6c6",
            transition: "width 320ms cubic-bezier(0.2, 0, 0.38, 0.9)",
          }}
        />
      </div>
    </div>
  );
}
