import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type BenchmarkComparison,
  DIMENSAO_LABEL,
  isBenchmarkInsufficientData,
} from "@/lib/economic-profile-types";
import Link from "next/link";
import { formatMoney, formatMoneyDelta, formatRatio, formatRatioDelta } from "./format";
import { REASON_COPY } from "./reason-copy";

export function BenchmarkBody({ comparison }: { comparison: BenchmarkComparison }) {
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
