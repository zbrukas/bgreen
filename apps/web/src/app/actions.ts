"use server";

import { setActiveOrgId } from "@/lib/active-org";
import {
  acceptInvite,
  createInvite,
  createOrganization,
  fetchMyOrganizations,
} from "@/lib/api-client";
import { validateNif } from "@bgreen/pt-data";
import type { LegalForm, MembershipRole, OrganizationSize } from "@bgreen/types";
import { LegalFormSchema, MembershipRoleSchema, OrganizationSizeSchema } from "@bgreen/types";
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
  const rawNif = formData.get("nif");
  const rawCae = formData.get("caeCode");
  const rawLegalForm = formData.get("legalForm");
  const rawSize = formData.get("selfReportedSize");

  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (!name) {
    return { error: "Indique um nome para a organização." };
  }

  let nif: string | null = null;
  if (typeof rawNif === "string" && rawNif.trim() !== "") {
    const nifResult = validateNif(rawNif);
    if (!nifResult.valid) {
      return { error: "NIF inválido. Verifique os 9 dígitos e o dígito de controlo." };
    }
    nif = nifResult.normalized;
  }

  let caeCode: string | null = null;
  if (typeof rawCae === "string" && rawCae.trim() !== "") {
    const trimmed = rawCae.trim();
    if (!/^\d{3,5}$/.test(trimmed)) {
      return { error: "CAE inválido." };
    }
    caeCode = trimmed;
  }

  let legalForm: LegalForm | null = null;
  if (typeof rawLegalForm === "string" && rawLegalForm !== "") {
    const parsed = LegalFormSchema.safeParse(rawLegalForm);
    if (!parsed.success) {
      return { error: "Forma jurídica inválida." };
    }
    legalForm = parsed.data;
  }

  let selfReportedSize: OrganizationSize | null = null;
  if (typeof rawSize === "string" && rawSize !== "") {
    const parsed = OrganizationSizeSchema.safeParse(rawSize);
    if (!parsed.success) {
      return { error: "Dimensão inválida." };
    }
    selfReportedSize = parsed.data;
  }

  const result = await createOrganization({ name, nif, caeCode, legalForm, selfReportedSize });
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

export interface CreateInviteFormState {
  error: string | null;
  acceptUrl: string | null;
  invitedEmail: string | null;
  emailDelivered: boolean | null;
  emailReason: string | null;
}

const emptyInviteState: CreateInviteFormState = {
  error: null,
  acceptUrl: null,
  invitedEmail: null,
  emailDelivered: null,
  emailReason: null,
};

export async function createInviteAction(
  organizationId: string,
  _prev: CreateInviteFormState,
  formData: FormData,
): Promise<CreateInviteFormState> {
  const rawEmail = formData.get("email");
  const rawRole = formData.get("role");
  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";
  if (!email) {
    return { ...emptyInviteState, error: "Indique um email." };
  }

  let role: MembershipRole = "member";
  if (typeof rawRole === "string") {
    const parsed = MembershipRoleSchema.safeParse(rawRole);
    if (!parsed.success) {
      return { ...emptyInviteState, error: "Papel inválido." };
    }
    role = parsed.data;
  }

  const result = await createInvite({ organizationId, email, role });
  if ("error" in result) {
    return {
      ...emptyInviteState,
      error: `Não foi possível criar o convite (${result.error}).`,
    };
  }
  return {
    error: null,
    acceptUrl: result.acceptUrl,
    invitedEmail: result.invitedEmail,
    emailDelivered: result.emailDelivered,
    emailReason: result.emailReason,
  };
}

export async function acceptInviteAction(formData: FormData): Promise<void> {
  const token = formData.get("token");
  if (typeof token !== "string" || token.length === 0) return;
  const result = await acceptInvite(token);
  if ("error" in result) return;
  await setActiveOrgId(result.organizationId);
  revalidatePath("/");
  redirect("/");
}
