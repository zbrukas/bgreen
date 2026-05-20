import type { AppType } from "@bgreen/api/rpc";
import type { FormError } from "@bgreen/form-engine";
import type {
  Record as BgRecord,
  FormSchema,
  InvitePreview,
  LegalForm,
  MembershipRole,
  OrganizationSize,
  RecordTemplate,
} from "@bgreen/types";
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
  nif: string | null;
  caeCode: string | null;
  legalForm: LegalForm | null;
  selfReportedSize: OrganizationSize | null;
  postalCode: string | null;
  addressLine: string | null;
  freguesia: string | null;
  concelho: string | null;
  distrito: string | null;
}): Promise<{ id: string; name: string } | { error: string }> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return { error: "not_signed_in" };
    const res = await api.organizations.$post(
      {
        json: {
          name: input.name,
          nif: input.nif,
          caeCode: input.caeCode,
          legalForm: input.legalForm,
          selfReportedSize: input.selfReportedSize,
          postalCode: input.postalCode,
          addressLine: input.addressLine,
          freguesia: input.freguesia,
          concelho: input.concelho,
          distrito: input.distrito,
        },
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

export interface PostalCodeLookupResult {
  postalCode: string;
  found: boolean;
  freguesia?: string | null;
  concelho?: string | null;
  distrito?: string | null;
}

export async function lookupPostalCode(cp: string): Promise<PostalCodeLookupResult | null> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return null;
    const res = await api.lookups["postal-code"][":cp"].$get({ param: { cp } }, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return data as PostalCodeLookupResult;
  } catch {
    return null;
  }
}

export interface CaeEntry {
  code: string;
  description: string;
  level: number | null;
}

export async function searchCae(query: string, limit = 20): Promise<CaeEntry[]> {
  if (query.trim() === "") return [];
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return [];
    const res = await api.lookups.cae.$get(
      { query: { q: query, limit: String(limit) } },
      { headers },
    );
    if (!res.ok) return [];
    return (await res.json()) as CaeEntry[];
  } catch {
    return [];
  }
}

export async function findCaeByCode(code: string): Promise<CaeEntry | null> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return null;
    const res = await api.lookups.cae[":code"].$get({ param: { code } }, { headers });
    if (!res.ok) return null;
    return (await res.json()) as CaeEntry;
  } catch {
    return null;
  }
}

export interface ViesLookupResult {
  valid: boolean;
  name: string | null;
  address: string | null;
  source: "vies" | "unreachable";
  requestDate?: string;
}

export async function lookupVies(nif: string): Promise<ViesLookupResult | null> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return null;
    const res = await api.lookups.vies[":nif"].$get({ param: { nif } }, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return data as ViesLookupResult;
  } catch {
    return null;
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

// ---------- Record templates ----------

export async function fetchTemplates(): Promise<RecordTemplate[]> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return [];
    const res = await api["record-templates"].$get(undefined, { headers });
    if (!res.ok) return [];
    return (await res.json()) as RecordTemplate[];
  } catch {
    return [];
  }
}

export async function fetchTemplate(id: string): Promise<RecordTemplate | null> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return null;
    const res = await api["record-templates"][":id"].$get({ param: { id } }, { headers });
    if (!res.ok) return null;
    return (await res.json()) as RecordTemplate;
  } catch {
    return null;
  }
}

export async function createTemplate(input: {
  name: string;
  description: string | null;
  formSchema: FormSchema;
}): Promise<RecordTemplate | { error: string }> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return { error: "not_signed_in" };
    const res = await api["record-templates"].$post(
      {
        json: {
          name: input.name,
          description: input.description,
          formSchema: input.formSchema,
        },
      },
      { headers },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({ error: "request_failed" }))) as {
        error?: string;
      };
      return { error: body.error ?? "request_failed" };
    }
    return (await res.json()) as RecordTemplate;
  } catch {
    return { error: "network_error" };
  }
}

export async function publishTemplate(id: string): Promise<RecordTemplate | { error: string }> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return { error: "not_signed_in" };
    const res = await api["record-templates"][":id"].publish.$post({ param: { id } }, { headers });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({ error: "request_failed" }))) as {
        error?: string;
      };
      return { error: body.error ?? "request_failed" };
    }
    return (await res.json()) as RecordTemplate;
  } catch {
    return { error: "network_error" };
  }
}

export async function archiveTemplate(id: string): Promise<RecordTemplate | { error: string }> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return { error: "not_signed_in" };
    const res = await api["record-templates"][":id"].archive.$post({ param: { id } }, { headers });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({ error: "request_failed" }))) as {
        error?: string;
      };
      return { error: body.error ?? "request_failed" };
    }
    return (await res.json()) as RecordTemplate;
  } catch {
    return { error: "network_error" };
  }
}

// ---------- Records ----------

export type SubmitRecordResult =
  | { ok: true; record: BgRecord }
  | { ok: false; error: string; fieldErrors?: FormError[] };

export async function fetchMyRecords(): Promise<BgRecord[]> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return [];
    const res = await api.records.$get(undefined, { headers });
    if (!res.ok) return [];
    return (await res.json()) as BgRecord[];
  } catch {
    return [];
  }
}

export async function fetchRecord(id: string): Promise<BgRecord | null> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return null;
    const res = await api.records[":id"].$get({ param: { id } }, { headers });
    if (!res.ok) return null;
    return (await res.json()) as BgRecord;
  } catch {
    return null;
  }
}

export async function createRecord(input: {
  templateId: string;
  values: Record<string, unknown>;
  asDraft: boolean;
}): Promise<SubmitRecordResult> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return { ok: false, error: "not_signed_in" };
    const res = await api.records.$post(
      {
        json: {
          templateId: input.templateId,
          values: input.values,
          asDraft: input.asDraft,
        },
      },
      { headers },
    );
    if (res.ok) {
      const record = (await res.json()) as BgRecord;
      return { ok: true, record };
    }
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      errors?: FormError[];
    };
    return { ok: false, error: body.error ?? "request_failed", fieldErrors: body.errors };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export type ReviewDecision = "approve" | "request_changes" | "reject";

export type ReviewRecordResult = { ok: true; record: BgRecord } | { ok: false; error: string };

export async function reviewRecord(input: {
  id: string;
  decision: ReviewDecision;
  comment: string | null;
}): Promise<ReviewRecordResult> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return { ok: false, error: "not_signed_in" };
    const res = await api.records[":id"].review.$post(
      {
        param: { id: input.id },
        json: { decision: input.decision, comment: input.comment },
      },
      { headers },
    );
    if (res.ok) {
      const record = (await res.json()) as BgRecord;
      return { ok: true, record };
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: body.error ?? "request_failed" };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export async function updateRecord(input: {
  id: string;
  values: Record<string, unknown>;
  action: "save_draft" | "submit";
}): Promise<SubmitRecordResult> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return { ok: false, error: "not_signed_in" };
    const res = await api.records[":id"].$patch(
      {
        param: { id: input.id },
        json: { values: input.values, action: input.action },
      },
      { headers },
    );
    if (res.ok) {
      const record = (await res.json()) as BgRecord;
      return { ok: true, record };
    }
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      errors?: FormError[];
    };
    return { ok: false, error: body.error ?? "request_failed", fieldErrors: body.errors };
  } catch {
    return { ok: false, error: "network_error" };
  }
}
