"use server";

import {
  CS_SESSION_COOKIE,
  type ReviewDecision,
  addCsDomain,
  archiveTemplate,
  createTemplate,
  createTopic,
  deleteCsDomain,
  deleteTopic,
  publishTemplate,
  reviewCsRecord,
} from "@/lib/api-client";
import type { FormSchema, RecordTemplate, WorkflowDefinitionId } from "@bgreen/types";
import { FormSchemaSchema, TopicSlugSchema } from "@bgreen/types";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const apiBaseUrl = process.env.API_URL ?? "http://localhost:8787";

// V5.7: cs_session cookie is httpOnly, sameSite=lax, 7-day life.
async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(CS_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(CS_SESSION_COOKIE);
}

export async function signOutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

// ---------- Auth: sign in + setup password ----------

export interface SignInFormState {
  error: string | null;
  redirectToSetupForEmail: string | null;
}

export async function signInAction(
  _prev: SignInFormState,
  formData: FormData,
): Promise<SignInFormState> {
  const emailRaw = formData.get("email");
  const passwordRaw = formData.get("password");
  const email = typeof emailRaw === "string" ? emailRaw.trim() : "";
  const password = typeof passwordRaw === "string" ? passwordRaw : "";
  if (!email || !password) {
    return { error: "Indique email e palavra-passe.", redirectToSetupForEmail: null };
  }
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl}/cs/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch {
    return { error: "Erro de rede ao contactar o servidor.", redirectToSetupForEmail: null };
  }
  if (res.status === 409) {
    return { error: null, redirectToSetupForEmail: email };
  }
  if (!res.ok) {
    return { error: "Credenciais inválidas.", redirectToSetupForEmail: null };
  }
  const data = (await res.json().catch(() => ({}))) as { token?: string };
  if (!data.token) {
    return { error: "Resposta inesperada do servidor.", redirectToSetupForEmail: null };
  }
  await setSessionCookie(data.token);
  redirect("/");
}

export interface SetupPasswordFormState {
  error: string | null;
}

export async function setupPasswordAction(
  _prev: SetupPasswordFormState,
  formData: FormData,
): Promise<SetupPasswordFormState> {
  const emailRaw = formData.get("email");
  const newPasswordRaw = formData.get("newPassword");
  const confirmRaw = formData.get("confirm");
  const email = typeof emailRaw === "string" ? emailRaw.trim() : "";
  const newPassword = typeof newPasswordRaw === "string" ? newPasswordRaw : "";
  const confirm = typeof confirmRaw === "string" ? confirmRaw : "";
  if (!email || !newPassword) return { error: "Indique email e palavra-passe." };
  if (newPassword.length < 12) return { error: "Palavra-passe demasiado curta (mínimo 12)." };
  if (newPassword !== confirm) return { error: "As palavras-passe não coincidem." };
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl}/cs/auth/setup-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, newPassword }),
      cache: "no-store",
    });
  } catch {
    return { error: "Erro de rede ao contactar o servidor." };
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (body.error === "user_not_found") return { error: "Utilizador desconhecido." };
    if (body.error === "password_already_set") {
      return { error: "Palavra-passe já definida — use o ecrã de início de sessão." };
    }
    if (body.error === "not_a_cs_user") return { error: "Esta conta não é Central Services." };
    return { error: "Não foi possível definir a palavra-passe." };
  }
  const data = (await res.json().catch(() => ({}))) as { token?: string };
  if (!data.token) return { error: "Resposta inesperada do servidor." };
  await setSessionCookie(data.token);
  redirect("/");
}

// ---------- Templates ----------

export interface CreateTemplateInput {
  name: string;
  description: string | null;
  formSchema: unknown;
  workflowDefinitionId?: WorkflowDefinitionId;
  topicTagId?: string | null;
  isSubTemplate?: boolean;
  composedSubTemplateIds?: string[];
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
    topicTagId: input.topicTagId ?? null,
    isSubTemplate: input.isSubTemplate ?? false,
    composedSubTemplateIds: input.composedSubTemplateIds ?? [],
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

// ---------- Topics ----------

export interface AddTopicFormState {
  error: string | null;
}

export async function addTopicAction(
  _prev: AddTopicFormState,
  formData: FormData,
): Promise<AddTopicFormState> {
  const slugRaw = formData.get("slug");
  const nameRaw = formData.get("name");
  const slug = typeof slugRaw === "string" ? slugRaw.trim().toLowerCase() : "";
  const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
  if (!slug || !name) return { error: "Indique slug e nome." };
  const slugParsed = TopicSlugSchema.safeParse(slug);
  if (!slugParsed.success) {
    return { error: "Slug inválido — use letras minúsculas, dígitos, '-' ou '_'." };
  }
  const result = await createTopic({ slug: slugParsed.data, name });
  if ("error" in result) return { error: `Erro: ${result.error}` };
  revalidatePath("/topics");
  return { error: null };
}

export async function deleteTopicAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || id === "") return;
  await deleteTopic(id);
  revalidatePath("/topics");
}
