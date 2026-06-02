// Font embedding hook for the PDF templates.
//
// The rendered HTML document is self-contained (CSS is inlined and the
// page never makes network calls except for the logo image). To render
// a brand/custom font deterministically we embed it as a base64
// `@font-face` here — a remote font URL would add a second network
// fetch Gotenberg must complete within waitTimeout, and a flake would
// silently fall back to a different font, changing glyph metrics and
// therefore pagination.
//
// Phase 1 ships with NO embedded font bytes (we don't have licensed
// brand-font assets yet) and relies on the system stack below. When the
// woff2 subset lands, drop the base64 `@font-face` block(s) into
// FONT_FACE_CSS and reference the family in DECK_FONT_STACK — no other
// change is needed; styles.ts already concatenates FONT_FACE_CSS.

// Append-only block of `@font-face` rules (base64 data URIs). Empty
// until brand-font assets are added.
export const FONT_FACE_CSS = "";

// Geometric-sans stack approximating the reference decks' typography.
// Falls through to fonts reliably present in the Gotenberg/Chromium
// container, then generic sans-serif.
export const DECK_FONT_STACK =
  '"Helvetica Neue", "Helvetica", "Arial", "Liberation Sans", sans-serif';
