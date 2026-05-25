import { getActiveOrgId } from "@/lib/active-org";
import { fetchMe } from "@/lib/api-client";
import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GenerateForm } from "./_components/GenerateForm";

export const dynamic = "force-dynamic";

export default async function GenerateReportPage() {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const [me, activeOrgId] = await Promise.all([fetchMe(), getActiveOrgId()]);
  if (!activeOrgId || !me) redirect("/");

  // Mirror the apps/api `POST /reports` gate at the page boundary so
  // non-admins don't see the form. The route enforces it server-side
  // regardless.
  if (me.activeOrganizationRole !== "org_admin") redirect("/reports");

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <p>
        <Link
          href="/reports"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar
        </Link>
      </p>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Gerar relatório PDF
        </h1>
        <p className="text-sm text-muted-foreground">
          Escolha o modelo, o período, e (para Custom) o título a usar
          na capa.
        </p>
      </div>
      <GenerateForm />
    </main>
  );
}
