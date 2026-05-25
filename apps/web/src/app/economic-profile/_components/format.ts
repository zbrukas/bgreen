// pt-PT money formatter shared by economic-profile page widgets.
// Vírgula decimal, espaço como separador (Intl handles both via locale).

const EUR = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function formatMoney(value: number | null): string {
  if (value === null) return "—";
  return EUR.format(value);
}
