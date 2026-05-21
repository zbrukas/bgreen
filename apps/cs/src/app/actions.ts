"use server";

import {
  type ReviewDecision,
  addCsDomain,
  archiveTemplate,
  createTemplate,
  deleteCsDomain,
  publishTemplate,
  reviewCsRecord,
} from "@/lib/api-client";
import type { FormSchema, RecordTemplate, WorkflowDefinitionId } from "@bgreen/types";
import { FormSchemaSchema } from "@bgreen/types";
import { signOut } from "@workos-inc/authkit-nextjs";
import { revalidatePath } from "next/cache";

export async function signOutAction(): Promise<void> {
  await signOut();
}

// ---------- Templates ----------

export interface CreateTemplateInput {
  name: string;
  description: string | null;
  formSchema: unknown;
  workflowDefinitionId?: WorkflowDefinitionId;
}

export interface CreateTemplateFormState {
  error: string | null;
  created: RecordTemplate | null;
}

export async function createTemplateAction(
  _prev: CreateTemplateFormState,
  input: CreateTemplateInput,
): Promise<CreateTemplateFormState> {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) {
    return { error: "Indique um nome para o modelo.", created: null };
  }
  const parsed = FormSchemaSchema.safeParse(input.formSchema);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      error: `Schema inválido: ${first?.path.join(".") || "(raiz)"} — ${first?.message ?? ""}`,
      created: null,
    };
  }
  const result = await createTemplate({
    name,
    description: input.description ? input.description.trim() : null,
    formSchema: parsed.data as FormSchema,
    workflowDefinitionId: input.workflowDefinitionId,
  });
  if ("error" in result) {
    return { error: `Não foi possível criar o modelo (${result.error}).`, created: null };
  }
  revalidatePath("/templates");
  return { error: null, created: result };
}

export async function publishTemplateAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || id === "") return;
  const result = await publishTemplate(id);
  if ("error" in result) return;
  revalidatePath("/templates");
  revalidatePath(`/templates/${id}`);
}

export async function archiveTemplateAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || id === "") return;
  const result = await archiveTemplate(id);
  if ("error" in result) return;
  revalidatePath("/templates");
  revalidatePath(`/templates/${id}`);
}

// ---------- Review ----------

export type ReviewRecordActionResult = { ok: true } | { ok: false; error: string };

export async function reviewRecordAction(input: {
  id: string;
  decision: ReviewDecision;
  comment: string | null;
}): Promise<ReviewRecordActionResult> {
  const trimmed = input.comment?.trim() ?? "";
  const result = await reviewCsRecord({
    id: input.id,
    decision: input.decision,
    comment: trimmed === "" ? null : trimmed,
  });
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/inbox");
  revalidatePath(`/records/${input.id}`);
  return { ok: true };
}

// ---------- Domains ----------

export interface AddDomainFormState {
  error: string | null;
}

export async function addDomainAction(
  _prev: AddDomainFormState,
  formData: FormData,
): Promise<AddDomainFormState> {
  const domainRaw = formData.get("domain");
  const noteRaw = formData.get("note");
  const domain = typeof domainRaw === "string" ? domainRaw.trim().toLowerCase() : "";
  if (!domain) return { error: "Indique um domínio." };
  const note = typeof noteRaw === "string" && noteRaw.trim() !== "" ? noteRaw.trim() : null;
  const result = await addCsDomain({ domain, note });
  if (!result.ok) return { error: `Erro: ${result.error}` };
  revalidatePath("/domains");
  return { error: null };
}

export async function deleteDomainAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || id === "") return;
  await deleteCsDomain(id);
  revalidatePath("/domains");
}
