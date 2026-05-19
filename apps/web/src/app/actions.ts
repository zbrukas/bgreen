"use server";

import { setActiveOrgId } from "@/lib/active-org";
import { createOrganization } from "@/lib/api-client";
import type { LegalForm } from "@bgreen/types";
import { LegalFormSchema } from "@bgreen/types";
import { signOut } from "@workos-inc/authkit-nextjs";
import { revalidatePath } from "next/cache";

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
  return { error: null };
}
