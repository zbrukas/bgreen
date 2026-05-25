// ESRS E1 disclosure report. The body is a coverage matrix: one row
// per datapoint with status pill + value summary. The cover carries
// counts from V10's CoverageCalculator (covered / partial / missing).

import { ReportLayout } from "./shared/ReportLayout.js";
import type { EsrsE1Data } from "./types.js";

interface EsrsE1TemplateProps {
  data: EsrsE1Data;
  brandingName: string;
  brandPrimaryColor: string | null;
  logoUrl: string | null;
}

const STATUS_LABEL: Record<"covered" | "partial" | "missing", string> = {
  covered: "Coberto",
  partial: "Parcial",
  missing: "Em falta",
};

const STATUS_BG: Record<"covered" | "partial" | "missing", string> = {
  covered: "#d1fae5",
  partial: "#fef3c7",
  missing: "#fee2e2",
};

const STATUS_FG: Record<"covered" | "partial" | "missing", string> = {
  covered: "#065f46",
  partial: "#92400e",
  missing: "#991b1b",
};

export function EsrsE1Template({
  data,
  brandingName,
  brandPrimaryColor,
  logoUrl,
}: EsrsE1TemplateProps) {
  return (
    <ReportLayout
      organizationName={brandingName}
      reportTitle="ESRS E1 — Divulgação Climática"
      period={data.period}
      footer={data.footer}
      commentary={data.commentary}
      brandPrimaryColor={brandPrimaryColor}
      logoUrl={logoUrl}
    >
      <section className="coverage-summary">
        <h3>Cobertura</h3>
        <ul className="coverage-counts">
          <li>
            <strong>{data.coverage.covered}</strong> cobertos
          </li>
          <li>
            <strong>{data.coverage.partial}</strong> parciais
          </li>
          <li>
            <strong>{data.coverage.missing}</strong> em falta
          </li>
        </ul>
      </section>

      <section className="datapoints">
        <h3>Datapoints</h3>
        <table className="datapoints-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Título</th>
              <th>Valor</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.datapoints.map((dp, i) => (
              <tr key={i}>
                <td className="mono">{dp.code}</td>
                <td>{dp.title}</td>
                <td className="muted">{dp.value ?? "—"}</td>
                <td>
                  <span
                    className="status-pill"
                    style={{
                      background: STATUS_BG[dp.status],
                      color: STATUS_FG[dp.status],
                    }}
                  >
                    {STATUS_LABEL[dp.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </ReportLayout>
  );
}
