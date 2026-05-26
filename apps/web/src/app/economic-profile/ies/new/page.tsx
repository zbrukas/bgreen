import { PageHeader } from "@bgreen/ui";
import { getActiveOrgId } from "@/lib/active-org";
import { Upload } from "@carbon/icons-react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { UploadIesForm } from "./UploadIesForm";

export const dynamic = "force-dynamic";

export default async function NewIesUploadPage() {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const activeOrgId = await getActiveOrgId();
  if (!activeOrgId) redirect("/");

  return (
    <>
      <PageHeader
        title="Carregar IES"
        description="Carregue um IES (Informação Empresarial Simplificada) e a IA extrai os dados económicos chave do documento."
        icon={Upload}
        breadcrumbs={[
          { label: "Perfil económico", href: "/economic-profile" },
          { label: "Carregar IES" },
        ]}
      />
      <div className="mx-auto max-w-2xl px-8 py-10">
        <UploadIesForm />
      </div>
    </>
  );
}
