import type { AppType } from "@bgreen/api/rpc";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { hc } from "hono/client";

const apiBaseUrl = process.env.API_URL ?? "http://localhost:8787";

// Untyped headers; per-call helpers below add Authorization when signed in.
export const api = hc<AppType>(apiBaseUrl);

async function bearerHeader(): Promise<Record<string, string>> {
  const auth = await withAuth();
  if (auth.user && auth.accessToken) {
    return { Authorization: `Bearer ${auth.accessToken}` };
  }
  return {};
}

export async function fetchHealth(): Promise<{ status: string; service: string } | null> {
  try {
    const res = await api.health.$get();
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchMe(): Promise<{
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
} | null> {
  try {
    const headers = await bearerHeader();
    if (!headers.Authorization) return null;
    const res = await api.identity.me.$get(undefined, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      id: data.id,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
    };
  } catch {
    return null;
  }
}

export async function fetchMyOrganizations(): Promise<Array<{ id: string; name: string }>> {
  try {
    const headers = await bearerHeader();
    if (!headers.Authorization) return [];
    const res = await api.organizations.$get(undefined, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((o) => ({ id: o.id, name: o.name }));
  } catch {
    return [];
  }
}
