"use server";

import { setActiveOrgId } from "@/lib/active-org";
import {
  type CaeEntry,
  type PostalCodeLookupResult,
  type ViesLookupResult,
  acceptInvite,
  createInvite,
  createOrganization,
  createRecord,
  fetchMyOrganizations,
  findCaeByCode,
  lookupPostalCode,
  lookupVies,
  searchCae,
  updateMember,
  updateRecord,
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

  const stringOrNull = (raw: FormDataEntryValue | null): string | null => {
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    return trimmed === "" ? null : trimmed;
  };
  const postalCodeRaw = formData.get("postalCode");
  let postalCode: string | null = null;
  if (typeof postalCodeRaw === "string" && postalCodeRaw.trim() !== "") {
    const trimmed = postalCodeRaw.trim();
    if (!/^\d{4}-\d{3}$/.test(trimmed)) {
      return { error: "Código postal inválido. Use o formato XXXX-XXX." };
    }
    postalCode = trimmed;
  }
  const addressLine = stringOrNull(formData.get("addressLine"));
  const freguesia = stringOrNull(formData.get("freguesia"));
  const concelho = stringOrNull(formData.get("concelho"));
  const distrito = stringOrNull(formData.get("distrito"));

  const result = await createOrganization({
    name,
    nif,
    caeCode,
    legalForm,
    selfReportedSize,
    postalCode,
    addressLine,
    freguesia,
    concelho,
    distrito,
  });
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

  let role: MembershipRole = "org_user_write";
  if (typeof rawRole === "string") {
    const parsed = MembershipRoleSchema.safeParse(rawRole);
    if (!parsed.success) {
      return { ...emptyInviteState, error: "Papel inválido." };
    }
    role = parsed.data;
  }

  // V5.6c: topic scope arrives as one form field per checked topic.
  const topicScope = formData
    .getAll("topicScope")
    .filter((v): v is string => typeof v === "string" && v.length > 0);

  const result = await createInvite({ organizationId, email, role, topicScope });
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

export async function lookupViesAction(nif: string): Promise<ViesLookupResult | null> {
  if (typeof nif !== "string" || nif.trim() === "") return null;
  return lookupVies(nif.trim());
}

export async function lookupPostalCodeAction(cp: string): Promise<PostalCodeLookupResult | null> {
  if (typeof cp !== "string" || cp.trim() === "") return null;
  return lookupPostalCode(cp.trim());
}

export async function searchCaeAction(query: string): Promise<CaeEntry[]> {
  if (typeof query !== "string" || query.trim() === "") return [];
  return searchCae(query.trim(), 30);
}

export async function findCaeByCodeAction(code: string): Promise<CaeEntry | null> {
  if (typeof code !== "string" || code.trim() === "") return null;
  return findCaeByCode(code.trim());
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

// ---------- Records ----------

export type SubmitRecordActionInput =
  | { mode: "create"; templateId: string; values: Record<string, unknown>; asDraft: boolean }
  | {
      mode: "update";
      id: string;
      values: Record<string, unknown>;
      action: "save_draft" | "submit";
    };

export type SubmitRecordActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: import("@bgreen/form-engine").FormError[] };

export async function submitRecordAction(
  input: SubmitRecordActionInput,
): Promise<SubmitRecordActionResult> {
  const result =
    input.mode === "create"
      ? await createRecord({
          templateId: input.templateId,
          values: input.values,
          asDraft: input.asDraft,
        })
      : await updateRecord({ id: input.id, values: input.values, action: input.action });

  if (!result.ok) {
    return { ok: false, error: result.error, fieldErrors: result.fieldErrors };
  }
  revalidatePath("/records");
  revalidatePath(`/records/${result.record.id}`);
  return { ok: true, id: result.record.id };
}

// ---------- Members ----------

export interface UpdateMemberFormState {
  error: string | null;
  saved: boolean;
}

export async function updateMemberAction(
  organizationId: string,
  userId: string,
  _prev: UpdateMemberFormState,
  formData: FormData,
): Promise<UpdateMemberFormState> {
  const rawRole = formData.get("role");
  let role: MembershipRole | undefined;
  if (typeof rawRole === "string" && rawRole !== "") {
    const parsed = MembershipRoleSchema.safeParse(rawRole);
    if (!parsed.success) return { error: "Papel inválido.", saved: false };
    role = parsed.data;
  }
  const topicScope = formData
    .getAll("topicScope")
    .filter((v): v is string => typeof v === "string" && v.length > 0);
  const result = await updateMember({ organizationId, userId, role, topicScope });
  if (!result.ok) {
    if (result.error === "cannot_demote_self") {
      return { error: "Não pode rebaixar-se a si próprio.", saved: false };
    }
    return { error: `Não foi possível atualizar o membro (${result.error}).`, saved: false };
  }
  revalidatePath(`/organizations/${organizationId}/members`);
  revalidatePath(`/organizations/${organizationId}/members/${userId}`);
  return { error: null, saved: true };
}
