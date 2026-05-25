// Pure-SVG line chart. Two series per metric: company value + peer
// median (when available). Two stacked panels — turnover (€) and EBITDA
// margin (%). No chart library — V7.3's needs are simple enough that a
// recharts/chart.js dep would be overkill, and the SVG path stays in our
// design system without theme drift.
//
// Server component is fine here (no interactivity yet); year picker
// lives in a separate client component on the page.

import type { TrendYearRow } from "@/lib/economic-profile-types";

interface Series {
  label: string;
  // Stroke color (Tailwind-friendly hex).
  color: string;
  values: Array<{ x: number; y: number | null }>;
}

interface Panel {
  title: string;
  format: (n: number) => string;
  series: Series[];
}

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

function PanelView({ panel }: { panel: Panel }) {
  // Compute Y range from all non-null values across all series.
  const yValues = panel.series.flatMap((s) => s.values.map((v) => v.y)).filter(
    (v): v is number => v !== null,
  );
  if (yValues.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-medium">{panel.title}</h3>
        <p className="text-xs text-muted-foreground">Sem dados.</p>
      </div>
    );
  }
  const xValues = panel.series[0]?.values.map((v) => v.x) ?? [];
  const yMin = Math.min(0, ...yValues);
  const yMax = Math.max(...yValues);
  const yPad = Math.max(1, (yMax - yMin) * 0.15);
  const yLo = yMin - yPad * 0.2;
  const yHi = yMax + yPad;
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);

  const W = 640;
  const H = 200;
  // Margins: leave room for axis labels.
  const M = { top: 12, right: 16, bottom: 24, left: 72 };
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;

  const xToPx = (x: number): number => {
    if (xMax === xMin) return M.left + innerW / 2;
    return M.left + ((x - xMin) / (xMax - xMin)) * innerW;
  };
  const yToPx = (y: number): number => {
    if (yHi === yLo) return M.top + innerH / 2;
    return M.top + innerH - ((y - yLo) / (yHi - yLo)) * innerH;
  };

  // 3 horizontal gridlines (top, middle, bottom).
  const ticks = [yLo, (yLo + yHi) / 2, yHi];

  return (
    <div>
      <h3 className="text-sm font-medium">{panel.title}</h3>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Gráfico de ${panel.title}`}
        className="mt-1"
      >
        <title>{`Gráfico de ${panel.title}`}</title>
        {/* Gridlines */}
        {ticks.map((t) => (
          <line
            key={t}
            x1={M.left}
            x2={W - M.right}
            y1={yToPx(t)}
            y2={yToPx(t)}
            stroke="#e2e8f0"
            strokeDasharray="3,3"
          />
        ))}
        {/* Y axis labels */}
        {ticks.map((t) => (
          <text
            key={t}
            x={M.left - 8}
            y={yToPx(t)}
            textAnchor="end"
            dominantBaseline="central"
            fontSize="10"
            fill="#64748b"
          >
            {panel.format(t)}
          </text>
        ))}
        {/* X axis ticks (one per year) */}
        {xValues.map((x) => (
          <text
            key={x}
            x={xToPx(x)}
            y={H - 6}
            textAnchor="middle"
            fontSize="10"
            fill="#64748b"
          >
            {x}
          </text>
        ))}
        {/* Series */}
        {panel.series.map((series) => (
          <SeriesPath
            key={series.label}
            series={series}
            xToPx={xToPx}
            yToPx={yToPx}
          />
        ))}
      </svg>
    </div>
  );
}

function SeriesPath({
  series,
  xToPx,
  yToPx,
}: {
  series: Series;
  xToPx: (x: number) => number;
  yToPx: (y: number) => number;
}) {
  // Build a polyline path skipping nulls (broken line through gaps).
  let path = "";
  let lifted = true;
  for (const point of series.values) {
    if (point.y === null) {
      lifted = true;
      continue;
    }
    const cmd = lifted ? "M" : "L";
    path += `${cmd}${xToPx(point.x)},${yToPx(point.y)} `;
    lifted = false;
  }
  return (
    <>
      <path d={path.trim()} fill="none" stroke={series.color} strokeWidth={2} />
      {series.values.map((point) =>
        point.y === null ? null : (
          <circle
            key={`${series.label}-${point.x}`}
            cx={xToPx(point.x)}
            cy={yToPx(point.y)}
            r={3.5}
            fill={series.color}
          />
        ),
      )}
    </>
  );
}

function Legend() {
  return (
    <div className="flex gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#0f766e]" />
        A sua empresa
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#94a3b8]" />
        Mediana setorial
      </span>
    </div>
  );
}
