import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveOrgId } from "@/lib/active-org";
import { getTrendData } from "@/lib/economic-profile-actions";
import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TrendChart } from "./TrendChart";
import { YearList } from "./_components/YearList";

export const dynamic = "force-dynamic";

export default async function TrendPage() {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const activeOrgId = await getActiveOrgId();
  if (!activeOrgId) redirect("/");

  const trend = await getTrendData().catch(() => ({ years: [] }));
  const years = trend.years;

  // Vintage + n surfaced from whichever year has peer data (most often
  // every row, but be defensive about partial overlays).
  const peerSample = years.find((r) => r.peerVintageYear !== null);

  return (
    <>
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
