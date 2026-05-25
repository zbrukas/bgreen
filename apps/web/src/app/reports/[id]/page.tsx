import { PageHeader } from "@/components/shell/PageHeader";
import { getActiveOrgId } from "@/lib/active-org";
import { fetchMe } from "@/lib/api-client";
import { DocumentPdf } from "@carbon/icons-react";
import { withAuth } from "@workos-inc/authkit-nextjs";
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
    <>
      <PageHeader
        title="Relatório"
        description="Acompanhe a geração e descarregue o PDF quando pronto."
        icon={DocumentPdf}
        breadcrumbs={[
          { label: "Relatórios", href: "/reports" },
          { label: id.slice(0, 8) },
        ]}
      />
      <div className="mx-auto max-w-3xl px-8 py-6">
        <ReportRunView reportId={id} />
      </div>
    </>
  );
}
