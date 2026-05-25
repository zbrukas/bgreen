import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveOrgId, setActiveOrgId } from "@/lib/active-org";
import { fetchHealth, fetchMe, fetchMyOrganizations } from "@/lib/api-client";
import { listProfiles } from "@/lib/economic-profile-actions";
import type { OrganizationEconomicProfile } from "@/lib/economic-profile-types";
import { getSignInUrl, withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { EconomicProfileCta } from "./_home/EconomicProfileCta";
import { EconomicProfileSummary } from "./_home/EconomicProfileSummary";
import { CreateOrganizationForm } from "./_components/CreateOrganizationForm/CreateOrganizationForm";
import { Header } from "./_components/Header/Header";

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
        <h1 className="text-4xl font-bold tracking-tight">bGreen</h1>
        <p className="text-center text-muted-foreground">
          Recolha de dados ESG, recomendações com IA, e relatórios prontos para o regulador.
        </p>
        <a href={signInUrl} className={buttonVariants({ size: "lg" })}>
          Iniciar sessão
        </a>
        <p className="text-xs text-muted-foreground">
          API: <span className="font-mono">{healthLine}</span>
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
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">bGreen</h1>
          <p className="text-muted-foreground">
            Olá <strong className="text-foreground">{auth.user.email}</strong>. Vamos criar a sua
            primeira organização.
          </p>
        </div>
        <CreateOrganizationForm />
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
      <Header
        userEmail={auth.user.email}
        organizations={orgs}
        activeOrganizationId={activeOrgId}
        activeOrganizationRole={me?.activeOrganizationRole ?? null}
      />
      <main className="mx-auto max-w-3xl space-y-6 p-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {activeOrg ? activeOrg.name : "bGreen"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {orgs.length === 1
              ? "Pertence a 1 organização."
              : `Pertence a ${orgs.length} organizações.`}
          </p>
        </div>

        {latestProfile === null ? (
          <EconomicProfileCta />
        ) : (
          <EconomicProfileSummary profile={latestProfile} count={profiles.length} />
        )}

        <Card>
          <CardHeader>
            <CardTitle>Estado do sistema</CardTitle>
            <CardDescription>Diagnóstico rápido das ligações da plataforma.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Utilizador autenticado</span>
              <span className="font-mono text-xs">{me ? `${me.email}` : "sync failed"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">API</span>
              <span className="font-mono text-xs">{healthLine}</span>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
