import { ArrowDown, ArrowUp } from "@carbon/icons-react";
import type { CarbonIconType } from "@carbon/icons-react";
import { ClickableTile, Tag, Tile } from "@carbon/react";
import type { ReactNode } from "react";

type TagType =
  | "red"
  | "magenta"
  | "purple"
  | "blue"
  | "cyan"
  | "teal"
  | "green"
  | "gray"
  | "cool-gray"
  | "warm-gray"
  | "high-contrast"
  | "outline";

interface StatCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: { value: string; direction: "up" | "down" | "flat"; suffix?: string };
  tier?: { label: string; type: TagType };
  sparkline?: number[];
  icon?: CarbonIconType;
  href?: string;
}

// Used on home + dashboard. Big number, optional sparkline + delta +
// tier tag + leading icon. Render as a ClickableTile when href is set so
// it doubles as a drill-down navigation card.
export function StatCard(props: StatCardProps) {
  const inner = <StatBody {...props} />;
  if (props.href) {
    return <ClickableTile href={props.href}>{inner}</ClickableTile>;
  }
  return <Tile>{inner}</Tile>;
}

function StatBody({ label, value, unit, delta, tier, sparkline, icon: Icon }: StatCardProps) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-neutral-600">
          {Icon && <Icon size={16} />}
          <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
        </div>
        {tier && <Tag type={tier.type}>{tier.label}</Tag>}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span
          style={{ fontSize: "2rem", fontWeight: 400, lineHeight: 1, letterSpacing: "-0.5px" }}
        >
          {value}
        </span>
        {unit && <span className="text-sm text-neutral-600">{unit}</span>}
      </div>
      {delta && (
        <div className="mt-1 flex items-center gap-1 text-xs">
          {delta.direction === "up" && (
            <ArrowUp size={12} style={{ color: "var(--cds-support-success)" }} />
          )}
          {delta.direction === "down" && (
            <ArrowDown size={12} style={{ color: "var(--cds-support-error)" }} />
          )}
          {delta.direction === "flat" && <span className="text-neutral-500">→</span>}
          <span
            className={
              delta.direction === "up"
                ? "text-[var(--cds-support-success)]"
                : delta.direction === "down"
                  ? "text-[var(--cds-support-error)]"
                  : "text-neutral-600"
            }
          >
            {delta.value}
          </span>
          {delta.suffix && <span className="text-neutral-500">{delta.suffix}</span>}
        </div>
      )}
      {sparkline && sparkline.length > 0 && (
        <div className="mt-4">
          <MiniSparkline values={sparkline} />
        </div>
      )}
    </>
  );
}

function MiniSparkline({ values }: { values: number[] }) {
  const w = 200;
  const h = 40;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = w / (values.length - 1 || 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Tendência">
      <polyline
        points={points}
        fill="none"
        stroke="var(--cds-interactive, #63b995)"
        strokeWidth={1.5}
      />
    </svg>
  );
}
