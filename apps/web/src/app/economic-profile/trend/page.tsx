import { PageHeader } from "@/components/shell/PageHeader";
import { getActiveOrgId } from "@/lib/active-org";
import { getTrendData } from "@/lib/economic-profile-actions";
import { ChartLineSmooth } from "@carbon/icons-react";
import { Tag, Tile } from "@carbon/react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { TrendChart } from "./TrendChart";
import { YearList } from "./_components/YearList";

export const dynamic = "force-dynamic";

export default async function TrendPage() {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const activeOrgId = await getActiveOrgId();
  if (!activeOrgId) redirect("/");

  const trend = await getTrendData().catch(() => ({ years: [] }));
  const years = trend.years;

  // Vintage + n surfaced from whichever year has peer data (most often
  // every row, but be defensive about partial overlays).
  const peerSample = years.find((r) => r.peerVintageYear !== null);

  return (
    <>
      <PageHeader
        title="Tendências"
        description="Volume de negócios e margem EBITDA ao longo dos exercícios, com a mediana setorial em sobreposição."
        icon={ChartLineSmooth}
        breadcrumbs={[
          { label: "Perfil económico", href: "/economic-profile" },
          { label: "Tendências" },
        ]}
      />
      <div className="space-y-6 px-8 py-6">
        <Tile>
          <div className="flex items-baseline justify-between gap-2">
            <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
              {years.length === 0
                ? "Sem exercícios"
                : years.length === 1
                  ? "1 exercício carregado"
                  : `${years.length} exercícios carregados`}
            </h2>
            {peerSample && (
              <Tag type="cool-gray" size="sm">
                placeholder_v1
              </Tag>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-600">
            {peerSample
              ? `Mediana setorial baseada em dados de ${peerSample.peerVintageYear}, n = ${peerSample.peerNCompanies} empresas.`
              : "Sem mediana setorial disponível para os exercícios atuais."}
          </p>
          <div className="mt-4">
            <TrendChart rows={years} />
          </div>
        </Tile>

        {years.length > 0 ? <YearList rows={years} /> : null}
      </div>
    </>
  );
}
