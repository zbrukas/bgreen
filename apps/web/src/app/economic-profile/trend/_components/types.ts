// Shared types for the trend chart's panels and series. Not exported
// from the chart itself — purely an internal contract between
// TrendChart, PanelView, and SeriesPath.

export interface Series {
  label: string;
  // Stroke color (Tailwind-friendly hex).
  color: string;
  values: Array<{ x: number; y: number | null }>;
}

export interface Panel {
  title: string;
  format: (n: number) => string;
  series: Series[];
}
