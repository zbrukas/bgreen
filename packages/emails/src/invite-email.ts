import { getDefaultFromAddress, getMailer } from "./mailer";

export interface InviteEmailInput {
  to: string;
  organizationName: string;
  inviterEmail: string;
  role: "org_admin" | "org_user_write" | "org_user_read";
  acceptUrl: string;
}

export interface InviteEmailResult {
  delivered: boolean;
  reason?: string;
}

const roleCopy = {
  org_admin: "administrador",
  org_user_write: "membro",
  org_user_read: "membro com acesso de leitura",
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtml(input: InviteEmailInput): string {
  const role = roleCopy[input.role];
  return `<!doctype html>
<html lang="pt-PT">
  <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #222;">
    <p>Olá,</p>
    <p>
      <strong>${escapeHtml(input.inviterEmail)}</strong> convidou-o(a) para se juntar a
      <strong>${escapeHtml(input.organizationName)}</strong> na bGreen como
      <strong>${escapeHtml(role)}</strong>.
    </p>
    <p>
      <a href="${escapeHtml(input.acceptUrl)}"
         style="display:inline-block;padding:0.75rem 1.25rem;background:#1f7a3d;color:#fff;text-decoration:none;border-radius:0.25rem;">
        Aceitar convite
      </a>
    </p>
    <p style="color:#555;font-size:0.9rem;">Se o botão não funcionar, copie este endereço:</p>
    <p style="font-family:monospace;font-size:0.85rem;word-break:break-all;">${escapeHtml(input.acceptUrl)}</p>
    <hr style="border:none;border-top:1px solid #eee;margin:1.5rem 0;" />
    <p style="color:#777;font-size:0.8rem;">
      Este convite é válido durante 7 dias. Se não esperava recebê-lo, ignore esta mensagem.
    </p>
  </body>
</html>`;
}

function renderText(input: InviteEmailInput): string {
  const role = roleCopy[input.role];
  return [
    "Olá,",
    "",
    `${input.inviterEmail} convidou-o(a) para se juntar a ${input.organizationName} na bGreen como ${role}.`,
    "",
    "Aceitar convite:",
    input.acceptUrl,
    "",
    "Este convite é válido durante 7 dias.",
  ].join("\n");
}

export async function sendInviteEmail(input: InviteEmailInput): Promise<InviteEmailResult> {
  const mailer = getMailer();
  if (!mailer) {
    return { delivered: false, reason: "smtp_not_configured" };
  }

  try {
    await mailer.sendMail({
      from: getDefaultFromAddress(),
      to: input.to,
      subject: `Convite para ${input.organizationName}`,
      html: renderHtml(input),
      text: renderText(input),
    });
    return { delivered: true };
  } catch (err) {
    return {
      delivered: false,
      reason: err instanceof Error ? err.message : "send_failed",
    };
  }
}
