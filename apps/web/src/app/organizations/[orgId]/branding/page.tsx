// V11.4 — org branding settings. Org admins land here to upload a
// logo + pick a brand primary color. Non-admins get redirected back
// to /reports (the API rejects writes anyway, but mirroring at the
// page boundary keeps the surface clean).

import { PageHeader } from "@bgreen/ui";
import { getActiveOrgId } from "@/lib/active-org";
import { fetchActiveOrganization, fetchMe } from "@/lib/api-client";
import { ColorPalette } from "@carbon/icons-react";
import { InlineNotification } from "@carbon/react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { BrandingForm } from "./_components/BrandingForm";

export const dynamic = "force-dynamic";

export default async function BrandingSettingsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const [me, activeOrgId, activeOrgFull] = await Promise.all([
    fetchMe(),
    getActiveOrgId(),
    // Pulls the full row so we can seed the form with the current
    // logo key + primary color.
    fetchActiveOrganization(orgId),
  ]);
  if (!activeOrgId || !me) redirect("/");
  if (activeOrgId !== orgId) redirect("/");
  if (me.activeOrganizationRole !== "org_admin") redirect("/reports");

  return (
    <>
      <PageHeader
        title="Identidade visual"
        description={`Logótipo e cor primária de ${activeOrgFull?.name ?? "organização"}. Surgem na capa e nos cabeçalhos dos relatórios PDF.`}
        icon={ColorPalette}
        breadcrumbs={[
          { label: "Membros", href: `/organizations/${orgId}/members` },
          { label: "Identidade visual" },
        ]}
      />
      <div className="mx-auto max-w-2xl space-y-8 px-8 py-8">
        <InlineNotification
          kind="info"
          title="Só afecta relatórios futuros"
          subtitle="O logótipo e a cor afectam apenas os relatórios gerados a partir de agora."
          lowContrast
          hideCloseButton
        />
        <BrandingForm
          organizationId={orgId}
          initialLogoKey={activeOrgFull?.logoUrl ?? null}
          initialPrimaryColor={activeOrgFull?.brandPrimaryColor ?? null}
        />
      </div>
    </>
  );
}
