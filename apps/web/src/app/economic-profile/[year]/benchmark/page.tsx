import { Header } from "@/app/_components/Header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getActiveOrgId } from "@/lib/active-org";
import { fetchMe, fetchMyOrganizations } from "@/lib/api-client";
import { getBenchmarkComparison } from "@/lib/economic-profile-actions";
import {
  type BenchmarkComparison,
  DIMENSAO_LABEL,
  isBenchmarkInsufficientData,
} from "@/lib/economic-profile-types";
import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// pt-PT money + percent formatters.
const EUR = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const PCT = new Intl.NumberFormat("pt-PT", {
  style: "percent",
  maximumFractionDigits: 1,
});

function formatMoney(value: number | null): string {
  if (value === null) return "—";
  return EUR.format(value);
}

function formatRatio(value: number | null): string {
  if (value === null) return "—";
  return PCT.format(value);
}

function formatMoneyDelta(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${EUR.format(value)}`;
}

function formatRatioDelta(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${PCT.format(value)}`;
}

// pt-PT message per InsufficientData reason. Closures so we can
// interpolate the structured context (cae3, dimensao label) without
// the call site doing it.
type InsufficientReason =
  | "no_aggregate_for_cae3_and_dimensao"
  | "no_aggregate_in_year_window"
  | "missing_cae"
  | "missing_dimensao";

const REASON_COPY: Record<
  InsufficientReason,
  (cae3: string | null, dimensaoLabel: string | null) => string
> = {
  no_aggregate_in_year_window: (cae3, dimensaoLabel) =>
    `Dados setoriais insuficientes para CAE-3 = ${cae3 ?? "(em falta)"} em empresas ${dimensaoLabel ?? "(dimensão não confirmada)"}.`,
  no_aggregate_for_cae3_and_dimensao: (cae3, dimensaoLabel) =>
    `Dados setoriais insuficientes para CAE-3 = ${cae3 ?? "(em falta)"} em empresas ${dimensaoLabel ?? "(dimensão não confirmada)"}.`,
  missing_cae: () =>
    "É necessário um CAE no perfil económico para comparar com pares do setor.",
  missing_dimensao: () =>
    "É necessário confirmar a dimensão para comparar com pares do setor.",
};

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

function BenchmarkBody({ comparison }: { comparison: BenchmarkComparison }) {
  const { profile, aggregate, deltas } = comparison;
  const dimensaoLabel = profile.dimensao ? DIMENSAO_LABEL[profile.dimensao] : null;

  if (isBenchmarkInsufficientData(aggregate)) {
    const copy = REASON_COPY[aggregate.reason];
    return (
      <Card>
        <CardHeader>
          <CardTitle>Comparação indisponível</CardTitle>
          <CardDescription>{copy(aggregate.cae3, dimensaoLabel)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Caso o CAE ou a dimensão estejam por confirmar, atualize-os no perfil económico e
            volte a esta página.
          </p>
          <Link href="/economic-profile" className="text-sm underline">
            Ir para o perfil económico
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            CAE-3 {aggregate.cae3} · {DIMENSAO_LABEL[aggregate.dimensao]}
          </CardTitle>
          <CardDescription>
            Comparação baseada em dados de {aggregate.vintageYear}, n={aggregate.nCompanies}{" "}
            empresas{" "}
            <Badge variant="outline" className="ml-1">
              {aggregate.fonte}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Métrica</TableHead>
                <TableHead>A sua empresa</TableHead>
                <TableHead>Mediana setorial</TableHead>
                <TableHead>Δ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Volume de negócios</TableCell>
                <TableCell>{formatMoney(profile.turnover)}</TableCell>
                <TableCell>{formatMoney(aggregate.medianTurnover)}</TableCell>
                <TableCell>{formatMoneyDelta(deltas.turnoverVsMedian)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Margem EBITDA</TableCell>
                <TableCell>{formatRatio(profile.ebitdaMargin)}</TableCell>
                <TableCell>{formatRatio(aggregate.medianEbitdaMargin)}</TableCell>
                <TableCell>{formatRatioDelta(deltas.ebitdaMarginVsMedian)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Nota: os valores são placeholder para demonstração — substituir-se-ão pelos agregados
        oficiais de BdP/INE numa fase posterior.
      </p>
    </>
  );
}
