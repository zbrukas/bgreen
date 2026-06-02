// Time-series area/line chart. One or more series sharing an ordered
// x-axis (categorical labels, evenly spaced). `stacked` stacks the
// series; otherwise they overlap as translucent areas. Pure SVG.

import { niceAxis, r } from "./geometry.js";

export interface AreaSeries {
  key: string;
  label?: string;
  // y values aligned positionally with `xLabels`.
  values: number[];
}

export interface AreaChartProps {
  xLabels: string[];
  series: AreaSeries[];
  stacked?: boolean;
  // When true draw lines only (no fill).
  lineOnly?: boolean;
  palette: string[];
  width?: number;
  height?: number;
  yUnit?: string;
  yTickCount?: number;
  formatValue?: (n: number) => string;
}

export function AreaChart({
  xLabels,
  series,
  stacked = false,
  lineOnly = false,
  palette,
  width = 560,
  height = 280,
  yUnit,
  yTickCount = 4,
  formatValue = (n) => String(Math.round(n)),
}: AreaChartProps) {
  const padLeft = 56;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 32;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const n = xLabels.length;

  // Compute per-point cumulative tops when stacked.
  const cumulative = stacked ? xLabels.map(() => 0) : null;
  const computed = series.map((s, si) => {
    const points = xLabels.map((_, xi) => {
      const v = s.values[xi] ?? 0;
      if (cumulative) {
        const base = cumulative[xi] ?? 0;
        const top = base + v;
        cumulative[xi] = top;
        return { base, top };
      }
      return { base: 0, top: v };
    });
    return { s, si, points };
  });

  const maxValue = Math.max(
    0,
    ...(stacked ? (cumulative ?? []) : series.flatMap((s) => s.values)),
  );
  const { max, ticks } = niceAxis(maxValue, yTickCount);

  const xFor = (xi: number) => r(padLeft + (n <= 1 ? plotW / 2 : (plotW * xi) / (n - 1)));
  const yFor = (v: number) => r(padTop + plotH * (1 - v / max));
  const colorFor = (si: number) => palette[si % palette.length] ?? "#999";

  return (
    <svg className="chart chart-area" viewBox={`0 0 ${width} ${height}`} role="img">
      {ticks.map((t, i) => {
        const y = yFor(t);
        return (
          <g key={`t${i}`}>
            <line x1={padLeft} y1={y} x2={width - padRight} y2={y} className="chart-gridline" />
            <text x={padLeft - 8} y={y} className="chart-axis-label" textAnchor="end" dominantBaseline="central">
              {formatValue(t)}
            </text>
          </g>
        );
      })}
      {yUnit ? (
        <text x={4} y={11} className="chart-axis-unit" textAnchor="start">
          {yUnit}
        </text>
      ) : null}

      {computed.map(({ si, points }) => {
        const color = colorFor(si);
        const topLine = points.map((p, xi) => `${xi === 0 ? "M" : "L"} ${xFor(xi)} ${yFor(p.top)}`).join(" ");
        if (lineOnly) {
          return <path key={`ln${si}`} d={topLine} fill="none" stroke={color} strokeWidth={2} />;
        }
        // Area: top line forward, base line back.
        const baseLine = points
          .map((_p, xi) => `L ${xFor(n - 1 - xi)} ${yFor(points[n - 1 - xi]?.base ?? 0)}`)
          .join(" ");
        const area = `${topLine} ${baseLine} Z`;
        return (
          <g key={`ar${si}`}>
            <path d={area} fill={color} fillOpacity={stacked ? 0.85 : 0.25} />
            <path d={topLine} fill="none" stroke={color} strokeWidth={2} />
          </g>
        );
      })}

      {xLabels.map((lbl, xi) => (
        <text key={`x${xi}`} x={xFor(xi)} y={height - padBottom + 16} className="chart-axis-label" textAnchor="middle">
          {lbl}
        </text>
      ))}
      <line x1={padLeft} y1={yFor(0)} x2={width - padRight} y2={yFor(0)} className="chart-axis" />
    </svg>
  );
}
