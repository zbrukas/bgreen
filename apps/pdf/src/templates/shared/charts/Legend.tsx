// Shared legend: a grid of color swatch + label (+ optional value)
// rows. Used by the donut and stacked-bar charts.

export interface LegendItem {
  label: string;
  color: string;
  value?: string;
}

export interface LegendProps {
  items: LegendItem[];
  columns?: number;
}

export function Legend({ items, columns = 1 }: LegendProps) {
  return (
    <ul
      className="chart-legend"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {items.map((it, i) => (
        <li key={i} className="chart-legend-item">
          <span className="chart-legend-swatch" style={{ backgroundColor: it.color }} />
          <span className="chart-legend-label">{it.label}</span>
          {it.value !== undefined ? (
            <span className="chart-legend-value">{it.value}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
