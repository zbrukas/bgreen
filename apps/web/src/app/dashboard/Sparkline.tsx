// Compact pure-SVG sparkline for dashboard cards. Renders up to N
// points; no axes / labels (the card surrounds it with the latest
// value). Empty / single-point states render placeholder text rather
// than a one-pixel chart.

interface SparklineProps {
  // Most-recent-last ordering — the chart reads left-to-right.
  values: number[];
  // Display value range. Defaults to fitting the data with 10% padding.
  domain?: { min: number; max: number };
  // Container is responsive — the SVG fills its parent. width/height
  // here is the viewBox aspect ratio, not pixels.
  width?: number;
  height?: number;
  // Stroke colour. Default teal-700 matches the trend chart.
  color?: string;
}

export function Sparkline({
  values,
  domain,
  width = 100,
  height = 32,
  color = "#0f766e",
}: SparklineProps) {
  if (values.length === 0) {
    return <span className="text-xs text-muted-foreground">sem dados</span>;
  }
  if (values.length === 1) {
    return <span className="text-xs text-muted-foreground">só 1 entrada</span>;
  }

  const xs = values.map((_, i) => i);
  const yMin = domain ? domain.min : Math.min(...values);
  const yMax = domain ? domain.max : Math.max(...values);
  const range = yMax - yMin;
  const yLo = yMin - range * 0.1;
  const yHi = yMax + range * 0.1;

  const M = 2; // tiny margin so circles don't clip the edge
  const innerW = width - M * 2;
  const innerH = height - M * 2;
  const xMax = Math.max(...xs);

  const xToPx = (i: number): number => (xMax === 0 ? M : M + (i / xMax) * innerW);
  const yToPx = (v: number): number =>
    yHi === yLo ? M + innerH / 2 : M + innerH - ((v - yLo) / (yHi - yLo)) * innerH;

  // Build the polyline path. No null-handling — sparkline callers pre-
  // filter to numeric values.
  let path = "";
  values.forEach((v, i) => {
    path += `${i === 0 ? "M" : "L"}${xToPx(i)},${yToPx(v)} `;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label="Tendência do score"
      preserveAspectRatio="none"
    >
      <title>Tendência do score</title>
      <path d={path.trim()} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      {values.map((v, i) => (
        <circle key={i} cx={xToPx(i)} cy={yToPx(v)} r={2} fill={color} />
      ))}
    </svg>
  );
}
