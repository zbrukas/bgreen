import { PageHeader } from "@/components/shell/PageHeader";
import { getActiveOrgId } from "@/lib/active-org";
import { DocumentBlank } from "@carbon/icons-react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { ManualEntryForm } from "./ManualEntryForm";

export const dynamic = "force-dynamic";

export default async function ManualEntryPage() {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const activeOrgId = await getActiveOrgId();
  if (!activeOrgId) redirect("/");

  return (
    <>
      <PageHeader
        title="Perfil económico — manual"
        description="Alternativa ao IES quando prefere introduzir os valores diretamente."
        icon={DocumentBlank}
        breadcrumbs={[
          { label: "Perfil económico", href: "/economic-profile" },
          { label: "Manual" },
        ]}
      />
      <div className="mx-auto max-w-2xl px-8 py-6">
        <ManualEntryForm />
      </div>
    </>
  );
}
