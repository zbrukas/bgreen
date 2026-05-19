"use server";

import { setActiveOrgId } from "@/lib/active-org";
import { createOrganization, fetchMyOrganizations } from "@/lib/api-client";
import type { LegalForm } from "@bgreen/types";
import { LegalFormSchema } from "@bgreen/types";
import { signOut } from "@workos-inc/authkit-nextjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function signOutAction(): Promise<void> {
  await signOut();
}

export interface CreateOrganizationFormState {
  error: string | null;
}

export async function createOrganizationAction(
  _prev: CreateOrganizationFormState,
  formData: FormData,
): Promise<CreateOrganizationFormState> {
  const rawName = formData.get("name");
  const rawLegalForm = formData.get("legalForm");
  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (!name) {
    return { error: "Indique um nome para a organização." };
  }
  let legalForm: LegalForm | null = null;
  if (typeof rawLegalForm === "string" && rawLegalForm !== "") {
    const parsed = LegalFormSchema.safeParse(rawLegalForm);
    if (!parsed.success) {
      return { error: "Forma jurídica inválida." };
    }
    legalForm = parsed.data;
  }

  const result = await createOrganization({ name, legalForm });
  if ("error" in result) {
    return { error: `Não foi possível criar a organização (${result.error}).` };
  }

  await setActiveOrgId(result.id);
  revalidatePath("/");
  redirect("/");
}

export async function switchActiveOrganizationAction(formData: FormData): Promise<void> {
  const targetId = formData.get("organizationId");
  if (typeof targetId !== "string" || targetId.length === 0) return;

  // Re-verify membership server-side; never trust the form value alone.
  const orgs = await fetchMyOrganizations();
  if (!orgs.some((o) => o.id === targetId)) return;

  await setActiveOrgId(targetId);
  revalidatePath("/");
}
