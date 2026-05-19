import type { AppType } from "@bgreen/api/rpc";
import type { InvitePreview, LegalForm, MembershipRole } from "@bgreen/types";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { hc } from "hono/client";
import { getActiveOrgId } from "./active-org";

const apiBaseUrl = process.env.API_URL ?? "http://localhost:8787";

export const api = hc<AppType>(apiBaseUrl);

async function authedHeaders(): Promise<Record<string, string>> {
  const auth = await withAuth();
  if (!auth.user || !auth.accessToken) return {};
  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth.accessToken}`,
  };
  const orgId = await getActiveOrgId();
  if (orgId) headers["X-Organization-Id"] = orgId;
  return headers;
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

export interface MeResponse {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  activeOrganizationId: string | null;
  activeOrganizationRole: MembershipRole | null;
}

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
      activeOrganizationId: data.activeOrganizationId,
      activeOrganizationRole: data.activeOrganizationRole,
    };
  } catch {
    return null;
  }
}

export async function fetchMyOrganizations(): Promise<Array<{ id: string; name: string }>> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return [];
    const res = await api.organizations.$get(undefined, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((o) => ({ id: o.id, name: o.name }));
  } catch {
    return [];
  }
}

export async function createOrganization(input: {
  name: string;
  legalForm: LegalForm | null;
}): Promise<{ id: string; name: string } | { error: string }> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return { error: "not_signed_in" };
    const res = await api.organizations.$post(
      { json: { name: input.name, legalForm: input.legalForm } },
      { headers },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({ error: "request_failed" }))) as {
        error?: string;
      };
      return { error: body.error ?? "request_failed" };
    }
    const data = await res.json();
    return { id: data.organization.id, name: data.organization.name };
  } catch {
    return { error: "network_error" };
  }
}

export async function createInvite(input: {
  organizationId: string;
  email: string;
  role: MembershipRole;
}): Promise<
  | { acceptUrl: string; invitedEmail: string; emailDelivered: boolean; emailReason: string | null }
  | { error: string }
> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return { error: "not_signed_in" };
    const res = await api.organizations[":orgId"].invites.$post(
      {
        param: { orgId: input.organizationId },
        json: { email: input.email, role: input.role },
      },
      { headers },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({ error: "request_failed" }))) as {
        error?: string;
      };
      return { error: body.error ?? "request_failed" };
    }
    const data = await res.json();
    return {
      acceptUrl: data.acceptUrl,
      invitedEmail: data.invite.invitedEmail,
      emailDelivered: data.emailDelivered,
      emailReason: data.emailReason,
    };
  } catch {
    return { error: "network_error" };
  }
}

export async function fetchInvitePreview(
  token: string,
): Promise<InvitePreview | { error: string }> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return { error: "not_signed_in" };
    const res = await api.invites[":token"].$get({ param: { token } }, { headers });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({ error: "request_failed" }))) as {
        error?: string;
      };
      return { error: body.error ?? "request_failed" };
    }
    return await res.json();
  } catch {
    return { error: "network_error" };
  }
}

export async function acceptInvite(
  token: string,
): Promise<{ organizationId: string } | { error: string }> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return { error: "not_signed_in" };
    const res = await api.invites[":token"].accept.$post({ param: { token } }, { headers });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({ error: "request_failed" }))) as {
        error?: string;
      };
      return { error: body.error ?? "request_failed" };
    }
    return await res.json();
  } catch {
    return { error: "network_error" };
  }
}
