// Pure geometry helpers for the SVG chart primitives. No DOM, no
// dependency: charts are rendered as static SVG markup by
// renderToStaticMarkup, so every coordinate must be computed here and
// rounded deterministically (identical input → identical markup, which
// keeps snapshot tests stable and review diffs readable).

// Fixed-precision rounding. All emitted SVG coordinates pass through
// this so floating-point drift never changes the markup.
export function r(n: number, precision = 2): number {
  const f = 10 ** precision;
  // +0 normalises -0 → 0 so "-0" never appears in path strings.
  return Math.round(n * f) / f + 0;
}

export interface Point {
  x: number;
  y: number;
}

// Angle in radians, measured clockwise from 12 o'clock (the donut
// convention — slices start at the top and sweep right).
export function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleRad: number,
): Point {
  return {
    x: r(cx + radius * Math.sin(angleRad)),
    y: r(cy - radius * Math.cos(angleRad)),
  };
}

// One datum for pie/donut/legend charts.
export interface ChartSeriesDatum {
  label: string;
  value: number;
  // Optional explicit color; when absent the chart assigns from the
  // theme palette in array order.
  color?: string;
}

// Annular-sector path (donut slice) from startAngle→endAngle (radians,
// clockwise from top). Handles the large-arc flag for slices > 180°.
export function donutSlicePath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = endAngle - startAngle;
  const largeArc = sweep > Math.PI ? 1 : 0;
  const oStart = polarToCartesian(cx, cy, outerR, startAngle);
  const oEnd = polarToCartesian(cx, cy, outerR, endAngle);
  const iEnd = polarToCartesian(cx, cy, innerR, endAngle);
  const iStart = polarToCartesian(cx, cy, innerR, startAngle);
  // Outer arc clockwise (sweep-flag 1), inner arc back counter-clockwise
  // (sweep-flag 0).
  return [
    `M ${oStart.x} ${oStart.y}`,
    `A ${r(outerR)} ${r(outerR)} 0 ${largeArc} 1 ${oEnd.x} ${oEnd.y}`,
    `L ${iEnd.x} ${iEnd.y}`,
    `A ${r(innerR)} ${r(innerR)} 0 ${largeArc} 0 ${iStart.x} ${iStart.y}`,
    "Z",
  ].join(" ");
}

// "Nice" upper bound + evenly spaced ticks for a value axis starting at
// zero. Returns the axis max and ascending tick values (incl. 0 and max).
export function niceAxis(maxValue: number, tickCount = 4): { max: number; ticks: number[] } {
  if (maxValue <= 0) return { max: 1, ticks: [0, 1] };
  const rawStep = maxValue / tickCount;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / mag;
  const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  const step = niceNorm * mag;
  const max = step * Math.ceil(maxValue / step);
  const ticks: number[] = [];
  for (let v = 0; v <= max + step / 2; v += step) ticks.push(r(v, 4));
  return { max, ticks };
}
