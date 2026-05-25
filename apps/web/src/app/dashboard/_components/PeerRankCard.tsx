import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type BenchmarkComparison,
  DIMENSAO_LABEL,
  isBenchmarkInsufficientData,
} from "@/lib/economic-profile-types";
import { formatMoney, formatRatio } from "./format";
import { PeerRow } from "./PeerRow";

export function PeerRankCard({ comparison }: { comparison: BenchmarkComparison }) {
  const { profile, aggregate, deltas } = comparison;
  if (isBenchmarkInsufficientData(aggregate)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Comparação setorial — {profile.year}</CardTitle>
          <CardDescription>
            Dados setoriais insuficientes para a sua dimensão / CAE este ano.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="info" className="text-xs">
            Confirme a dimensão e o CAE no perfil económico para desbloquear a comparação.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const dimensaoLabel = profile.dimensao ? DIMENSAO_LABEL[profile.dimensao] : "—";
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparação setorial — {profile.year}</CardTitle>
        <CardDescription>
          CAE-3 {aggregate.cae3} · {dimensaoLabel} · {aggregate.nCompanies} empresas (dados de{" "}
          {aggregate.vintageYear})
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <PeerRow
          label="Volume de negócios"
          you={formatMoney(profile.turnover)}
          peer={formatMoney(aggregate.medianTurnover)}
          delta={deltas.turnoverVsMedian}
          format={(v) => formatMoney(v)}
        />
        <PeerRow
          label="Margem EBITDA"
          you={formatRatio(profile.ebitdaMargin)}
          peer={formatRatio(aggregate.medianEbitdaMargin)}
          delta={deltas.ebitdaMarginVsMedian}
          format={(v) => formatRatio(v)}
        />
      </CardContent>
    </Card>
  );
}
