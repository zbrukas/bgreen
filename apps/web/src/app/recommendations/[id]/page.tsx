import { getActiveOrgId } from "@/lib/active-org";
import { fetchMe } from "@/lib/api-client";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { RecommendationsRunView } from "./RecommendationsRunView";

export const dynamic = "force-dynamic";

export default async function RecommendationsRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const [me, activeOrgId] = await Promise.all([fetchMe(), getActiveOrgId()]);
  if (!activeOrgId || !me) redirect("/");

  return (
    <>
      <main className="mx-auto max-w-3xl space-y-6 p-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Recomendações</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe a geração e dê feedback em cada item.
          </p>
        </div>
        <RecommendationsRunView generationId={id} currentUserId={me.id} />
      </main>
    </>
  );
}
