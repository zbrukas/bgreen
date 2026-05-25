import { getActiveOrgId } from "@/lib/active-org";
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
      <main className="mx-auto max-w-2xl space-y-6 p-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Carregar IES</h1>
          <p className="text-sm text-muted-foreground">
            Carregue um IES (Informação Empresarial Simplificada) e a IA extrai os dados económicos
            chave do documento.
          </p>
        </div>
        <UploadIesForm />
      </main>
    </>
  );
}
