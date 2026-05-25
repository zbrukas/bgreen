import { PageHeader } from "@/components/shell/PageHeader";
import { getActiveOrgId } from "@/lib/active-org";
import { fetchMe } from "@/lib/api-client";
import { Add } from "@carbon/icons-react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { GenerateForm } from "./_components/GenerateForm";

export const dynamic = "force-dynamic";

export default async function GenerateReportPage() {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const [me, activeOrgId] = await Promise.all([fetchMe(), getActiveOrgId()]);
  if (!activeOrgId || !me) redirect("/");

  // Mirror the apps/api `POST /reports` gate at the page boundary so
  // non-admins don't see the form. The route enforces it server-side
  // regardless.
  if (me.activeOrganizationRole !== "org_admin") redirect("/reports");

  return (
    <>
      <PageHeader
        title="Gerar relatório PDF"
        description="Escolha o modelo, o período, e (para Custom) o título a usar na capa."
        icon={Add}
        breadcrumbs={[{ label: "Relatórios", href: "/reports" }, { label: "Novo" }]}
      />
      <div className="mx-auto max-w-2xl px-8 py-6">
        <GenerateForm />
      </div>
    </>
  );
}
