"use server";

import {
  type CsCohortActivationResult,
  type CsHealthDetail,
  fetchCsCohortActivation,
  fetchCsHealthDetail,
} from "@/lib/api-client";

// V12.3 — server actions for the /health drawer + cohort chart. The
// underlying fetchers live in lib/api-client which imports
// `next/headers` (for the cs_session cookie); that file can't be
// imported from a "use client" boundary or Next refuses the build.
// Server actions are the App-Router-correct way to expose them to
// client components.

export async function getHealthDetail(
  organizationId: string,
): Promise<CsHealthDetail | null> {
  return fetchCsHealthDetail(organizationId);
}

export async function getCohortActivation(
  cohortMonth: string,
): Promise<CsCohortActivationResult | null> {
  return fetchCsCohortActivation(cohortMonth);
}
