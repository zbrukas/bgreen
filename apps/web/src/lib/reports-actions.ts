"use server";

// V11.4 — server actions proxying apps/api's /reports surface.
// Same posture as recommendations-actions: server-only, attaches the
// WorkOS session token + active org id, throws ReportsError on
// non-2xx responses.

import { withAuth } from "@workos-inc/authkit-nextjs";
import { getActiveOrgId } from "./active-org";
import {
  type ReportInstance,
  ReportsError,
  type ReportTemplateId,
} from "./reports-types";

const API_URL = process.env.API_URL ?? "http://localhost:8787";

async function authedHeaders(): Promise<Record<string, string>> {
  const auth = await withAuth();
  if (!auth.user || !auth.accessToken) {
    throw new ReportsError("not_signed_in", 401);
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

// ── Start a generation run ─────────────────────────────────────────
export async function startReport(input: {
  template: ReportTemplateId;
  periodStart: string;
  periodEnd: string;
  customTitle?: string;
}): Promise<ReportInstance> {
  const headers = await authedHeaders();
  const res = await fetch(`${API_URL}/reports`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new ReportsError(await readErrorCode(res), res.status);
  }
  return (await res.json()) as ReportInstance;
}

// ── Poll one run ───────────────────────────────────────────────────
export async function getReport(id: string): Promise<ReportInstance> {
  const headers = await authedHeaders();
  const res = await fetch(`${API_URL}/reports/${encodeURIComponent(id)}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new ReportsError(await readErrorCode(res), res.status);
  }
  return (await res.json()) as ReportInstance;
}

// ── History ────────────────────────────────────────────────────────
export async function getReportsHistory(): Promise<ReportInstance[]> {
  const headers = await authedHeaders();
  const res = await fetch(`${API_URL}/reports`, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new ReportsError(await readErrorCode(res), res.status);
  }
  return (await res.json()) as ReportInstance[];
}

// ── Download URL ───────────────────────────────────────────────────
// apps/api responds with a 302 redirect to a presigned S3 URL. We
// follow the redirect manually so the server action can return the
// final URL string to the client without exposing the bearer token in
// the browser's fetch.
export async function getReportDownloadUrl(id: string): Promise<string> {
  const headers = await authedHeaders();
  const res = await fetch(
    `${API_URL}/reports/${encodeURIComponent(id)}/download`,
    {
      method: "GET",
      headers,
      // Don't follow — we want the Location header to read out the
      // presigned URL.
      redirect: "manual",
    },
  );
  if (res.status === 302) {
    const url = res.headers.get("location");
    if (!url) throw new ReportsError("no_location", 500);
    return url;
  }
  if (!res.ok) {
    throw new ReportsError(await readErrorCode(res), res.status);
  }
  // Fallback for environments where manual redirect mode resolves to
  // 200 with the URL in the body (some proxies rewrite 302s).
  const body = (await res.json().catch(() => ({}))) as { url?: string };
  if (!body.url) throw new ReportsError("no_location", 500);
  return body.url;
}
