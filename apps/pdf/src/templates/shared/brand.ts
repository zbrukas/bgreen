// V11.2 — brand theming helper. Single source of truth for the
// "accent" color templates use on headings, callout borders, status
// pills. Default falls back to bGreen's primary green when the org
// hasn't set one.
//
// Contrast clamping (WCAG-AA against white) lands in V11.4 when the
// settings UI surfaces a preview. For V11.2 we trust the validated
// hex string from the route layer.

export interface BrandTheme {
  accent: string;
}

const DEFAULT_ACCENT = "#0f6f3e";

export function brandTheme(primaryColor: string | null): BrandTheme {
  return { accent: primaryColor ?? DEFAULT_ACCENT };
}
