import { getActiveOrgId } from "@/lib/active-org";
import { fetchMe } from "@/lib/api-client";
import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ReportRunView } from "./ReportRunView";

export const dynamic = "force-dynamic";

export default async function ReportRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const [me, activeOrgId] = await Promise.all([fetchMe(), getActiveOrgId()]);
  if (!activeOrgId || !me) redirect("/");

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <p>
        <Link
          href="/reports"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar ao histórico
        </Link>
      </p>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Relatório</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe a geração e descarregue o PDF quando pronto.
        </p>
      </div>
      <ReportRunView reportId={id} />
    </main>
  );
}
