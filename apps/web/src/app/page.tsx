import { getActiveOrgId, setActiveOrgId } from "@/lib/active-org";
import { fetchHealth, fetchMe, fetchMyOrganizations } from "@/lib/api-client";
import { getSignInUrl, withAuth } from "@workos-inc/authkit-nextjs";
import { CreateOrganizationForm } from "./_components/CreateOrganizationForm";
import { Header } from "./_components/Header";

export const dynamic = "force-dynamic";

export default async function Home() {
  const auth = await withAuth();
  const health = await fetchHealth();
  const healthLine = health ? `${health.status} (${health.service})` : "unreachable";

  if (!auth.user) {
    const signInUrl = await getSignInUrl();
    return (
      <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: 720 }}>
        <h1>bGreen</h1>
        <p>Foundation (V1) + data layer (V2.1) + WorkOS sign-in (V2.2).</p>
        <p>
          API health: <strong>{healthLine}</strong>
        </p>
        <p>
          <a href={signInUrl}>Sign in</a>
        </p>
      </main>
    );
  }

  const [me, orgs] = await Promise.all([fetchMe(), fetchMyOrganizations()]);

  if (orgs.length === 0) {
    return (
      <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: 720 }}>
        <h1>bGreen</h1>
        <p>
          Olá <strong>{auth.user.email}</strong>. Vamos criar a sua primeira organização.
        </p>
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

  return (
    <>
      <Header userEmail={auth.user.email} organizations={orgs} activeOrganizationId={activeOrgId} />
      <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: 720 }}>
        <h1>{activeOrg ? activeOrg.name : "bGreen"}</h1>
        <p>bGreen User row: {me ? `${me.id} — ${me.email}` : "sync failed"}</p>
        <p>
          You belong to {orgs.length} {orgs.length === 1 ? "organization" : "organizations"}.
        </p>
        <p>
          API health: <strong>{healthLine}</strong>
        </p>
      </main>
    </>
  );
}
