import { getActiveOrgId } from "@/lib/active-org";
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
