// V11.4 — reports entry. Server-renders the history table; the
// "Gerar relatório PDF" CTA links to /reports/new where the picker +
// period selector live.

import { buttonVariants } from "@/components/ui/button";
import { getActiveOrgId } from "@/lib/active-org";
import { fetchMe } from "@/lib/api-client";
import { getReportsHistory } from "@/lib/reports-actions";
import type { ReportInstance } from "@/lib/reports-types";
import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AiBanner } from "./_components/AiBanner";
import { HistoryTable } from "./_components/HistoryTable";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const [me, activeOrgId] = await Promise.all([fetchMe(), getActiveOrgId()]);
  if (!activeOrgId || !me) redirect("/");

  // Best-effort fetch — first-time orgs see the empty state.
  const reports = await getReportsHistory().catch(() => [] as ReportInstance[]);

  const isAdmin = me.activeOrganizationRole === "org_admin";

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Gere relatórios ESG em PDF com base no seu perfil + registos.
          </p>
        </div>
        {isAdmin ? (
          <Link href="/reports/new" className={buttonVariants({ size: "sm" })}>
            Gerar relatório PDF
          </Link>
        ) : null}
      </div>

      <AiBanner />

      <HistoryTable reports={reports} />
    </main>
  );
}
