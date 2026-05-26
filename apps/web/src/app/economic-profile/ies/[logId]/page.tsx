import { PageHeader } from "@bgreen/ui";
import { getActiveOrgId } from "@/lib/active-org";
import { DocumentPdf } from "@carbon/icons-react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { ExtractionStatusView } from "./ExtractionStatusView";

export const dynamic = "force-dynamic";

export default async function IesExtractionPage({
  params,
}: {
  params: Promise<{ logId: string }>;
}) {
  const { logId } = await params;
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const activeOrgId = await getActiveOrgId();
  if (!activeOrgId) redirect("/");

  return (
    <>
      <PageHeader
        title="Extração de IES"
        description="Acompanhe o processamento e confirme os dados extraídos."
        icon={DocumentPdf}
        breadcrumbs={[
          { label: "Perfil económico", href: "/economic-profile" },
          { label: "Extração" },
        ]}
      />
      <div className="mx-auto max-w-3xl px-8 py-10">
        <ExtractionStatusView logId={logId} />
      </div>
    </>
  );
}
