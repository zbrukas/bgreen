// V11.4 — reports entry. Server-renders the history table; the
// "Gerar relatório PDF" CTA links to /reports/new where the picker +
// period selector live.

import { PageHeader } from "@bgreen/ui";
import { getActiveOrgId } from "@/lib/active-org";
import { fetchMe } from "@/lib/api-client";
import { getReportsHistory } from "@/lib/reports-actions";
import type { ReportInstance } from "@/lib/reports-types";
import { DocumentPdf } from "@carbon/icons-react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { AiBanner } from "./_components/AiBanner";
import { HistoryTable } from "./_components/HistoryTable";
import { ReportsHeaderActions } from "./_components/ReportsHeaderActions";

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
    <>
      <PageHeader
        title="Relatórios"
        description="Gere relatórios ESG em PDF com base no seu perfil + registos."
        icon={DocumentPdf}
        actions={isAdmin ? <ReportsHeaderActions /> : undefined}
      />
      <div className="space-y-6 px-8 py-6">
        <AiBanner />
        <HistoryTable reports={reports} />
      </div>
    </>
  );
}
