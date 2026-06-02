// Donut chart: annular slices with a big center total + optional %
// labels on slices large enough to fit. Pure SVG, no DOM, deterministic
// geometry (see geometry.ts). Slice colors come from `palette` in order
// unless a datum carries an explicit color.

import { type ChartSeriesDatum, donutSlicePath, polarToCartesian, r } from "./geometry.js";

export interface DonutChartProps {
  data: ChartSeriesDatum[];
  // viewBox square size (px units). Rendered responsive via width:100%.
  size?: number;
  thickness?: number;
  centerPrimary?: string;
  centerSecondary?: string;
  palette: string[];
  // Hide the % label for slices smaller than this (avoids overlap).
  minSlicePctForLabel?: number;
}

const TWO_PI = Math.PI * 2;

export function DonutChart({
  data,
  size = 240,
  thickness = 42,
  centerPrimary,
  centerSecondary,
  palette,
  minSlicePctForLabel = 5,
}: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + Math.max(0, d.value), 0);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 2;
  const innerR = outerR - thickness;
  const labelR = (outerR + innerR) / 2;

  // Build slices; skip zero/negative values.
  let angle = 0;
  const slices = data
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.value > 0)
    .map(({ d, i }) => {
      const frac = total > 0 ? d.value / total : 0;
      const start = angle;
      const end = angle + frac * TWO_PI;
      angle = end;
      const mid = (start + end) / 2;
      const pct = frac * 100;
      const labelPos = polarToCartesian(cx, cy, labelR, mid);
      return {
        path: donutSlicePath(cx, cy, outerR, innerR, start, end),
        color: d.color ?? palette[i % palette.length] ?? "#999999",
        pct,
        labelX: labelPos.x,
        labelY: labelPos.y,
        showLabel: pct >= minSlicePctForLabel,
      };
    });

  return (
    <svg
      className="chart chart-donut"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Track ring behind slices keeps the donut visually closed even
          when totals are partial. */}
      <circle cx={cx} cy={cy} r={r((outerR + innerR) / 2)} fill="none" stroke="#eceef1" strokeWidth={thickness} />
      {slices.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} />
      ))}
      {slices.map((s, i) =>
        s.showLabel ? (
          <text
            key={`l${i}`}
            x={s.labelX}
            y={s.labelY}
            className="chart-donut-slice-label"
            textAnchor="middle"
            dominantBaseline="central"
          >
            {Math.round(s.pct)}%
          </text>
        ) : null,
      )}
      {centerPrimary !== undefined ? (
        <text x={cx} y={centerSecondary ? cy - 6 : cy} className="chart-donut-center-primary" textAnchor="middle" dominantBaseline="central">
          {centerPrimary}
        </text>
      ) : null}
      {centerSecondary !== undefined ? (
        <text x={cx} y={cy + 16} className="chart-donut-center-secondary" textAnchor="middle" dominantBaseline="central">
          {centerSecondary}
        </text>
      ) : null}
    </svg>
  );
}
