"use server";

// V10.4 — server actions proxying apps/api's framework-coverage
// surface. Server-only; attaches the WorkOS session token + active
// org id. Mirrors the patterns of recommendations-actions.ts /
// economic-profile-actions.ts.

import { withAuth } from "@workos-inc/authkit-nextjs";
import { getActiveOrgId } from "./active-org";
import {
  type CoverageCheckResult,
  CoverageError,
  type CoverageMatrix,
  type Framework,
  type FrameworkDatapoint,
  type TemplateDatapointMapping,
} from "./coverage-types";

const API_URL = process.env.API_URL ?? "http://localhost:8787";

async function authedHeaders(): Promise<Record<string, string>> {
  const auth = await withAuth();
  if (!auth.user || !auth.accessToken) {
    throw new CoverageError("not_signed_in", 401);
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

// ── Datapoint catalog ──────────────────────────────────────────────
export async function getFrameworkDatapoints(
  framework?: Framework,
): Promise<FrameworkDatapoint[]> {
  const headers = await authedHeaders();
  const url = framework
    ? `${API_URL}/framework-datapoints?framework=${framework}`
    : `${API_URL}/framework-datapoints`;
  const res = await fetch(url, { method: "GET", headers, cache: "no-store" });
  if (!res.ok) throw new CoverageError(await readErrorCode(res), res.status);
  return (await res.json()) as FrameworkDatapoint[];
}

// ── Deterministic matrix (fast) ────────────────────────────────────
export async function getCoverageMatrix(
  framework: Framework,
  options: { includeNonApplicable?: boolean } = {},
): Promise<CoverageMatrix> {
  const headers = await authedHeaders();
  const params = options.includeNonApplicable ? "?includeNonApplicable=true" : "";
  const res = await fetch(
    `${API_URL}/framework-coverage/${framework}${params}`,
    { method: "GET", headers, cache: "no-store" },
  );
  if (!res.ok) throw new CoverageError(await readErrorCode(res), res.status);
  return (await res.json()) as CoverageMatrix;
}

// ── AI explanation pass ────────────────────────────────────────────
export async function checkCoverage(
  framework: Framework,
  options: { includeNonApplicable?: boolean } = {},
): Promise<CoverageCheckResult> {
  const headers = await authedHeaders();
  const params = options.includeNonApplicable ? "?includeNonApplicable=true" : "";
  const res = await fetch(
    `${API_URL}/framework-coverage/${framework}/check${params}`,
    { method: "POST", headers },
  );
  if (!res.ok) throw new CoverageError(await readErrorCode(res), res.status);
  return (await res.json()) as CoverageCheckResult;
}

// ── Mappings (read-open, CS-write) ─────────────────────────────────
export async function getMappings(): Promise<TemplateDatapointMapping[]> {
  const headers = await authedHeaders();
  const res = await fetch(`${API_URL}/template-datapoint-mappings`, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  if (!res.ok) throw new CoverageError(await readErrorCode(res), res.status);
  return (await res.json()) as TemplateDatapointMapping[];
}

export async function createMapping(input: {
  templateId: string;
  frameworkDatapointId: string;
}): Promise<TemplateDatapointMapping> {
  const headers = await authedHeaders();
  const res = await fetch(`${API_URL}/template-datapoint-mappings`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new CoverageError(await readErrorCode(res), res.status);
  return (await res.json()) as TemplateDatapointMapping;
}

export async function deleteMapping(id: string): Promise<void> {
  const headers = await authedHeaders();
  const res = await fetch(
    `${API_URL}/template-datapoint-mappings/${encodeURIComponent(id)}`,
    { method: "DELETE", headers },
  );
  if (!res.ok) throw new CoverageError(await readErrorCode(res), res.status);
}
