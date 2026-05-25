import { PageHeader } from "@/components/shell/PageHeader";
import { fetchMe, fetchTopics } from "@/lib/api-client";
import { Add, UserMultiple } from "@carbon/icons-react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { InviteMemberForm } from "./_components/InviteMemberForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default async function NewInvitePage({ params }: PageProps) {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const { orgId } = await params;
  const me = await fetchMe();

  if (!me || me.activeOrganizationId !== orgId || me.activeOrganizationRole !== "org_admin") {
    return (
      <PageHeader
        title="Acesso restrito"
        description="Apenas administradores da organização activa podem convidar membros."
        icon={UserMultiple}
      />
    );
  }

  const topics = await fetchTopics();

  return (
    <>
      <PageHeader
        title="Convidar membro"
        description="Envie um convite por email com o papel e o âmbito de tópicos desejado."
        icon={Add}
        breadcrumbs={[
          { label: "Membros", href: `/organizations/${orgId}/members` },
          { label: "Convidar" },
        ]}
      />
      <div className="mx-auto max-w-3xl px-8 py-6">
        <InviteMemberForm organizationId={orgId} topics={topics} />
      </div>
    </>
  );
}
