import {
  type BenchmarkComparison,
  DIMENSAO_LABEL,
  isBenchmarkInsufficientData,
} from "@/lib/economic-profile-types";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  Tile,
} from "@carbon/react";
import Link from "next/link";
import { formatMoney, formatMoneyDelta, formatRatio, formatRatioDelta } from "./format";
import { REASON_COPY } from "./reason-copy";

export function BenchmarkBody({ comparison }: { comparison: BenchmarkComparison }) {
  const { profile, aggregate, deltas } = comparison;
  const dimensaoLabel = profile.dimensao ? DIMENSAO_LABEL[profile.dimensao] : null;

  if (isBenchmarkInsufficientData(aggregate)) {
    const copy = REASON_COPY[aggregate.reason];
    return (
      <Tile>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
          Comparação indisponível
        </h2>
        <p className="mt-1 text-sm text-neutral-700">{copy(aggregate.cae3, dimensaoLabel)}</p>
        <p className="mt-3 text-sm text-neutral-600">
          Caso o CAE ou a dimensão estejam por confirmar, atualize-os no perfil económico e volte a
          esta página.
        </p>
        <p className="mt-2 text-sm">
          <Link
            href="/economic-profile"
            className="text-[var(--cds-link-primary)] hover:underline"
          >
            Ir para o perfil económico
          </Link>
        </p>
      </Tile>
    );
  }

  return (
    <>
      <TableContainer
        title={`CAE-3 ${aggregate.cae3} · ${DIMENSAO_LABEL[aggregate.dimensao]}`}
        description={
          <>
            Comparação baseada em dados de {aggregate.vintageYear}, n={aggregate.nCompanies}{" "}
            empresas{" "}
            <Tag type="cool-gray" size="sm">
              {aggregate.fonte}
            </Tag>
          </>
        }
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Métrica</TableHeader>
              <TableHeader>A sua empresa</TableHeader>
              <TableHeader>Mediana setorial</TableHeader>
              <TableHeader>Δ</TableHeader>
            </TableRow>
          </TableHead>
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
      </TableContainer>

      <p className="mt-3 text-xs text-neutral-600">
        Nota: os valores são placeholder para demonstração — substituir-se-ão pelos agregados
        oficiais de BdP/INE numa fase posterior.
      </p>
    </>
  );
}
