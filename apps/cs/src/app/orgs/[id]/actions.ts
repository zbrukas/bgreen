"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  deleteCsOrg,
  type UpdateOrgInput,
  updateCsOrg,
} from "@/lib/api-client";

// V12.3 follow-up — orgs U + D server actions. apps/cs is a thin BFF
// (no direct DB); these wrap the api-client calls and own the cache
// invalidation + post-action navigation that the client buttons can't
// do across the boundary.

export async function updateOrgAction(
  id: string,
  patch: UpdateOrgInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await updateCsOrg(id, patch);
  if (!result.ok) return result;
  revalidatePath(`/orgs/${id}`);
  revalidatePath("/orgs");
  return { ok: true };
}

export async function deleteOrgAction(
  id: string,
): Promise<{ ok: false; error: string }> {
  const result = await deleteCsOrg(id);
  if (!result.ok) return result;
  revalidatePath("/orgs");
  redirect("/orgs");
}
