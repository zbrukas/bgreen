import { InviteMemberForm } from "@/app/_components/InviteMemberForm";
import { fetchMe } from "@/lib/api-client";
import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default async function NewInvitePage({ params }: PageProps) {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const { orgId } = await params;
  const me = await fetchMe();

  if (!me || me.activeOrganizationId !== orgId || me.activeOrganizationRole !== "admin") {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-8">
        <p>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar
          </Link>
        </p>
        <p>Apenas administradores da organização ativa podem convidar membros.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <p>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar
        </Link>
      </p>
      <InviteMemberForm organizationId={orgId} />
    </main>
  );
}
