import { Header } from "@/app/_components/Header/Header";
import { Alert } from "@/components/ui/alert";
import { getActiveOrgId } from "@/lib/active-org";
import { fetchMe, fetchMyOrganizations } from "@/lib/api-client";
import { getBenchmarkComparison } from "@/lib/economic-profile-actions";
import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
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

  const [me, orgs, activeOrgId] = await Promise.all([
    fetchMe(),
    fetchMyOrganizations(),
    getActiveOrgId(),
  ]);
  if (!activeOrgId) redirect("/");

  const comparison = await getBenchmarkComparison(year).catch(() => null);

  return (
    <>
      <Header
        userEmail={auth.user.email}
        organizations={orgs}
        activeOrganizationId={activeOrgId}
        activeOrganizationRole={me?.activeOrganizationRole ?? null}
      />
      <main className="mx-auto max-w-3xl space-y-6 p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Comparação setorial — {year}
            </h1>
            <p className="text-sm text-muted-foreground">
              O seu desempenho frente à mediana das empresas do mesmo CAE-3 e dimensão.
            </p>
          </div>
          <Link
            href="/economic-profile"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            ← Perfil económico
          </Link>
        </div>

        {comparison === null ? (
          <Alert variant="destructive">
            Não foi possível encontrar um perfil económico para {year}.
          </Alert>
        ) : (
          <BenchmarkBody comparison={comparison} />
        )}
      </main>
    </>
  );
}
