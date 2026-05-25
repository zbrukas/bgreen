"use server";

// V9.3 — server actions proxying apps/api's /recommendations surface.
// Mirrors the economic-profile-actions.ts pattern: server-only, attaches
// the WorkOS session token + active org id, throws RecommendationsError
// (whose `code` matches the wire envelope) on non-2xx responses.

import { withAuth } from "@workos-inc/authkit-nextjs";
import { getActiveOrgId } from "./active-org";
import {
  type FeedbackKind,
  type GeneratedRecommendation,
  type HistoryEntry,
  type RecommendationFeedback,
  RecommendationsError,
} from "./recommendations-types";

const API_URL = process.env.API_URL ?? "http://localhost:8787";

async function authedHeaders(): Promise<Record<string, string>> {
  const auth = await withAuth();
  if (!auth.user || !auth.accessToken) {
    throw new RecommendationsError("not_signed_in", 401);
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
export async function startRecommendations(): Promise<GeneratedRecommendation> {
  const headers = await authedHeaders();
  const res = await fetch(`${API_URL}/recommendations`, {
    method: "POST",
    headers,
  });
  if (!res.ok) {
    throw new RecommendationsError(await readErrorCode(res), res.status);
  }
  return (await res.json()) as GeneratedRecommendation;
}

// ── Poll one run ───────────────────────────────────────────────────
export async function getRecommendation(id: string): Promise<GeneratedRecommendation> {
  const headers = await authedHeaders();
  const res = await fetch(`${API_URL}/recommendations/${encodeURIComponent(id)}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new RecommendationsError(await readErrorCode(res), res.status);
  }
  return (await res.json()) as GeneratedRecommendation;
}

// ── History view ───────────────────────────────────────────────────
export async function getRecommendationsHistory(): Promise<HistoryEntry[]> {
  const headers = await authedHeaders();
  const res = await fetch(`${API_URL}/recommendations`, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new RecommendationsError(await readErrorCode(res), res.status);
  }
  return (await res.json()) as HistoryEntry[];
}

// ── Record / switch feedback on one item ───────────────────────────
export async function submitRecommendationFeedback(input: {
  generationId: string;
  recommendationIndex: number;
  kind: FeedbackKind;
}): Promise<RecommendationFeedback> {
  const headers = await authedHeaders();
  const res = await fetch(
    `${API_URL}/recommendations/${encodeURIComponent(input.generationId)}/feedback`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        recommendationIndex: input.recommendationIndex,
        kind: input.kind,
      }),
    },
  );
  if (!res.ok) {
    throw new RecommendationsError(await readErrorCode(res), res.status);
  }
  return (await res.json()) as RecommendationFeedback;
}
