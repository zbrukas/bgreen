// V11.2 — brand theming helper. Single source of truth for the
// "accent" color templates use on headings, callout borders, status
// pills. Default falls back to bGreen's primary green when the org
// hasn't set one.
//
// Contrast clamping (WCAG-AA against white) lands in V11.4 when the
// settings UI surfaces a preview. For V11.2 we trust the validated
// hex string from the route layer.
//
// Phase-1 visual layer extends BrandTheme with a small palette
// (primary/secondary/surface + ordered chart series) for the
// carbon-footprint deck. `accent` is kept EXACTLY equal to the input
// primaryColor so the three existing templates and their snapshot
// tests are unaffected.

export interface BrandTheme {
  // Unchanged: equals primaryColor verbatim (or the default). Existing
  // callers + snapshots depend on this.
  accent: string;
  primary: string;
  // Darker shade of primary, used for headers / deck dividers.
  secondary: string;
  // Pale tint of primary for full-bleed surfaces + table zebra.
  surface: string;
  // Legible text color on `surface`.
  onSurface: string;
  // Ordered chart series palette (length >= 8). First entry = primary.
  series: string[];
}

const DEFAULT_ACCENT = "#0f6f3e";

// Curated default series palette that harmonises with bGreen green.
// Entry 0 is replaced by the org primary at runtime.
const DEFAULT_SERIES = [
  "#0f6f3e", // green (primary placeholder)
  "#1f6feb", // blue
  "#e8833a", // orange
  "#3aa6a0", // teal
  "#8b5cf6", // violet
  "#d4456c", // rose
  "#c9a227", // gold
  "#5b7083", // slate
];

export function brandTheme(primaryColor: string | null): BrandTheme {
  const accent = primaryColor ?? DEFAULT_ACCENT;
  const hsl = hexToHsl(accent);
  const secondary = hsl ? hslToHex({ ...hsl, l: clamp01(hsl.l - 0.18) }) : "#0a4f2c";
  const surface = hsl ? hslToHex({ ...hsl, s: clamp01(hsl.s * 0.5), l: 0.96 }) : "#eef6f1";
  const onSurface = relativeLuminance(surface) > 0.6 ? "#1f2937" : "#ffffff";
  // series[0] = the org primary; keep the rest of the curated palette.
  const series = [accent, ...DEFAULT_SERIES.slice(1)];
  return { accent, primary: accent, secondary, surface, onSurface, series };
}

// ── pure color helpers (deterministic, no deps) ────────────────────

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function hexToHsl(hex: string): Hsl | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m || !m[1]) return null;
  const int = Number.parseInt(m[1], 16);
  const r = ((int >> 16) & 0xff) / 255;
  const g = ((int >> 8) & 0xff) / 255;
  const b = (int & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function hslToHex({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(rp)}${to(gp)}${to(bp)}`;
}

function relativeLuminance(hex: string): number {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m || !m[1]) return 1;
  const int = Number.parseInt(m[1], 16);
  const ch = [(int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (ch[0] ?? 0) + 0.7152 * (ch[1] ?? 0) + 0.0722 * (ch[2] ?? 0);
}
