export function PeerRow({
  label,
  you,
  peer,
  delta,
  format,
}: {
  label: string;
  you: string;
  peer: string;
  delta: number | null;
  format: (v: number) => string;
}) {
  const sign = delta === null ? "" : delta > 0 ? "+" : "";
  const deltaCopy = delta === null ? "—" : `${sign}${format(delta)}`;
  const deltaTone =
    delta === null
      ? "text-muted-foreground"
      : delta > 0
        ? "text-emerald-700"
        : delta < 0
          ? "text-amber-700"
          : "text-muted-foreground";
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-3 text-sm">
        <span className="font-semibold text-foreground">{you}</span>
        <span className="text-muted-foreground">vs P50 {peer}</span>
        <span className={`ml-auto text-xs ${deltaTone}`}>{deltaCopy}</span>
      </div>
    </div>
  );
}
