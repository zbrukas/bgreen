import { PageHeader } from "@bgreen/ui";
import { getActiveOrgId, setActiveOrgId } from "@/lib/active-org";
import { fetchHealth, fetchMe, fetchMyOrganizations } from "@/lib/api-client";
import { listProfiles } from "@/lib/economic-profile-actions";
import type { OrganizationEconomicProfile } from "@/lib/economic-profile-types";
import { Building } from "@carbon/icons-react";
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
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 p-8">
        <h1 style={{ fontSize: "3rem", fontWeight: 300, letterSpacing: "0.16px", margin: 0 }}>
          bGreen
        </h1>
        <p className="text-center text-neutral-700">
          Recolha de dados ESG, recomendações com IA, e relatórios prontos para o regulador.
        </p>
        <Button kind="primary" href={signInUrl} size="lg">
          Iniciar sessão
        </Button>
        <p className="text-xs text-neutral-500">
          API:{" "}
          <code style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{healthLine}</code>
        </p>
      </main>
    );
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

  // Resolve active org. Cookie wins if it points at a current membership;
  // otherwise fall back to the first org and persist the choice.
  let activeOrgId = await getActiveOrgId();
  if (!activeOrgId || !orgs.some((o) => o.id === activeOrgId)) {
    const first = orgs[0];
    if (first) {
      await setActiveOrgId(first.id);
      activeOrgId = first.id;
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
