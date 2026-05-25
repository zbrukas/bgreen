"use server";

// Server actions for /economic-profile. Proxy the apps/api endpoints
// with the user's WorkOS session attached. Server-only — the access
// token never reaches the browser.
//
// Errors throw `IesError` (with a stable `code` string) so the react-
// query mutations / queries can branch in their onError handlers.

import { withAuth } from "@workos-inc/authkit-nextjs";
import { getActiveOrgId } from "./active-org";
import {
  type BenchmarkComparison,
  type Dimensao,
  type DimensaoProposalResponse,
  type ExtractionEdits,
  IesError,
  type IesExtractionLog,
  type ManualEntryInput,
  type OrganizationEconomicProfile,
} from "./economic-profile-types";

const API_URL = process.env.API_URL ?? "http://localhost:8787";

async function authedHeaders(): Promise<Record<string, string>> {
  const auth = await withAuth();
  if (!auth.user || !auth.accessToken) {
    throw new IesError("not_signed_in", 401);
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth.accessToken}`,
  };
  const orgId = await getActiveOrgId();
  if (orgId) headers["X-Organization-Id"] = orgId;
  return headers;
}

async function readErrorCode(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? "request_failed";
}

// ── IES upload ─────────────────────────────────────────────────────────
// Accepts a FormData with field `file` (a File). The Next.js server-
// action runtime serializes FormData → multipart preserving the File
// object on the server side; we re-pack it as multipart for apps/api.
export async function uploadIes(formData: FormData): Promise<IesExtractionLog> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new IesError("file_required", 400);
  }
  const headers = await authedHeaders();
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${API_URL}/economic-profile/ies`, {
    method: "POST",
    headers,
    body,
  });
  if (!res.ok) {
    throw new IesError(await readErrorCode(res), res.status);
  }
  return (await res.json()) as IesExtractionLog;
}

// ── Polling endpoint ───────────────────────────────────────────────────
export async function getExtractionStatus(logId: string): Promise<IesExtractionLog> {
  const headers = await authedHeaders();
  const res = await fetch(`${API_URL}/economic-profile/ies/${encodeURIComponent(logId)}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new IesError(await readErrorCode(res), res.status);
  }
  return (await res.json()) as IesExtractionLog;
}

// ── Confirm extraction (optionally with edits) ─────────────────────────
export async function confirmExtraction(
  logId: string,
  edits: ExtractionEdits,
): Promise<OrganizationEconomicProfile> {
  const headers = await authedHeaders();
  const res = await fetch(
    `${API_URL}/economic-profile/ies/${encodeURIComponent(logId)}/confirm`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(edits),
    },
  );
  if (!res.ok) {
    throw new IesError(await readErrorCode(res), res.status);
  }
  return (await res.json()) as OrganizationEconomicProfile;
}

// ── Cancel extraction ──────────────────────────────────────────────────
export async function cancelExtraction(logId: string): Promise<void> {
  const headers = await authedHeaders();
  const res = await fetch(
    `${API_URL}/economic-profile/ies/${encodeURIComponent(logId)}/cancel`,
    {
      method: "POST",
      headers,
    },
  );
  if (!res.ok) {
    throw new IesError(await readErrorCode(res), res.status);
  }
}

// ── Manual entry ───────────────────────────────────────────────────────
export async function manualEntry(
  input: ManualEntryInput,
): Promise<OrganizationEconomicProfile> {
  const headers = await authedHeaders();
  const res = await fetch(`${API_URL}/economic-profile/manual`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new IesError(await readErrorCode(res), res.status);
  }
  return (await res.json()) as OrganizationEconomicProfile;
}

// ── V7.1 dimensao proposal (deterministic classifier output) ───────────
export async function getDimensaoProposal(year: number): Promise<DimensaoProposalResponse> {
  const headers = await authedHeaders();
  const res = await fetch(
    `${API_URL}/economic-profile/${encodeURIComponent(String(year))}/dimensao/proposed`,
    { method: "GET", headers, cache: "no-store" },
  );
  if (!res.ok) {
    throw new IesError(await readErrorCode(res), res.status);
  }
  return (await res.json()) as DimensaoProposalResponse;
}

// ── V7.1 dimensao confirm ──────────────────────────────────────────────
export async function confirmDimensao(input: {
  year: number;
  dimensao: Dimensao;
  source: "ai_classified" | "user_override";
}): Promise<OrganizationEconomicProfile> {
  const headers = await authedHeaders();
  const res = await fetch(
    `${API_URL}/economic-profile/${encodeURIComponent(String(input.year))}/dimensao`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ dimensao: input.dimensao, source: input.source }),
    },
  );
  if (!res.ok) {
    throw new IesError(await readErrorCode(res), res.status);
  }
  return (await res.json()) as OrganizationEconomicProfile;
}

// ── V7.2 sector benchmark comparison ───────────────────────────────────
export async function getBenchmarkComparison(year: number): Promise<BenchmarkComparison> {
  const headers = await authedHeaders();
  const res = await fetch(
    `${API_URL}/sector-benchmark/compare?year=${encodeURIComponent(String(year))}`,
    { method: "GET", headers, cache: "no-store" },
  );
  if (!res.ok) {
    throw new IesError(await readErrorCode(res), res.status);
  }
  return (await res.json()) as BenchmarkComparison;
}

// ── List profiles ──────────────────────────────────────────────────────
export async function listProfiles(): Promise<OrganizationEconomicProfile[]> {
  const headers = await authedHeaders();
  const res = await fetch(`${API_URL}/economic-profile`, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new IesError(await readErrorCode(res), res.status);
  }
  return (await res.json()) as OrganizationEconomicProfile[];
}
