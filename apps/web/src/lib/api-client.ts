import type { AppType } from "@bgreen/api/rpc";
import type { FormError } from "@bgreen/form-engine";
import type {
  Record as BgRecord,
  InvitePreview,
  LegalForm,
  MembershipRole,
  OrganizationSize,
  RecordTemplate,
  Topic,
} from "@bgreen/types";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { hc } from "hono/client";
import { getActiveOrgId } from "./active-org";

const apiBaseUrl = process.env.API_URL ?? "http://localhost:8787";

// Annotate the client so the type is named through `AppType` rather than
// being inlined. Without this TS would try to embed type references to
// internal modules in @bgreen/api (like ./modules/audit) which it can't
// write portably from outside the package.
export const api: ReturnType<typeof hc<AppType>> = hc<AppType>(apiBaseUrl);

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
  // V5.6: topic slugs the member can see/edit. Empty = no restriction.
  activeTopicScope: string[];
  userType: "central_services" | "organization";
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
      activeTopicScope: (data as { activeTopicScope?: string[] }).activeTopicScope ?? [],
      userType:
        (data as { userType?: "central_services" | "organization" }).userType ?? "organization",
    };
  } catch {
    return null;
  }
}

// V12.1 — fire-and-forget telemetry call from setActiveOrgId(). The API
// dedupes within 60s so calling on every cookie write is safe. Failure
// is swallowed because login UX must not break on audit-log write
// errors.
export async function postLoginEvent(organizationId: string): Promise<void> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return;
    await api.identity["login-event"].$post(
      { json: { organizationId } },
      { headers },
    );
  } catch {
    // intentional — see comment above.
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

// V11.4 — fetches the full organization row (with branding fields) for
// the active org. Returns null when not signed in or not a member.
// The /organizations endpoint already returns full rows; we just need
// the un-narrowed shape here.
export interface OrganizationFull {
  id: string;
  name: string;
  logoUrl: string | null;
  brandPrimaryColor: string | null;
}

export async function fetchActiveOrganization(
  organizationId: string,
): Promise<OrganizationFull | null> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return null;
    const res = await api.organizations.$get(undefined, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    const o = data.find((row) => row.id === organizationId);
    if (!o) return null;
    return {
      id: o.id,
      name: o.name,
      logoUrl: o.logoUrl,
      brandPrimaryColor: o.brandPrimaryColor,
    };
  } catch {
    return null;
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
  topicScope: string[];
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
        json: { email: input.email, role: input.role, topicScope: input.topicScope },
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

// ---------- Members ----------

export interface MemberRow {
  userId: string;
  organizationId: string;
  role: MembershipRole;
  topicScope: string[];
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

export async function fetchMembers(organizationId: string): Promise<MemberRow[]> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return [];
    const res = await api.organizations[":orgId"].members.$get(
      { param: { orgId: organizationId } },
      { headers },
    );
    if (!res.ok) return [];
    return (await res.json()) as MemberRow[];
  } catch {
    return [];
  }
}

export async function updateMember(input: {
  organizationId: string;
  userId: string;
  role?: MembershipRole;
  topicScope?: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return { ok: false, error: "not_signed_in" };
    const json: { role?: MembershipRole; topicScope?: string[] } = {};
    if (input.role !== undefined) json.role = input.role;
    if (input.topicScope !== undefined) json.topicScope = input.topicScope;
    const res = await api.organizations[":orgId"].members[":userId"].$patch(
      { param: { orgId: input.organizationId, userId: input.userId }, json },
      { headers },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "request_failed" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "network_error" };
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

// ---------- Topics ----------

export async function fetchTopics(): Promise<Topic[]> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return [];
    const res = await api.topics.$get(undefined, { headers });
    if (!res.ok) return [];
    return (await res.json()) as Topic[];
  } catch {
    return [];
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

// ---------- Records ----------

export type SubmitRecordResult =
  | { ok: true; record: BgRecord }
  | { ok: false; error: string; fieldErrors?: FormError[] };

export async function fetchRecordPrefill(templateId: string): Promise<Record<string, unknown>> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return {};
    const res = await api.records.prefill.$get({ query: { template: templateId } }, { headers });
    if (!res.ok) return {};
    const data = (await res.json()) as { values?: Record<string, unknown> };
    return data.values ?? {};
  } catch {
    return {};
  }
}

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

// ---------- Audit ----------

export type AuditEntityKind =
  | "record"
  | "record_template"
  | "organization"
  | "organization_invite"
  | "workflow_instance";

export interface AuditEvent {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  organizationId: string;
  entityKind: AuditEntityKind;
  entityId: string;
  action: string;
  payload: unknown;
  correlationId: string | null;
}

export async function fetchAuditTrail(
  entityKind: AuditEntityKind,
  entityId: string,
): Promise<AuditEvent[]> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return [];
    const res = await api.audit[":entityKind"][":entityId"].$get(
      { param: { entityKind, entityId } },
      { headers },
    );
    if (!res.ok) return [];
    return (await res.json()) as AuditEvent[];
  } catch {
    return [];
  }
}

// ---------- Workflows ----------

export interface WorkflowInstance {
  id: string;
  organizationId: string;
  entityKind: "record";
  entityId: string;
  definitionId: "single-step-submit" | "two-step-review" | "three-step-certify";
  definitionVersion: number;
  currentState: string | Record<string, unknown>;
  context: { submitterUserId: string | null; reviewerUserId: string | null };
  createdAt: string;
  updatedAt: string;
}

export async function fetchInbox(): Promise<WorkflowInstance[]> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return [];
    const res = await api.workflows.inbox.$get(undefined, { headers });
    if (!res.ok) return [];
    return (await res.json()) as WorkflowInstance[];
  } catch {
    return [];
  }
}
