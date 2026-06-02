// Vertical stacked-column chart with a zero-based value axis. One
// column per category/period; each column stacks `seriesKeys` bottom→
// top. Pure SVG, deterministic geometry. Axis bounds via niceAxis().

import { niceAxis, r } from "./geometry.js";

export interface StackedBarDatum {
  label: string;
  segments: Array<{ key: string; value: number }>;
}

export interface StackedBarChartProps {
  data: StackedBarDatum[];
  seriesKeys: string[];
  palette: string[];
  width?: number;
  height?: number;
  yUnit?: string;
  yTickCount?: number;
  formatValue?: (n: number) => string;
}

export function StackedBarChart({
  data,
  seriesKeys,
  palette,
  width = 560,
  height = 300,
  yUnit,
  yTickCount = 4,
  formatValue = (n) => String(Math.round(n)),
}: StackedBarChartProps) {
  const padLeft = 56;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 36;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const colorFor = (key: string) => palette[seriesKeys.indexOf(key) % palette.length] ?? "#999";

  const columnTotal = (d: StackedBarDatum) =>
    d.segments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
  const maxTotal = Math.max(0, ...data.map(columnTotal));
  const { max, ticks } = niceAxis(maxTotal, yTickCount);

  const yFor = (v: number) => r(padTop + plotH * (1 - v / max));
  const bandW = plotW / Math.max(1, data.length);
  const barW = r(Math.min(64, bandW * 0.6));

  return (
    <svg className="chart chart-bars" viewBox={`0 0 ${width} ${height}`} role="img">
      {/* gridlines + y ticks */}
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

      {/* columns */}
      {data.map((d, ci) => {
        const cx = r(padLeft + bandW * ci + bandW / 2);
        let cursor = 0;
        return (
          <g key={`c${ci}`}>
            {seriesKeys.map((key) => {
              const seg = d.segments.find((s) => s.key === key);
              const value = seg ? Math.max(0, seg.value) : 0;
              if (value <= 0) return null;
              const yTop = yFor(cursor + value);
              const yBottom = yFor(cursor);
              cursor += value;
              return (
                <rect
                  key={key}
                  x={r(cx - barW / 2)}
                  y={yTop}
                  width={barW}
                  height={r(Math.max(0, yBottom - yTop))}
                  fill={colorFor(key)}
                />
              );
            })}
            <text x={cx} y={height - padBottom + 16} className="chart-axis-label" textAnchor="middle">
              {d.label}
            </text>
          </g>
        );
      })}

      {/* baseline */}
      <line x1={padLeft} y1={yFor(0)} x2={width - padRight} y2={yFor(0)} className="chart-axis" />
    </svg>
  );
}
