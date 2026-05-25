import type { Series } from "./types";

export function SeriesPath({
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
