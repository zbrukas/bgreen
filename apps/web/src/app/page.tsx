import { getActiveOrgId } from "@/lib/active-org";
import { fetchHealth, fetchMe, fetchMyOrganizations } from "@/lib/api-client";
import { listProfiles } from "@/lib/economic-profile-actions";
import type { OrganizationEconomicProfile } from "@/lib/economic-profile-types";
import { PageHeader } from "@bgreen/ui";
import {
  Analytics,
  ArrowRight,
  Building,
  ChartLineData,
  CheckmarkFilled,
  DocumentPdf,
  FetchUploadCloud,
  FlowData,
  ReportData,
} from "@carbon/icons-react";
import {
  Button,
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
  Tag,
} from "@carbon/react";
import { getSignInUrl, withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { CreateOrganizationForm } from "./_components/CreateOrganizationForm/CreateOrganizationForm";
import { EconomicProfileCta } from "./_home/EconomicProfileCta";
import { EconomicProfileSummary } from "./_home/EconomicProfileSummary";

export const dynamic = "force-dynamic";

const CS_APP_URL = process.env.CS_APP_PUBLIC_URL ?? "http://localhost:3001";

export default async function Home() {
  const auth = await withAuth();
  const health = await fetchHealth();
  const healthLine = health ? `${health.status} (${health.service})` : "unreachable";

  if (!auth.user) {
    const signInUrl = await getSignInUrl();
    return <LandingPage signInUrl={signInUrl} healthLine={healthLine} healthOk={health !== null} />;
  }

  const [me, orgs] = await Promise.all([fetchMe(), fetchMyOrganizations()]);

  // Population redirect: CS users belong in the CS console, not here.
  if (me?.userType === "central_services") {
    redirect(CS_APP_URL);
  }

  if (orgs.length === 0) {
    return (
      <main className="mx-auto max-w-xl space-y-6 p-8">
        <PageHeader
          title="Bem-vindo ao bGreen"
          description={`Olá ${auth.user.email}. Vamos criar a sua primeira organização.`}
          icon={Building}
        />
        <div className="px-8">
          <CreateOrganizationForm />
        </div>
      </main>
    );
  }

  // Resolve active org. Cookie wins if it points at a current membership.
  // If it is missing/stale, repair it through a route handler because
  // Server Components cannot mutate cookies during render.
  const activeOrgId = await getActiveOrgId();
  if (!activeOrgId || !orgs.some((o) => o.id === activeOrgId)) {
    const first = orgs[0];
    if (first) {
      redirect(`/active-organization?organizationId=${first.id}&returnTo=/`);
    }
  }
  const activeOrg = orgs.find((o) => o.id === activeOrgId) ?? null;

  // Drives the dashboard CTA: empty list → prominent upload prompt;
  // non-empty → compact summary card. Catch network/auth failures
  // silently so a transient API blip doesn't break the homepage.
  const profiles = await listProfiles().catch(() => [] as OrganizationEconomicProfile[]);
  const latestProfile = profiles[0] ?? null;

  return (
    <>
      <PageHeader
        title={activeOrg ? activeOrg.name : "bGreen"}
        description={
          orgs.length === 1
            ? "Pertence a 1 organização."
            : `Pertence a ${orgs.length} organizações.`
        }
        icon={Building}
      />
      <div className="space-y-8 px-8 py-8">
        {latestProfile === null ? (
          <EconomicProfileCta />
        ) : (
          <EconomicProfileSummary profile={latestProfile} count={profiles.length} />
        )}

        <section>
          <h2
            className="mb-3"
            style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}
          >
            Estado do sistema
          </h2>
          <p className="mb-3 text-sm text-neutral-600">
            Diagnóstico rápido das ligações da plataforma.
          </p>
          <StructuredListWrapper>
            <StructuredListHead>
              <StructuredListRow head>
                <StructuredListCell head>Componente</StructuredListCell>
                <StructuredListCell head>Estado</StructuredListCell>
              </StructuredListRow>
            </StructuredListHead>
            <StructuredListBody>
              <StructuredListRow>
                <StructuredListCell>Utilizador autenticado</StructuredListCell>
                <StructuredListCell>
                  <code style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.8125rem" }}>
                    {me ? me.email : "sync failed"}
                  </code>
                </StructuredListCell>
              </StructuredListRow>
              <StructuredListRow>
                <StructuredListCell>API</StructuredListCell>
                <StructuredListCell>
                  {health ? (
                    <Tag type="green">{healthLine}</Tag>
                  ) : (
                    <Tag type="red">{healthLine}</Tag>
                  )}
                </StructuredListCell>
              </StructuredListRow>
            </StructuredListBody>
          </StructuredListWrapper>
        </section>
      </div>
    </>
  );
}

function LandingPage({
  signInUrl,
  healthLine,
  healthOk,
}: {
  signInUrl: string;
  healthLine: string;
  healthOk: boolean;
}) {
  return (
    <main className="min-h-screen bg-[#f7f8f4] text-[#37323e]">
      <section className="relative isolate overflow-hidden border-b border-[#d9ded6] bg-[#eef4ed]">
        <DashboardScene />
        <div className="relative mx-auto grid min-h-[88vh] max-w-7xl content-between px-6 py-6 sm:px-10 lg:px-12">
          <nav className="flex items-center justify-between gap-4" aria-label="Principal">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center border border-[#9acaae] bg-white">
                <span className="text-lg font-semibold">b</span>
              </div>
              <span className="text-sm font-semibold uppercase">bGreen</span>
            </div>
            <Button kind="tertiary" size="md" href={signInUrl}>
              Entrar
            </Button>
          </nav>

          <div className="max-w-[38rem] py-12 sm:py-24 lg:py-28">
            <p className="mb-5 text-sm font-semibold uppercase text-[#50723c]">
              ESG operacional para empresas portuguesas
            </p>
            <h1
              className="max-w-3xl"
              style={{ fontSize: "2.75rem", lineHeight: 1.05, fontWeight: 300, margin: 0 }}
            >
              Transforme dados dispersos em decisões ESG defendíveis.
            </h1>
            <p className="mt-7 max-w-[36rem] text-xl leading-8 text-[#4f4a55]">
              O bGreen junta IES, registos ambientais, benchmarks setoriais e IA em{" "}
              <span className="whitespace-nowrap">pt-PT</span> para priorizar medidas, preparar
              auditorias e gerar relatórios PDF com rasto de evidência.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button kind="primary" size="lg" href={signInUrl}>
                <span className="inline-flex items-center gap-2">
                  Abrir workspace
                  <ArrowRight size={18} />
                </span>
              </Button>
              <Button kind="tertiary" size="lg" href="#valor">
                Ver valor de negócio
              </Button>
            </div>
          </div>

          <div className="hidden gap-3 pb-4 md:grid md:grid-cols-3">
            {[
              ["10 min", "do IES ao perfil económico revisto"],
              ["3 frentes", "dados, recomendações e relatórios"],
              ["pt-PT", "copy pronta para equipas e consultores"],
            ].map(([value, label]) => (
              <div key={value} className="border-l-2 border-[#63b995] bg-white/75 px-4 py-3">
                <div className="text-2xl font-light">{value}</div>
                <div className="mt-1 text-sm text-[#5f5965]">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="valor"
        className="border-b border-[#d9ded6] bg-white px-6 py-16 sm:px-10 lg:px-12"
      >
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase text-[#50723c]">Valor de negócio</p>
            <h2 className="max-w-xl text-4xl font-light leading-tight">
              Menos esforço manual, mais clareza para decidir investimento.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#5f5965]">
              A plataforma não se limita a recolher formulários. Cruza perfil económico, CAE,
              dimensão, registos e cobertura regulatória para mostrar onde agir primeiro e o que
              ainda falta provar.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {valueCards.map((card) => (
              <article key={card.title} className="border border-[#d9ded6] bg-[#fbfcf9] p-5">
                <card.icon size={24} className="mb-5 text-[#50723c]" />
                <h3 className="text-xl font-normal">{card.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#5f5965]">{card.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f7f8f4] px-6 py-16 sm:px-10 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
          <article className="border border-[#d9ded6] bg-white p-6">
            <div className="mb-8 flex items-center justify-between">
              <h3 className="text-xl font-normal">Comparação setorial</h3>
              <ChartLineData size={24} className="text-[#50723c]" />
            </div>
            <div className="space-y-5">
              <MetricRow label="EBITDA margem" value="14,2%" peer="P50 setor: 10,8%" width="72%" />
              <MetricRow
                label="Volume negócios"
                value="4,8 M€"
                peer="P50 setor: 5,1 M€"
                width="62%"
              />
              <MetricRow
                label="Pontuação energia"
                value="71/100"
                peer="P50 setor: 62"
                width="82%"
              />
            </div>
          </article>

          <article className="border border-[#d9ded6] bg-white p-6">
            <div className="mb-8 flex items-center justify-between">
              <h3 className="text-xl font-normal">Prioridade recomendada</h3>
              <Analytics size={24} className="text-[#50723c]" />
            </div>
            <ol className="space-y-4">
              {[
                ["Auditoria energética", "Impacto alto", "#50723c"],
                ["Contrato eletricidade verde", "Esforço baixo", "#63b995"],
                ["Medição água por zona", "Prazo médio", "#c18400"],
              ].map(([title, tag, color]) => (
                <li key={title} className="flex gap-3 border-t border-[#ecefed] pt-4">
                  <CheckmarkFilled size={20} style={{ color }} />
                  <div>
                    <div className="font-medium">{title}</div>
                    <div className="mt-1 text-sm text-[#5f5965]">{tag}</div>
                  </div>
                </li>
              ))}
            </ol>
          </article>

          <article className="border border-[#d9ded6] bg-white p-6">
            <div className="mb-8 flex items-center justify-between">
              <h3 className="text-xl font-normal">Pronto para auditoria</h3>
              <DocumentPdf size={24} className="text-[#50723c]" />
            </div>
            <div className="space-y-4 text-sm leading-6 text-[#5f5965]">
              <p>
                Relatório ESRS E1 com comentários gerados por IA, fontes de dados identificadas e
                hash SHA-256 do snapshot usado.
              </p>
              <div className="border-t border-[#ecefed] pt-4 font-mono text-xs text-[#37323e]">
                SHA-256: 7cf4e6...91a2
              </div>
              <Tag type="green">API: {healthOk ? healthLine : "offline"}</Tag>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}

const valueCards = [
  {
    icon: FetchUploadCloud,
    title: "Perfil económico sem reescrever dados",
    body: "Carregue a IES, confirme campos críticos e use esse perfil para tamanho, benchmarks e recomendações.",
  },
  {
    icon: FlowData,
    title: "Registos ESG ligados à operação",
    body: "Templates por organização, anexos, workflow de aprovação e histórico auditável por registo.",
  },
  {
    icon: Analytics,
    title: "Recomendações que citam o contexto",
    body: "A IA usa CAE, dimensão, scores e dados submetidos para evitar listas genéricas de boas intenções.",
  },
  {
    icon: ReportData,
    title: "Relatórios com prova",
    body: "PDFs com comentário, marca da organização, ficheiro arquivado e hash do conjunto de dados usado.",
  },
];

const sceneBars = [
  { id: "jan", height: 38 },
  { id: "fev", height: 52 },
  { id: "mar", height: 47 },
  { id: "abr", height: 61 },
  { id: "mai", height: 44 },
  { id: "jun", height: 36 },
];

function MetricRow({
  label,
  value,
  peer,
  width,
}: {
  label: string;
  value: string;
  peer: string;
  width: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm text-[#5f5965]">{label}</span>
        <span className="font-mono text-sm">{value}</span>
      </div>
      <div className="h-2 bg-[#edf1ea]">
        <div className="h-2 bg-[#63b995]" style={{ width }} />
      </div>
      <div className="mt-1 text-xs text-[#7a737f]">{peer}</div>
    </div>
  );
}

function DashboardScene() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#eef4ed]" />
      <div className="absolute right-4 top-24 hidden w-[39rem] border border-[#cdd8cf] bg-white/70 p-5 shadow-2xl lg:block">
        <div className="mb-6 flex items-center justify-between border-b border-[#e2e8e2] pb-4">
          <span className="text-xs font-semibold uppercase text-[#50723c]">Cockpit ESG</span>
          <span className="font-mono text-xs text-[#7a737f]">2026 Q2</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <ScenePanel label="Score" value="71" accent="#63b995" />
          <ScenePanel label="Cobertura" value="68%" accent="#ffd97d" />
          <ScenePanel label="Risco" value="Baixo" accent="#50723c" />
        </div>
        <div className="mt-5 grid grid-cols-[1.2fr_0.8fr] gap-4">
          <div className="border border-[#e2e8e2] bg-[#fbfcf9] p-4">
            <div className="mb-4 text-xs text-[#5f5965]">Tendência de emissões</div>
            <div className="flex h-28 items-end gap-3">
              {sceneBars.map((bar) => (
                <div key={bar.id} className="flex flex-1 items-end bg-[#edf1ea]">
                  <div className="w-full bg-[#63b995]" style={{ height: `${bar.height}%` }} />
                </div>
              ))}
            </div>
          </div>
          <div className="border border-[#e2e8e2] bg-[#fbfcf9] p-4">
            <div className="mb-4 text-xs text-[#5f5965]">Próxima ação</div>
            <div className="text-2xl font-light leading-tight">Reduzir energia fora de horas</div>
            <div className="mt-4 text-xs text-[#7a737f]">Impacto alto · esforço médio</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScenePanel({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="border border-[#e2e8e2] bg-[#fbfcf9] p-4">
      <div className="mb-5 h-1 w-10" style={{ backgroundColor: accent }} />
      <div className="text-xs text-[#5f5965]">{label}</div>
      <div className="mt-2 text-3xl font-light">{value}</div>
    </div>
  );
}
