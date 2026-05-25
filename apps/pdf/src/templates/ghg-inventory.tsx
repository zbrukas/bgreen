// GHG Protocol inventory report — Scope 1 + Scope 2 (location vs
// market) + Scope 3 (subset of categories) + optional intensity
// metrics. Status pills aren't relevant here (every row is a
// measured emission); the visual treatment is a flat numeric table
// per scope.

import { ReportLayout } from "./shared/ReportLayout.js";
import type { GhgInventoryData } from "./types.js";

interface GhgInventoryTemplateProps {
  data: GhgInventoryData;
  brandingName: string;
  brandPrimaryColor: string | null;
  logoUrl: string | null;
}

export function GhgInventoryTemplate({
  data,
  brandingName,
  brandPrimaryColor,
  logoUrl,
}: GhgInventoryTemplateProps) {
  return (
    <ReportLayout
      organizationName={brandingName}
      reportTitle="Inventário de Emissões GEE"
      period={data.period}
      footer={data.footer}
      commentary={data.commentary}
      brandPrimaryColor={brandPrimaryColor}
      logoUrl={logoUrl}
    >
      <ScopeSection
        title="Âmbito 1 — Emissões diretas"
        total={data.scope1.total}
        rows={data.scope1.rows}
      />

      <section className="scope">
        <h3>Âmbito 2 — Emissões indiretas (energia adquirida)</h3>
        <p className="scope-total">
          Location-based: <strong>{formatTco2e(data.scope2.locationTotal)}</strong>
          {data.scope2.marketTotal !== null ? (
            <>
              {" · "}Market-based: <strong>{formatTco2e(data.scope2.marketTotal)}</strong>
            </>
          ) : null}
        </p>
        <BreakdownTable rows={data.scope2.rows} />
      </section>

      <section className="scope">
        <h3>Âmbito 3 — Emissões indiretas (cadeia de valor)</h3>
        {data.scope3.total !== null ? (
          <p className="scope-total">
            Total: <strong>{formatTco2e(data.scope3.total)}</strong>
          </p>
        ) : (
          <p className="scope-total muted">
            Total não reportado (cálculo de Âmbito 3 em curso).
          </p>
        )}
        <BreakdownTable rows={data.scope3.rows} />
      </section>

      {data.intensity !== null ? (
        <section className="intensity">
          <h3>Intensidade de emissões</h3>
          <ul>
            {data.intensity.perRevenue !== null ? (
              <li>
                Por receita:{" "}
                <strong>{formatNumber(data.intensity.perRevenue, 2)}</strong>{" "}
                tCO2e / € milhão
              </li>
            ) : null}
            {data.intensity.perFte !== null ? (
              <li>
                Por colaborador (FTE):{" "}
                <strong>{formatNumber(data.intensity.perFte, 2)}</strong> tCO2e / FTE
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </ReportLayout>
  );
}

function ScopeSection({
  title,
  total,
  rows,
}: {
  title: string;
  total: number;
  rows: GhgInventoryData["scope1"]["rows"];
}) {
  return (
    <section className="scope">
      <h3>{title}</h3>
      <p className="scope-total">
        Total: <strong>{formatTco2e(total)}</strong>
      </p>
      <BreakdownTable rows={rows} />
    </section>
  );
}

function BreakdownTable({
  rows,
}: {
  rows: GhgInventoryData["scope1"]["rows"];
}) {
  if (rows.length === 0) {
    return <p className="muted">Sem desagregação reportada.</p>;
  }
  return (
    <table className="breakdown">
      <thead>
        <tr>
          <th>Categoria</th>
          <th>Notas</th>
          <th className="num">tCO2e</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{r.category}</td>
            <td className="muted">{r.note ?? ""}</td>
            <td className="num">{formatTco2e(r.tco2e)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatTco2e(value: number): string {
  return `${formatNumber(value, 1)} tCO2e`;
}

function formatNumber(value: number, decimals: number): string {
  // pt-PT uses comma as decimal separator + period as thousands.
  // Hand-formatted to avoid Intl variability across Node versions.
  const fixed = value.toFixed(decimals);
  const [int, frac] = fixed.split(".");
  const intWithThousands = (int ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return frac !== undefined ? `${intWithThousands},${frac}` : intWithThousands;
}
