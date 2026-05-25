import { getActiveOrgId } from "@/lib/active-org";
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
      <main className="mx-auto max-w-3xl space-y-6 p-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Extração de IES</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe o processamento e confirme os dados extraídos.
          </p>
        </div>
        <ExtractionStatusView logId={logId} />
      </main>
    </>
  );
}
