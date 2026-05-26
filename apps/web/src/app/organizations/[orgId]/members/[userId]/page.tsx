import { PageHeader } from "@bgreen/ui";
import { fetchMe, fetchMembers, fetchTopics } from "@/lib/api-client";
import { UserAvatar, UserMultiple } from "@carbon/icons-react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { notFound, redirect } from "next/navigation";
import { MemberEditForm } from "./MemberEditForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ orgId: string; userId: string }>;
}

export default async function MemberDetailPage({ params }: PageProps) {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const { orgId, userId } = await params;
  const me = await fetchMe();
  if (!me || me.activeOrganizationId !== orgId || me.activeOrganizationRole !== "org_admin") {
    return (
      <PageHeader
        title="Acesso restrito"
        description="Apenas administradores da organização activa podem editar membros."
        icon={UserMultiple}
        breadcrumbs={[
          { label: "Membros", href: `/organizations/${orgId}/members` },
          { label: "—" },
        ]}
      />
    );
  }

  const [members, topics] = await Promise.all([fetchMembers(orgId), fetchTopics()]);
  const member = members.find((m) => m.userId === userId);
  if (!member) notFound();

  return (
    <>
      <PageHeader
        title={member.user?.email ?? "Membro"}
        description="Ajuste o papel e o âmbito de tópicos. Mudanças aplicam-se imediatamente."
        icon={UserAvatar}
        breadcrumbs={[
          { label: "Membros", href: `/organizations/${orgId}/members` },
          { label: member.user?.email ?? userId.slice(0, 8) },
        ]}
      />
      <div className="mx-auto max-w-2xl px-8 py-10">
        <MemberEditForm
          organizationId={orgId}
          userId={userId}
          currentRole={member.role}
          currentScope={member.topicScope}
          topics={topics}
          isSelf={me.id === userId}
        />
      </div>
    </>
  );
}
