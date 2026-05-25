import { Header } from "@/app/_components/Header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveOrgId } from "@/lib/active-org";
import { fetchMe, fetchMyOrganizations } from "@/lib/api-client";
import { getTrendData } from "@/lib/economic-profile-actions";
import { DIMENSAO_LABEL } from "@/lib/economic-profile-types";
import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TrendChart } from "./TrendChart";

export const dynamic = "force-dynamic";

export default async function TrendPage() {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const [me, orgs, activeOrgId] = await Promise.all([
    fetchMe(),
    fetchMyOrganizations(),
    getActiveOrgId(),
  ]);
  if (!activeOrgId) redirect("/");

  const trend = await getTrendData().catch(() => ({ years: [] }));
  const years = trend.years;

  // Vintage + n surfaced from whichever year has peer data (most often
  // every row, but be defensive about partial overlays).
  const peerSample = years.find((r) => r.peerVintageYear !== null);

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
            <h1 className="text-3xl font-semibold tracking-tight">Tendências</h1>
            <p className="text-sm text-muted-foreground">
              Volume de negócios e margem EBITDA ao longo dos exercícios, com a mediana setorial
              em sobreposição.
            </p>
          </div>
          <Link
            href="/economic-profile"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            ← Perfil económico
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {years.length === 0
                ? "Sem exercícios"
                : years.length === 1
                  ? `1 exercício carregado`
                  : `${years.length} exercícios carregados`}
            </CardTitle>
            <CardDescription>
              {peerSample ? (
                <>
                  Mediana setorial baseada em dados de {peerSample.peerVintageYear}, n={" "}
                  {peerSample.peerNCompanies} empresas{" "}
                  <Badge variant="outline" className="ml-1">
                    placeholder_v1
                  </Badge>
                </>
              ) : (
                "Sem mediana setorial disponível para os exercícios atuais."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <TrendChart rows={years} />
          </CardContent>
        </Card>

        {years.length > 0 ? <YearList rows={years} /> : null}
      </main>
    </>
  );
}

function YearList({
  rows,
}: {
  rows: Awaited<ReturnType<typeof getTrendData>>["years"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Por exercício</CardTitle>
        <CardDescription>
          Salte para o detalhe de qualquer ano para comparar diretamente com o setor.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <Link
            key={r.year}
            href={`/economic-profile/${r.year}/benchmark`}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
          >
            <span className="font-medium">{r.year}</span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {r.dimensao ? DIMENSAO_LABEL[r.dimensao] : "—"}
              {r.cae3 ? <span>· CAE {r.cae3}</span> : null}
              <span aria-hidden>→</span>
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
