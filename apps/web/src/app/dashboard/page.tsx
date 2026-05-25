import { Header } from "@/app/_components/Header/Header";
import { getActiveOrgId } from "@/lib/active-org";
import { fetchMe, fetchMyOrganizations } from "@/lib/api-client";
import {
  getBenchmarkComparison,
  listProfiles,
} from "@/lib/economic-profile-actions";
import type { BenchmarkComparison } from "@/lib/economic-profile-types";
import { type TemplateScoreHistory, getScores } from "@/lib/scores-actions";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { EmptyState } from "./_components/EmptyState";
import { PeerRankCard } from "./_components/PeerRankCard";
import { RecommendationsCta } from "./_components/RecommendationsCta";
import { ScoreCard } from "./_components/ScoreCard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const [me, orgs, activeOrgId] = await Promise.all([
    fetchMe(),
    fetchMyOrganizations(),
    getActiveOrgId(),
  ]);
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
      <Header
        userEmail={auth.user.email}
        organizations={orgs}
        activeOrganizationId={activeOrgId}
        activeOrganizationRole={me?.activeOrganizationRole ?? null}
      />
      <main className="mx-auto max-w-4xl space-y-6 p-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Painel</h1>
          <p className="text-sm text-muted-foreground">
            Resumo dos seus indicadores ESG e desempenho frente a pares do setor.
          </p>
        </div>

        {!hasContent ? <EmptyState /> : null}

        {scoresResult.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-lg font-medium">Modelos ESG</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {scoresResult.map((history) => (
                <ScoreCard key={history.templateId} history={history} />
              ))}
            </div>
          </section>
        ) : null}

        {benchmark !== null ? <PeerRankCard comparison={benchmark} /> : null}

        <RecommendationsCta mode={recommendationsMode} />
      </main>
    </>
  );
}
