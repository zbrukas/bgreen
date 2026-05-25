// Shared page layout for all three report templates. Header carries
// the org name + period; the AI banner mirrors V9/V10's pt-PT
// disclosure language. The footer line prints the generation
// timestamp + tamper-evidence hash. Brand color (when present)
// drives accent borders + title color; logo URL/key (when present)
// will be resolved upstream by apps/api into a signed URL the
// browser/Gotenberg can fetch — V11.2 ships with logo support but
// the upload flow lands in V11.4.

import type { ReactNode } from "react";
import type { Commentary, Footer, Period } from "../types.js";
import { brandTheme } from "./brand.js";

interface ReportLayoutProps {
  organizationName: string;
  reportTitle: string;
  period: Period;
  footer: Footer;
  commentary: Commentary;
  brandPrimaryColor: string | null;
  logoUrl: string | null;
  children: ReactNode;
}

export function ReportLayout({
  organizationName,
  reportTitle,
  period,
  footer,
  commentary,
  brandPrimaryColor,
  logoUrl,
  children,
}: ReportLayoutProps) {
  const theme = brandTheme(brandPrimaryColor);
  return (
    <div className="report">
      <Cover
        organizationName={organizationName}
        reportTitle={reportTitle}
        period={period}
        logoUrl={logoUrl}
        accent={theme.accent}
      />

      {commentary !== null ? (
        <CommentarySection commentary={commentary} accent={theme.accent} />
      ) : null}

      <main className="content">{children}</main>

      <FooterStrip footer={footer} />
    </div>
  );
}

function Cover({
  organizationName,
  reportTitle,
  period,
  logoUrl,
  accent,
}: {
  organizationName: string;
  reportTitle: string;
  period: Period;
  logoUrl: string | null;
  accent: string;
}) {
  return (
    <section className="cover" style={{ borderTopColor: accent }}>
      <div className="cover-row">
        {logoUrl ? (
          // Inline image; Gotenberg follows http(s) URLs in the
          // rendered HTML so logos hosted on the bGreen S3 bucket
          // resolve at render time.
          <img className="logo" src={logoUrl} alt={`${organizationName} logo`} />
        ) : (
          <span className="logo-fallback">bGreen</span>
        )}
      </div>
      <h1 className="title" style={{ color: accent }}>
        {reportTitle}
      </h1>
      <p className="org">{organizationName}</p>
      <p className="period">
        Período: {formatDate(period.start)} a {formatDate(period.end)}
      </p>
      <p className="ai-disclosure">
        Comentário gerado por IA com base nos dados submetidos. Valide com o seu
        consultor.
      </p>
    </section>
  );
}

function CommentarySection({
  commentary,
  accent,
}: {
  commentary: NonNullable<Commentary>;
  accent: string;
}) {
  return (
    <section className="commentary">
      <h2>Resumo executivo</h2>
      {commentary.sections.map((s, i) => (
        <article key={i} className="commentary-section">
          <h3 style={{ color: accent }}>{s.title}</h3>
          <p>{s.narrative}</p>
          {s.callouts.length > 0 ? (
            <ul className="callouts" style={{ borderLeftColor: accent }}>
              {s.callouts.map((c, j) => (
                <li key={j}>{c}</li>
              ))}
            </ul>
          ) : null}
        </article>
      ))}
    </section>
  );
}

function FooterStrip({ footer }: { footer: Footer }) {
  const generated = formatDateTime(footer.generatedAt);
  // Hash is long — break in the middle for readable wrapping in print.
  const hash = footer.inputDataHash;
  return (
    <footer className="report-footer">
      <p>
        Gerado a {generated}. Hash de integridade: <code>{hash}</code>
      </p>
    </footer>
  );
}

function formatDate(iso: string): string {
  // pt-PT compact: yyyy-mm-dd → dd/mm/yyyy.
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  // Avoid Intl in SSR — keep the output deterministic across
  // environments by formatting by hand.
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    ` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
  );
}
