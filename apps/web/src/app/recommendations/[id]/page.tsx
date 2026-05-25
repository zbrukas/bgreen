import { PageHeader } from "@bgreen/ui";
import { getActiveOrgId } from "@/lib/active-org";
import { fetchMe } from "@/lib/api-client";
import { Recommend } from "@carbon/icons-react";
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
      <PageHeader
        title="Recomendações"
        description="Acompanhe a geração e dê feedback em cada item."
        icon={Recommend}
        breadcrumbs={[
          { label: "Recomendações", href: "/recommendations" },
          { label: id.slice(0, 8) },
        ]}
      />
      <div className="mx-auto max-w-3xl px-8 py-6">
        <RecommendationsRunView generationId={id} currentUserId={me.id} />
      </div>
    </>
  );
}
