import { EmptyState } from "@bgreen/ui";
import { PageHeader } from "@bgreen/ui";
import { getActiveOrgId } from "@/lib/active-org";
import { listProfiles } from "@/lib/economic-profile-actions";
import type { OrganizationEconomicProfile } from "@/lib/economic-profile-types";
import { Building, DocumentBlank, Upload } from "@carbon/icons-react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { ProfileActions } from "./_components/ProfileActions";
import { ProfileTable } from "./_components/ProfileTable";

export const dynamic = "force-dynamic";

export default async function EconomicProfilePage() {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const activeOrgId = await getActiveOrgId();
  if (!activeOrgId) redirect("/");

  const profiles = await listProfiles().catch(() => [] as OrganizationEconomicProfile[]);

  return (
    <>
      <PageHeader
        title="Perfil económico"
        description="Dados económicos por exercício. Carregue um IES para extrair automaticamente, ou introduza os valores manualmente."
        icon={Building}
        actions={<ProfileActions />}
      />
      <div className="space-y-6 px-8 py-6">
        {profiles.length === 0 ? (
          <EmptyState
            title="Sem dados económicos ainda"
            description="Carregue o seu IES para desbloquear recomendações e comparações setoriais."
            primaryAction={{ label: "Carregar IES", href: "/economic-profile/ies/new" }}
            primaryIcon={Upload}
            secondaryAction={{
              label: "Entrada manual",
              href: "/economic-profile/manual",
            }}
            secondaryIcon={DocumentBlank}
          />
        ) : (
          <ProfileTable profiles={profiles} />
        )}
      </div>
    </>
  );
}
