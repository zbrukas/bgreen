import { api } from "@/lib/api-client";

export const dynamic = "force-dynamic";

async function fetchApiHealth(): Promise<{ status: string; service: string } | null> {
  try {
    const res = await api.health.$get();
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function Home() {
  const health = await fetchApiHealth();
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>bGreen</h1>
      <p>Foundation vertical (V1) — scaffold is up.</p>
      <p>
        API health (V2.1 RPC wiring):{" "}
        <strong>{health ? `${health.status} (${health.service})` : "unreachable"}</strong>
      </p>
    </main>
  );
}
