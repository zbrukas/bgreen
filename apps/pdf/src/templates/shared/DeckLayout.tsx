// Landscape "deck" layout primitives for the carbon-footprint report.
// Sibling to ReportLayout (which stays portrait + untouched). Each
// child of <DeckDocument> is a full-page slide; the deck CSS in
// styles.ts gives every `.deck-page` the full landscape page box and
// inserts a page break before each page after the first (so there's no
// trailing blank page).
//
// Pages come in three kinds:
//   - CoverPage      full-bleed brand color, title block + logo
//   - SectionDivider full-bleed brand color, big numbered chapter title
//   - ContentPage    white page: header band + padded content + footer

import type { ReactNode } from "react";
import type { BrandTheme } from "./brand.js";
import type { Footer, Period } from "../types.js";
import { formatDate } from "./format.js";

export function DeckDocument({ children }: { children: ReactNode }) {
  return <div className="report deck">{children}</div>;
}

export function CoverPage({
  title,
  subtitle,
  organizationName,
  period,
  logoUrl,
  theme,
}: {
  title: string;
  subtitle?: string;
  organizationName: string;
  period: Period;
  logoUrl: string | null;
  theme: BrandTheme;
}) {
  return (
    <section className="deck-page deck-cover" style={{ backgroundColor: theme.primary }}>
      <div className="deck-cover-body">
        {logoUrl ? (
          <img className="deck-cover-logo" src={logoUrl} alt={`${organizationName} logo`} />
        ) : (
          <span className="deck-cover-logo-fallback">bGreen</span>
        )}
        <h1 className="deck-cover-title">{title}</h1>
        <p className="deck-cover-org">{organizationName}</p>
        {subtitle ? <p className="deck-cover-subtitle">{subtitle}</p> : null}
        <p className="deck-cover-period">
          {formatDate(period.start)} — {formatDate(period.end)}
        </p>
      </div>
    </section>
  );
}

export function SectionDivider({
  index,
  title,
  theme,
}: {
  index: number;
  title: string;
  theme: BrandTheme;
}) {
  return (
    <section className="deck-page deck-divider" style={{ backgroundColor: theme.primary }}>
      <div className="deck-divider-body">
        <span className="deck-divider-index" style={{ color: theme.primary }}>
          {String(index).padStart(2, "0")}
        </span>
        <h2 className="deck-divider-title">{title}</h2>
      </div>
    </section>
  );
}

export function ContentPage({
  title,
  theme,
  logoUrl,
  organizationName,
  footer,
  children,
}: {
  title: string;
  theme: BrandTheme;
  logoUrl: string | null;
  organizationName: string;
  footer: Footer;
  children: ReactNode;
}) {
  return (
    <section className="deck-page deck-content">
      <header className="deck-content-header">
        <h2 className="deck-content-title" style={{ color: theme.primary }}>
          {title}
        </h2>
        {logoUrl ? (
          <img className="deck-content-logo" src={logoUrl} alt={`${organizationName} logo`} />
        ) : null}
      </header>
      <div className="deck-content-body">{children}</div>
      <DeckFooter footer={footer} />
    </section>
  );
}

function DeckFooter({ footer }: { footer: Footer }) {
  return (
    <footer className="deck-footer">
      <span>Gerado a {formatDateTime(footer.generatedAt)}</span>
      <span className="deck-footer-hash">
        Hash: <code>{footer.inputDataHash.slice(0, 16)}…</code>
      </span>
    </footer>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    ` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
  );
}
