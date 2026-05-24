import { Header } from "@/app/_components/Header";
import { getActiveOrgId } from "@/lib/active-org";
import { fetchMe, fetchMyOrganizations } from "@/lib/api-client";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { ManualEntryForm } from "./ManualEntryForm";

export const dynamic = "force-dynamic";

export default async function ManualEntryPage() {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const [me, orgs, activeOrgId] = await Promise.all([
    fetchMe(),
    fetchMyOrganizations(),
    getActiveOrgId(),
  ]);
  if (!activeOrgId) redirect("/");

  return (
    <>
      <Header
        userEmail={auth.user.email}
        organizations={orgs}
        activeOrganizationId={activeOrgId}
        activeOrganizationRole={me?.activeOrganizationRole ?? null}
      />
      <main className="mx-auto max-w-2xl space-y-6 p-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Perfil económico — manual</h1>
          <p className="text-sm text-muted-foreground">
            Alternativa ao IES quando prefere introduzir os valores diretamente.
          </p>
        </div>
        <ManualEntryForm />
      </main>
    </>
  );
}
