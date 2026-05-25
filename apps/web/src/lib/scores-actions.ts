"use server";

// V8.3 — server action proxying GET /records/scores. Returns the
// per-template grouped score history shape the dashboard renders.

import { withAuth } from "@workos-inc/authkit-nextjs";
import { getActiveOrgId } from "./active-org";
import { IesError } from "./economic-profile-types";

const API_URL = process.env.API_URL ?? "http://localhost:8787";

export interface RecordScorePoint {
  recordId: string;
  total: number;
  percent: number;
  tier: string;
  submittedAt: string;
}

export interface TemplateScoreHistory {
  templateId: string;
  templateName: string;
  scores: RecordScorePoint[];
}

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

export async function getScores(): Promise<TemplateScoreHistory[]> {
  const headers = await authedHeaders();
  const res = await fetch(`${API_URL}/records/scores`, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new IesError(body.error ?? "request_failed", res.status);
  }
  return (await res.json()) as TemplateScoreHistory[];
}
