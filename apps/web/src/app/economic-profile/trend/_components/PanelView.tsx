import { SeriesPath } from "./SeriesPath";
import type { Panel } from "./types";

export function PanelView({ panel }: { panel: Panel }) {
  // Compute Y range from all non-null values across all series.
  const yValues = panel.series
    .flatMap((s) => s.values.map((v) => v.y))
    .filter((v): v is number => v !== null);
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
          <text key={x} x={xToPx(x)} y={H - 6} textAnchor="middle" fontSize="10" fill="#64748b">
            {x}
          </text>
        ))}
        {/* Series */}
        {panel.series.map((series) => (
          <SeriesPath key={series.label} series={series} xToPx={xToPx} yToPx={yToPx} />
        ))}
      </svg>
    </div>
  );
}
