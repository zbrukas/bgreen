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

  // Reject when the URL org doesn't match the user's active org, or when the
  // active membership isn't admin. The api also enforces this; we mirror here
  // for UX.
  if (!me || me.activeOrganizationId !== orgId || me.activeOrganizationRole !== "admin") {
    return (
      <main
        style={{
          padding: "2rem",
          fontFamily: "system-ui, sans-serif",
          maxWidth: 720,
        }}
      >
        <p style={{ marginBottom: "1.5rem" }}>
          <Link href="/">← Voltar</Link>
        </p>
        <p>Apenas administradores da organização ativa podem convidar membros.</p>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
        maxWidth: 720,
      }}
    >
      <p style={{ marginBottom: "1.5rem" }}>
        <Link href="/">← Voltar</Link>
      </p>
      <InviteMemberForm organizationId={orgId} />
    </main>
  );
}
