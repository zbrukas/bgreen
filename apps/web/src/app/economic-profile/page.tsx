import { Header } from "@/app/_components/Header/Header";
import { buttonVariants } from "@/components/ui/button";
import { getActiveOrgId } from "@/lib/active-org";
import { fetchMe, fetchMyOrganizations } from "@/lib/api-client";
import { listProfiles } from "@/lib/economic-profile-actions";
import type { OrganizationEconomicProfile } from "@/lib/economic-profile-types";
import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "./_components/EmptyState";
import { ProfileTable } from "./_components/ProfileTable";

export const dynamic = "force-dynamic";

export default async function EconomicProfilePage() {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const [me, orgs, activeOrgId] = await Promise.all([
    fetchMe(),
    fetchMyOrganizations(),
    getActiveOrgId(),
  ]);
  if (!activeOrgId) redirect("/");

  const profiles = await listProfiles().catch(() => [] as OrganizationEconomicProfile[]);

  return (
    <>
      <Header
        userEmail={auth.user.email}
        organizations={orgs}
        activeOrganizationId={activeOrgId}
        activeOrganizationRole={me?.activeOrganizationRole ?? null}
      />
      <main className="mx-auto max-w-4xl space-y-6 p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Perfil económico</h1>
            <p className="text-sm text-muted-foreground">
              Dados económicos por exercício. Carregue um IES para extrair automaticamente, ou
              introduza os valores manualmente.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/economic-profile/ies/new"
              className={buttonVariants({ size: "sm" })}
            >
              Carregar IES
            </Link>
            <Link
              href="/economic-profile/manual"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              Entrada manual
            </Link>
            <Link
              href="/economic-profile/trend"
              className={buttonVariants({ size: "sm", variant: "ghost" })}
            >
              Tendências
            </Link>
          </div>
        </div>

        {profiles.length === 0 ? <EmptyState /> : <ProfileTable profiles={profiles} />}
      </main>
    </>
  );
}
