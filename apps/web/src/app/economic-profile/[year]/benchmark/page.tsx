import { PageHeader } from "@bgreen/ui";
import { getActiveOrgId } from "@/lib/active-org";
import { getBenchmarkComparison } from "@/lib/economic-profile-actions";
import { ChartBar } from "@carbon/icons-react";
import { InlineNotification } from "@carbon/react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { notFound, redirect } from "next/navigation";
import { BenchmarkBody } from "./_components/BenchmarkBody";

export const dynamic = "force-dynamic";

export default async function BenchmarkPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year: yearParam } = await params;
  const year = Number(yearParam);
  if (!Number.isInteger(year) || year < 1990 || year > 2100) {
    notFound();
  }

  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const activeOrgId = await getActiveOrgId();
  if (!activeOrgId) redirect("/");

  const comparison = await getBenchmarkComparison(year).catch(() => null);

  return (
    <>
      <PageHeader
        title={`Comparação setorial — ${year}`}
        description="O seu desempenho frente à mediana das empresas do mesmo CAE-3 e dimensão."
        icon={ChartBar}
        breadcrumbs={[
          { label: "Perfil económico", href: "/economic-profile" },
          { label: String(year) },
        ]}
      />
      <div className="space-y-8 px-8 py-8">
        {comparison === null ? (
          <InlineNotification
            kind="error"
            title="Sem perfil económico"
            subtitle={`Não foi possível encontrar um perfil económico para ${year}.`}
            lowContrast
            hideCloseButton
          />
        ) : (
          <BenchmarkBody comparison={comparison} />
        )}
      </div>
    </>
  );
}
