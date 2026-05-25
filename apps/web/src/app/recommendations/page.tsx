import { PageHeader } from "@/components/shell/PageHeader";
import { getActiveOrgId } from "@/lib/active-org";
import { fetchMe } from "@/lib/api-client";
import { getRecommendationsHistory } from "@/lib/recommendations-actions";
import type { HistoryEntry } from "@/lib/recommendations-types";
import { Recommend } from "@carbon/icons-react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { AiBanner } from "./_components/AiBanner";
import { GerarButton } from "./_components/GerarButton";
import { HistoryTable } from "./_components/HistoryTable";

export const dynamic = "force-dynamic";

export default async function RecommendationsPage() {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const [me, activeOrgId] = await Promise.all([fetchMe(), getActiveOrgId()]);
  if (!activeOrgId || !me) redirect("/");

  // History is best-effort — first-time orgs see an empty state, not an
  // error banner. A real failure surfaces in the GerarButton flow on
  // the next click.
  const history = await getRecommendationsHistory().catch(() => [] as HistoryEntry[]);

  return (
    <>
      <PageHeader
        title="Recomendações"
        description="Gere recomendações ESG accionáveis com base no seu perfil e dê feedback em cada item."
        icon={Recommend}
        actions={<GerarButton />}
      />
      <div className="space-y-6 px-8 py-6">
        <AiBanner />
        <HistoryTable entries={history} />
      </div>
    </>
  );
}
