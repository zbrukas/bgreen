// Big KPI callout card (flex/div, not SVG). Used on the deck's summary
// page for headline figures like total emissions and intensity.

export interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  // Optional period-over-period delta indicator.
  delta?: { value: string; direction: "up" | "down" | "flat" };
  accent: string;
  // Optional emphasis: the hero card gets a filled accent background.
  variant?: "default" | "hero";
}

export function KpiCard({ label, value, unit, delta, accent, variant = "default" }: KpiCardProps) {
  const hero = variant === "hero";
  return (
    <div
      className={`kpi-card${hero ? " kpi-card-hero" : ""}`}
      style={hero ? { backgroundColor: accent } : { borderTopColor: accent }}
    >
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">
        {value}
        {unit ? <span className="kpi-unit"> {unit}</span> : null}
      </span>
      {delta ? (
        <span className={`kpi-delta kpi-delta-${delta.direction}`}>
          {delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "—"} {delta.value}
        </span>
      ) : null}
    </div>
  );
}
