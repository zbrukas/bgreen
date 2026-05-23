import { fetchMe, fetchMembers, fetchTopics } from "@/lib/api-client";
import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
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
      <main className="mx-auto max-w-3xl space-y-4 p-8">
        <p>
          <Link
            href={`/organizations/${orgId}/members`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Voltar
          </Link>
        </p>
        <p>Apenas administradores da organização activa podem editar membros.</p>
      </main>
    );
  }

  const [members, topics] = await Promise.all([fetchMembers(orgId), fetchTopics()]);
  const member = members.find((m) => m.userId === userId);
  if (!member) notFound();

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
        <h1 className="text-2xl font-semibold tracking-tight">{member.user?.email ?? "Membro"}</h1>
        <p className="text-sm text-muted-foreground">
          Ajuste o papel e o âmbito de tópicos. Mudanças aplicam-se imediatamente.
        </p>
      </div>
      <MemberEditForm
        organizationId={orgId}
        userId={userId}
        currentRole={member.role}
        currentScope={member.topicScope}
        topics={topics}
        isSelf={me.id === userId}
      />
    </main>
  );
}
