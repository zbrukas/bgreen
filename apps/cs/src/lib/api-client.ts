import type { AppType } from "@bgreen/api/rpc";
import type {
  Record as BgRecord,
  CentralServicesRole,
  CsHealthRow,
  CsHealthTier,
  FormSchema,
  RecordTemplate,
  Topic,
  UserType,
  WorkflowDefinitionId,
} from "@bgreen/types";
import { hc } from "hono/client";
import { cookies } from "next/headers";

const apiBaseUrl = process.env.API_URL ?? "http://localhost:8787";

export const api: ReturnType<typeof hc<AppType>> = hc<AppType>(apiBaseUrl);

export const CS_SESSION_COOKIE = "cs_session";

async function authedHeaders(): Promise<Record<string, string>> {
  const store = await cookies();
  const token = store.get(CS_SESSION_COOKIE)?.value;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export interface MeResponse {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  userType: UserType;
  centralServicesRole: CentralServicesRole | null;
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
      userType: (data as { userType?: UserType }).userType ?? "organization",
      centralServicesRole:
        (data as { centralServicesRole?: CentralServicesRole | null }).centralServicesRole ?? null,
    };
  } catch {
    return null;
  }
}

// ---------- Templates (CS owns these) ----------

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
  workflowDefinitionId?: WorkflowDefinitionId;
  topicTagId?: string | null;
  isSubTemplate?: boolean;
  composedSubTemplateIds?: string[];
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
          ...(input.workflowDefinitionId
            ? { workflowDefinitionId: input.workflowDefinitionId }
            : {}),
          ...(input.topicTagId !== undefined ? { topicTagId: input.topicTagId } : {}),
          ...(input.isSubTemplate !== undefined ? { isSubTemplate: input.isSubTemplate } : {}),
          ...(input.composedSubTemplateIds !== undefined
            ? { composedSubTemplateIds: input.composedSubTemplateIds }
            : {}),
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

// ---------- CS-namespaced (cross-org) ----------

export interface WorkflowInstance {
  id: string;
  organizationId: string;
  entityKind: "record";
  entityId: string;
  definitionId: WorkflowDefinitionId;
  currentState: string | Record<string, unknown>;
  updatedAt: string;
}

export async function fetchCsInbox(): Promise<WorkflowInstance[]> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return [];
    const res = await api.cs.inbox.$get(undefined, { headers });
    if (!res.ok) return [];
    return (await res.json()) as WorkflowInstance[];
  } catch {
    return [];
  }
}

export async function fetchCsRecord(id: string): Promise<BgRecord | null> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return null;
    const res = await api.cs.records[":id"].$get({ param: { id } }, { headers });
    if (!res.ok) return null;
    return (await res.json()) as BgRecord;
  } catch {
    return null;
  }
}

export type ReviewDecision = "approve" | "request_changes" | "reject";

export async function reviewCsRecord(input: {
  id: string;
  decision: ReviewDecision;
  comment: string | null;
}): Promise<{ ok: true; record: BgRecord } | { ok: false; error: string }> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return { ok: false, error: "not_signed_in" };
    const res = await api.cs.records[":id"].review.$post(
      { param: { id: input.id }, json: { decision: input.decision, comment: input.comment } },
      { headers },
    );
    if (res.ok) return { ok: true, record: (await res.json()) as BgRecord };
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: body.error ?? "request_failed" };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

// ---------- CS domains ----------

export interface CsDomain {
  id: string;
  domain: string;
  note: string | null;
  createdAt: string;
}

export async function fetchCsDomains(): Promise<CsDomain[]> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return [];
    const res = await api.cs.domains.$get(undefined, { headers });
    if (!res.ok) return [];
    return (await res.json()) as CsDomain[];
  } catch {
    return [];
  }
}

export async function addCsDomain(input: {
  domain: string;
  note: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return { ok: false, error: "not_signed_in" };
    const res = await api.cs.domains.$post(
      { json: { domain: input.domain, note: input.note } },
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

export async function deleteCsDomain(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return { ok: false, error: "not_signed_in" };
    const res = await api.cs.domains[":id"].$delete({ param: { id } }, { headers });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "request_failed" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "network_error" };
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

export async function createTopic(input: {
  slug: string;
  name: string;
}): Promise<Topic | { error: string }> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return { error: "not_signed_in" };
    const res = await api.topics.$post(
      { json: { slug: input.slug, name: input.name } },
      { headers },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({ error: "request_failed" }))) as {
        error?: string;
      };
      return { error: body.error ?? "request_failed" };
    }
    return (await res.json()) as Topic;
  } catch {
    return { error: "network_error" };
  }
}

export async function deleteTopic(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return { ok: false, error: "not_signed_in" };
    const res = await api.topics[":id"].$delete({ param: { id } }, { headers });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "request_failed" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

// ---------- CS users (admin only) ----------

export interface CsUserRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  centralServicesRole: CentralServicesRole | null;
  passwordSet: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export async function fetchCsUsers(): Promise<CsUserRow[]> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return [];
    const res = await api.cs.users.$get(undefined, { headers });
    if (!res.ok) return [];
    return (await res.json()) as CsUserRow[];
  } catch {
    return [];
  }
}

export async function createCsUser(input: {
  email: string;
  role: CentralServicesRole;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return { ok: false, error: "not_signed_in" };
    const res = await api.cs.users.$post(
      { json: { email: input.email, role: input.role } },
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

export async function updateCsUserRole(input: {
  id: string;
  role: CentralServicesRole;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return { ok: false, error: "not_signed_in" };
    const res = await api.cs.users[":id"].$patch(
      { param: { id: input.id }, json: { role: input.role } },
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

export async function deleteCsUser(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return { ok: false, error: "not_signed_in" };
    const res = await api.cs.users[":id"].$delete({ param: { id } }, { headers });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "request_failed" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

// ---- V12.3 — CS health dashboard ------------------------------------

export interface CsHealthListEntry {
  row: CsHealthRow;
  healthScore: number;
  healthTier: CsHealthTier;
}

export interface CsHealthDetail {
  row: CsHealthRow;
  healthScore: number;
  healthTier: CsHealthTier;
  snapshots: Array<{ snapshotDate: string; metrics: CsHealthRow }>;
}

export interface CsCohortActivationResult {
  cohortMonth: string;
  totalOrgs: number;
  activatedIn30d: number;
  percentActivated: number;
}

export interface CsHealthListFilter {
  tier?: CsHealthTier;
  hasStagnantWork?: boolean;
  sortBy?:
    | "tier"
    | "daysSinceLastLogin"
    | "stagnantWorkflowsCount"
    | "oldestStagnantWorkflowDays";
}

export async function fetchCsHealth(
  filter: CsHealthListFilter = {},
): Promise<CsHealthListEntry[]> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return [];
    const query: Record<string, string> = {};
    if (filter.tier) query.tier = filter.tier;
    if (filter.hasStagnantWork) query.hasStagnantWork = "true";
    if (filter.sortBy) query.sortBy = filter.sortBy;
    const res = await api.cs.health.$get({ query }, { headers });
    if (!res.ok) return [];
    return (await res.json()) as CsHealthListEntry[];
  } catch {
    return [];
  }
}

export async function fetchCsHealthDetail(
  organizationId: string,
): Promise<CsHealthDetail | null> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return null;
    const res = await api.cs.health[":organizationId"].$get(
      { param: { organizationId } },
      { headers },
    );
    if (!res.ok) return null;
    return (await res.json()) as CsHealthDetail;
  } catch {
    return null;
  }
}

export async function fetchCsCohortActivation(
  cohortMonth: string,
): Promise<CsCohortActivationResult | null> {
  try {
    const headers = await authedHeaders();
    if (!headers.Authorization) return null;
    const res = await api.cs.cohorts.activation.$get(
      { query: { cohortMonth } },
      { headers },
    );
    if (!res.ok) return null;
    return (await res.json()) as CsCohortActivationResult;
  } catch {
    return null;
  }
}
