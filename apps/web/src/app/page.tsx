import { fetchHealth, fetchMe, fetchMyOrganizations } from "@/lib/api-client";
import { getSignInUrl, withAuth } from "@workos-inc/authkit-nextjs";
import { signOutAction } from "./actions";

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

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: 720 }}>
      <h1>bGreen</h1>
      <p>
        Signed in as <strong>{auth.user.email}</strong> (via WorkOS).
      </p>
      <p>bGreen User row: {me ? `${me.id} — ${me.email}` : "sync failed"}</p>
      <p>
        Organizations ({orgs.length}):{" "}
        {orgs.length === 0
          ? "(none yet — org create lands in V2.3)"
          : orgs.map((o) => o.name).join(", ")}
      </p>
      <p>
        API health: <strong>{healthLine}</strong>
      </p>
      <form action={signOutAction}>
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
