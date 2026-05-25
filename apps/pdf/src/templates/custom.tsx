// Custom report — lighter framing, user-selected rows. apps/api
// formats values upstream (numbers, strings, dates) so this template
// renders them verbatim.

import { ReportLayout } from "./shared/ReportLayout.js";
import type { CustomData } from "./types.js";

interface CustomTemplateProps {
  data: CustomData;
  brandingName: string;
  brandPrimaryColor: string | null;
  logoUrl: string | null;
}

export function CustomTemplate({
  data,
  brandingName,
  brandPrimaryColor,
  logoUrl,
}: CustomTemplateProps) {
  return (
    <ReportLayout
      organizationName={brandingName}
      reportTitle={data.title}
      period={data.period}
      footer={data.footer}
      commentary={data.commentary}
      brandPrimaryColor={brandPrimaryColor}
      logoUrl={logoUrl}
    >
      <section className="custom-rows">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Indicador</th>
              <th>Valor</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={i}>
                <td>{r.label}</td>
                <td className="num">{r.value}</td>
                <td className="muted">{r.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </ReportLayout>
  );
}
