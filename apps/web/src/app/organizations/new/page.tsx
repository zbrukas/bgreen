import { CreateOrganizationForm } from "@/app/_components/CreateOrganizationForm/CreateOrganizationForm";
import { PageHeader } from "@bgreen/ui";
import { Building } from "@carbon/icons-react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewOrganizationPage() {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  return (
    <>
      <PageHeader
        title="Nova organização"
        description="Adicione uma nova organização ao seu perfil bGreen."
        icon={Building}
        breadcrumbs={[{ label: "Início", href: "/" }, { label: "Nova organização" }]}
      />
      <div className="mx-auto max-w-3xl px-8 py-6">
        <CreateOrganizationForm />
      </div>
    </>
  );
}
