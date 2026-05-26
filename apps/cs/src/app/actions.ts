"use server";

import {
  CS_SESSION_COOKIE,
  type ReviewDecision,
  addCsDomain,
  archiveTemplate,
  createCsUser,
  createTemplate,
  createTopic,
  deleteCsDomain,
  deleteCsUser,
  deleteTopic,
  publishTemplate,
  reviewCsRecord,
  updateCsUserRole,
} from "@/lib/api-client";
import type {
  CentralServicesRole,
  FormSchema,
  RecordTemplate,
  WorkflowDefinitionId,
} from "@bgreen/types";
import { CentralServicesRoleSchema, FormSchemaSchema, TopicSlugSchema } from "@bgreen/types";
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

// ---------- CS users (admin only) ----------

export interface AddCsUserFormState {
  error: string | null;
}

function translateCsUserError(code: string): string {
  switch (code) {
    case "email_taken":
      return "Já existe um utilizador CS com este email.";
    case "email_belongs_to_org_user":
      return "Este email pertence a um utilizador de organização.";
    case "cannot_demote_self":
      return "Não pode rebaixar-se a si próprio.";
    case "cannot_delete_self":
      return "Não pode remover a sua própria conta.";
    case "last_admin":
      return "É necessário pelo menos um administrador CS — promova outro utilizador primeiro.";
    case "central_services_admin_required":
      return "Apenas administradores CS podem fazer isto.";
    case "not_found":
      return "Utilizador não encontrado.";
    default:
      return `Erro: ${code}`;
  }
}

export async function addCsUserAction(
  _prev: AddCsUserFormState,
  formData: FormData,
): Promise<AddCsUserFormState> {
  const emailRaw = formData.get("email");
  const roleRaw = formData.get("role");
  const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
  if (!email) return { error: "Indique um email." };
  const roleParsed = CentralServicesRoleSchema.safeParse(roleRaw);
  if (!roleParsed.success) return { error: "Papel inválido." };
  const result = await createCsUser({ email, role: roleParsed.data });
  if (!result.ok) return { error: translateCsUserError(result.error) };
  revalidatePath("/users");
  return { error: null };
}

// CsUserActionState + initialCsUserActionState live in
// users/users-action-state.ts. A "use server" file can only export
// async functions, so const exports here would trip Next's
// invalid-use-server-value check. Type-only imports are erased and
// therefore safe.
import type { CsUserActionState } from "./users/users-action-state";

export async function updateCsUserRoleAction(
  _prev: CsUserActionState,
  formData: FormData,
): Promise<CsUserActionState> {
  const id = formData.get("id");
  const roleRaw = formData.get("role");
  if (typeof id !== "string" || id === "") {
    return { ok: false, error: "ID inválido." };
  }
  const roleParsed = CentralServicesRoleSchema.safeParse(roleRaw);
  if (!roleParsed.success) return { ok: false, error: "Papel inválido." };
  const result = await updateCsUserRole({ id, role: roleParsed.data });
  if (!result.ok) return { ok: false, error: translateCsUserError(result.error) };
  revalidatePath("/users");
  return { ok: true };
}

export async function deleteCsUserAction(
  _prev: CsUserActionState,
  formData: FormData,
): Promise<CsUserActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || id === "") {
    return { ok: false, error: "ID inválido." };
  }
  const result = await deleteCsUser(id);
  if (!result.ok) return { ok: false, error: translateCsUserError(result.error) };
  revalidatePath("/users");
  return { ok: true };
}

// Re-export so the page can narrow when displaying labels.
export type { CentralServicesRole };
