// V11.4 — org branding settings. Org admins land here to upload a
// logo + pick a brand primary color. Non-admins get redirected back
// to /reports (the API rejects writes anyway, but mirroring at the
// page boundary keeps the surface clean).

import { Alert } from "@/components/ui/alert";
import { getActiveOrgId } from "@/lib/active-org";
import { fetchActiveOrganization, fetchMe } from "@/lib/api-client";
import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
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
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <p>
        <Link
          href={`/organizations/${orgId}/members`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar
        </Link>
      </p>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Identidade visual</h1>
        <p className="text-sm text-muted-foreground">
          Define o logótipo e a cor primária da{" "}
          <strong>{activeOrgFull?.name ?? "organização"}</strong>. Estas opções
          surgem na capa e nos cabeçalhos dos relatórios PDF.
        </p>
      </div>
      <Alert variant="info">
        O logótipo e a cor afetam apenas os relatórios gerados a partir
        de agora.
      </Alert>
      <BrandingForm
        organizationId={orgId}
        initialLogoKey={activeOrgFull?.logoUrl ?? null}
        initialPrimaryColor={activeOrgFull?.brandPrimaryColor ?? null}
      />
    </main>
  );
}
