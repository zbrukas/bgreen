import type { AppType } from "@bgreen/api/rpc";
import type { CentralServicesRole, UserType } from "@bgreen/types";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { hc } from "hono/client";

const apiBaseUrl = process.env.API_URL ?? "http://localhost:8787";

// Hono RPC client. Same trick as apps/web: type-annotate so the inferred
// RPC shape doesn't try to reach into @bgreen/api's internal modules.
export const api: ReturnType<typeof hc<AppType>> = hc<AppType>(apiBaseUrl);

async function authedHeaders(): Promise<Record<string, string>> {
  const auth = await withAuth();
  if (!auth.user || !auth.accessToken) return {};
  return { Authorization: `Bearer ${auth.accessToken}` };
}

export interface MeResponse {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  userType: UserType;
  centralServicesRole: CentralServicesRole | null;
}

// The CS console uses /identity/me to figure out whether the signed-in
// user is allowed in. Org users get bounced to the web URL.
export async function fetchMe(): Promise<MeResponse | null> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return null;
    const res = await api.identity.me.$get(undefined, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      id: data.id,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      // /me already exposes these fields once V5.4f extends the
      // identity route; until then we cast and tolerate undefined.
      userType: (data as { userType?: UserType }).userType ?? "organization",
      centralServicesRole:
        (data as { centralServicesRole?: CentralServicesRole | null }).centralServicesRole ?? null,
    };
  } catch {
    return null;
  }
}
