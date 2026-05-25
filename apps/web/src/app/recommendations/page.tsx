import { getActiveOrgId } from "@/lib/active-org";
import { fetchMe } from "@/lib/api-client";
import { getRecommendationsHistory } from "@/lib/recommendations-actions";
import type { HistoryEntry } from "@/lib/recommendations-types";
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
      <main className="mx-auto max-w-4xl space-y-6 p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Recomendações</h1>
            <p className="text-sm text-muted-foreground">
              Gere recomendações ESG accionáveis com base no seu perfil e dê
              feedback em cada item.
            </p>
          </div>
          <GerarButton />
        </div>

        <AiBanner />

        <HistoryTable entries={history} />
      </main>
    </>
  );
}
