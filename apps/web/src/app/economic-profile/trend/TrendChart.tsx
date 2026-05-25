// Pure-SVG line chart. Two series per metric: company value + peer
// median (when available). Two stacked panels — turnover (€) and EBITDA
// margin (%). No chart library — V7.3's needs are simple enough that a
// recharts/chart.js dep would be overkill, and the SVG path stays in our
// design system without theme drift.
//
// Server component is fine here (no interactivity yet); year picker
// lives in a separate client component on the page.

import type { TrendYearRow } from "@/lib/economic-profile-types";
import { Legend } from "./_components/Legend";
import { PanelView } from "./_components/PanelView";
import type { Panel } from "./_components/types";

const EUR = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});
const PCT = new Intl.NumberFormat("pt-PT", {
  style: "percent",
  maximumFractionDigits: 1,
});

export function TrendChart({ rows }: { rows: TrendYearRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ainda não há dados económicos para mostrar.
      </p>
    );
  }
  if (rows.length === 1) {
    return (
      <p className="text-sm text-muted-foreground">
        Carregue mais um exercício para ver tendências.
      </p>
    );
  }

  const panels: Panel[] = [
    {
      title: "Volume de negócios",
      format: (n) => EUR.format(n),
      series: [
        {
          label: "A sua empresa",
          color: "#0f766e", // teal-700
          values: rows.map((r) => ({ x: r.year, y: r.turnover })),
        },
        {
          label: "Mediana setorial",
          color: "#94a3b8", // slate-400
          values: rows.map((r) => ({ x: r.year, y: r.peerMedianTurnover })),
        },
      ],
    },
    {
      title: "Margem EBITDA",
      format: (n) => PCT.format(n),
      series: [
        {
          label: "A sua empresa",
          color: "#0f766e",
          values: rows.map((r) => ({ x: r.year, y: r.ebitdaMargin })),
        },
        {
          label: "Mediana setorial",
          color: "#94a3b8",
          values: rows.map((r) => ({ x: r.year, y: r.peerMedianEbitdaMargin })),
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {panels.map((panel) => (
        <PanelView key={panel.title} panel={panel} />
      ))}
      <Legend />
    </div>
  );
}
