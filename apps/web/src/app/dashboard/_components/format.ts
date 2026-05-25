// Dashboard-private formatters. Not React components; shared across
// the peer-rank widgets where consistent pt-PT number formatting matters.

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
