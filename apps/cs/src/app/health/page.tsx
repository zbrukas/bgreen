import { EmptyState, PageHeader } from "@bgreen/ui";
import { ChartLineSmooth } from "@carbon/icons-react";
import { redirect } from "next/navigation";
import { fetchCsHealth, fetchMe } from "@/lib/api-client";
import { HealthDashboard } from "./HealthDashboard";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const me = await fetchMe();
  if (!me) redirect("/login");
  if (me.userType !== "central_services") redirect("/");

  const entries = await fetchCsHealth({});

  return (
    <>
      <PageHeader
        title="Indicadores das organizações"
        description="KPIs compostos de Customer Success — cobertura, engagement, login, ativação e tendência de score."
        icon={ChartLineSmooth}
      />
      <div className="mx-auto max-w-7xl space-y-8 px-8 py-10">
        {entries.length === 0 ? (
          <EmptyState
            title="Sem organizações para mostrar"
            description="Quando organizações forem criadas e a snapshot diária correr, aparecerão aqui."
          />
        ) : (
          <HealthDashboard entries={entries} />
        )}
      </div>
    </>
  );
}
