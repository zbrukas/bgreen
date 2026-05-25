import { EmptyState } from "@bgreen/ui";
import { PageHeader } from "@bgreen/ui";
import { getActiveOrgId } from "@/lib/active-org";
import {
  getBenchmarkComparison,
  listProfiles,
} from "@/lib/economic-profile-actions";
import type { BenchmarkComparison } from "@/lib/economic-profile-types";
import { type TemplateScoreHistory, getScores } from "@/lib/scores-actions";
import { Dashboard, Upload, Document } from "@carbon/icons-react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { PeerRankCard } from "./_components/PeerRankCard";
import { RecommendationsCta } from "./_components/RecommendationsCta";
import { ScoreCard } from "./_components/ScoreCard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const activeOrgId = await getActiveOrgId();
  if (!activeOrgId) redirect("/");

  // Fetch in parallel — both surfaces are independent and either may be
  // empty for a fresh org.
  const [scoresResult, profiles] = await Promise.all([
    getScores().catch(() => [] as TemplateScoreHistory[]),
    listProfiles().catch(() => []),
  ]);

  // Latest profile + that year's benchmark (V7.2 surface) — gives the
  // peer-rank card. profiles is desc-by-year from listProfiles.
  const latestProfile = profiles[0] ?? null;
  let benchmark: BenchmarkComparison | null = null;
  if (latestProfile) {
    benchmark = await getBenchmarkComparison(latestProfile.year).catch(() => null);
  }

  const hasContent = scoresResult.length > 0 || benchmark !== null;
  // INCOMPLETE-mode preliminary CTA shows when the org has no profile +
  // no score data yet. Anything else gets the standard CTA.
  const recommendationsMode: "preliminary" | "full" =
    latestProfile === null && scoresResult.length === 0 ? "preliminary" : "full";

  return (
    <>
      <PageHeader
        title="Painel"
        description="Resumo dos seus indicadores ESG e desempenho frente a pares do setor."
        icon={Dashboard}
      />
      <div className="space-y-6 px-8 py-6">
        {!hasContent ? (
          <EmptyState
            title="Comece por aqui"
            description="Submeta um registo ESG ou carregue um IES para começar a ver indicadores e tendências."
            primaryAction={{ label: "Novo registo", href: "/records/new", icon: Document }}
            secondaryAction={{ label: "Carregar IES", href: "/economic-profile/ies/new", icon: Upload }}
          />
        ) : null}

        {scoresResult.length > 0 ? (
          <section>
            <h2
              className="mb-3"
              style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}
            >
              Modelos ESG
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {scoresResult.map((history) => (
                <ScoreCard key={history.templateId} history={history} />
              ))}
            </div>
          </section>
        ) : null}

        {benchmark !== null ? <PeerRankCard comparison={benchmark} /> : null}

        <RecommendationsCta mode={recommendationsMode} />
      </div>
    </>
  );
}
