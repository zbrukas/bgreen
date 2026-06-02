// pt-PT number formatting shared by the deck template, charts, and
// rich tables. Hand-formatted (no Intl) so output is deterministic
// across Node versions — the same reason ghg-inventory.tsx formats by
// hand. Kept as a standalone module so the new visual layer doesn't
// depend on (or modify) the existing templates.

export function formatNumber(value: number, decimals = 0): string {
  // pt-PT: comma decimal separator, period thousands separator.
  const fixed = value.toFixed(decimals);
  const [int, frac] = fixed.split(".");
  const sign = int?.startsWith("-") ? "-" : "";
  const digits = (int ?? "0").replace("-", "");
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const body = `${sign}${grouped}`;
  return frac !== undefined ? `${body},${frac}` : body;
}

export function formatTco2e(value: number, decimals = 1): string {
  return `${formatNumber(value, decimals)} tCO₂e`;
}

export function formatPercent(value: number, decimals = 0): string {
  return `${formatNumber(value, decimals)}%`;
}

// pt-PT compact date: yyyy-mm-dd → dd/mm/yyyy.
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
