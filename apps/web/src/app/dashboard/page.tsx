import { Header } from "@/app/_components/Header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getActiveOrgId } from "@/lib/active-org";
import { fetchMe, fetchMyOrganizations } from "@/lib/api-client";
import {
  getBenchmarkComparison,
  listProfiles,
} from "@/lib/economic-profile-actions";
import {
  type BenchmarkComparison,
  DIMENSAO_LABEL,
  isBenchmarkInsufficientData,
} from "@/lib/economic-profile-types";
import {
  type RecordScorePoint,
  type TemplateScoreHistory,
  getScores,
} from "@/lib/scores-actions";
import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkline } from "./Sparkline";

export const dynamic = "force-dynamic";

// V8.3 — 6 most recent points feed the sparkline. PRD acceptance
// criterion: "trend sparkline (last 6 entries)".
const SPARKLINE_WINDOW = 6;

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

function tierBadgeVariant(tier: string): "success" | "info" | "warning" | "secondary" {
  // Best-effort match against the PRD example buckets (C/B/A). Custom
  // tier labels fall through to secondary.
  if (tier === "A") return "success";
  if (tier === "B") return "info";
  if (tier === "C") return "warning";
  return "secondary";
}

export default async function DashboardPage() {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const [me, orgs, activeOrgId] = await Promise.all([
    fetchMe(),
    fetchMyOrganizations(),
    getActiveOrgId(),
  ]);
  if (!activeOrgId) redirect("/");

  // Fetch in parallel — both surfaces are independent and either may be
  // empty for a fresh org.
  const [scoresResult, profiles] = await Promise.all([
    getScores().catch(() => [] as TemplateScoreHistory[]),
    listProfiles().catch(() => []),
  ]);

  // Latest profile + that year's benchmark (V7.2 surface) — gives the
  // peer-rank card. profiles is desc-by-year from listProfiles.
  const latestProfile = profiles[0] ?? null;
  let benchmark: BenchmarkComparison | null = null;
  if (latestProfile) {
    benchmark = await getBenchmarkComparison(latestProfile.year).catch(() => null);
  }

  const hasContent = scoresResult.length > 0 || benchmark !== null;

  return (
    <>
      <Header
        userEmail={auth.user.email}
        organizations={orgs}
        activeOrganizationId={activeOrgId}
        activeOrganizationRole={me?.activeOrganizationRole ?? null}
      />
      <main className="mx-auto max-w-4xl space-y-6 p-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Painel</h1>
          <p className="text-sm text-muted-foreground">
            Resumo dos seus indicadores ESG e desempenho frente a pares do setor.
          </p>
        </div>

        {!hasContent ? <EmptyState /> : null}

        {scoresResult.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-lg font-medium">Modelos ESG</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {scoresResult.map((history) => (
                <ScoreCard key={history.templateId} history={history} />
              ))}
            </div>
          </section>
        ) : null}

        {benchmark !== null ? <PeerRankCard comparison={benchmark} /> : null}
      </main>
    </>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comece por aqui</CardTitle>
        <CardDescription>
          Submeta um registo ESG ou carregue um IES para começar a ver indicadores e tendências.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Link href="/records/new" className={buttonVariants({ size: "sm" })}>
          Novo registo
        </Link>
        <Link
          href="/economic-profile/ies/new"
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          Carregar IES
        </Link>
      </CardContent>
    </Card>
  );
}

function ScoreCard({ history }: { history: TemplateScoreHistory }) {
  // Last entry = most recent (scores arrive ascending from the API).
  const latest = history.scores.at(-1);
  if (!latest) return null;

  const recent = history.scores.slice(-SPARKLINE_WINDOW);
  const trendValues = recent.map((p) => p.percent);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{history.templateName}</CardTitle>
        <CardDescription className="flex items-center gap-2">
          <span className="text-2xl font-semibold text-foreground">
            {latest.total.toFixed(0)}
          </span>
          <span className="text-sm text-muted-foreground">/ 100</span>
          <Badge variant={tierBadgeVariant(latest.tier)} className="ml-auto">
            Tier {latest.tier}
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Sparkline values={trendValues} domain={{ min: 0, max: 100 }} />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {recent.length === 1
              ? "1 entrada"
              : `Últimas ${recent.length} de ${history.scores.length}`}
          </span>
          <TrendArrow points={recent} />
        </div>
      </CardContent>
    </Card>
  );
}

function TrendArrow({ points }: { points: RecordScorePoint[] }) {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;
  const delta = last.percent - first.percent;
  if (Math.abs(delta) < 0.5) return <span>tendência →</span>;
  if (delta > 0) return <span className="text-emerald-700">tendência ↑</span>;
  return <span className="text-amber-700">tendência ↓</span>;
}

function PeerRankCard({ comparison }: { comparison: BenchmarkComparison }) {
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

function PeerRow({
  label,
  you,
  peer,
  delta,
  format,
}: {
  label: string;
  you: string;
  peer: string;
  delta: number | null;
  format: (v: number) => string;
}) {
  const sign = delta === null ? "" : delta > 0 ? "+" : "";
  const deltaCopy = delta === null ? "—" : `${sign}${format(delta)}`;
  const deltaTone =
    delta === null
      ? "text-muted-foreground"
      : delta > 0
        ? "text-emerald-700"
        : delta < 0
          ? "text-amber-700"
          : "text-muted-foreground";
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-3 text-sm">
        <span className="font-semibold text-foreground">{you}</span>
        <span className="text-muted-foreground">vs P50 {peer}</span>
        <span className={`ml-auto text-xs ${deltaTone}`}>{deltaCopy}</span>
      </div>
    </div>
  );
}
