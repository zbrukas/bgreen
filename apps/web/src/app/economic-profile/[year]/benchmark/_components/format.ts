// pt-PT money + percent formatters used by the benchmark page widgets.

const EUR = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const PCT = new Intl.NumberFormat("pt-PT", {
  style: "percent",
  maximumFractionDigits: 1,
});

export function formatMoney(value: number | null): string {
  if (value === null) return "—";
  return EUR.format(value);
}

export function formatRatio(value: number | null): string {
  if (value === null) return "—";
  return PCT.format(value);
}

export function formatMoneyDelta(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${EUR.format(value)}`;
}

export function formatRatioDelta(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${PCT.format(value)}`;
}
