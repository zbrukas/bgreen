import { getDefaultFromAddress, getMailer } from "./mailer";
import { renderEmailTemplate } from "./renderer";

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

const roleLabel: Record<InviteEmailInput["role"], string> = {
  org_admin: "administrador",
  org_user_write: "membro",
  org_user_read: "membro com acesso de leitura",
};

interface InviteTemplateData extends Record<string, unknown> {
  organizationName: string;
  inviterEmail: string;
  acceptUrl: string;
  roleLabel: string;
}

function buildTemplateData(input: InviteEmailInput): InviteTemplateData {
  return {
    organizationName: input.organizationName,
    inviterEmail: input.inviterEmail,
    acceptUrl: input.acceptUrl,
    roleLabel: roleLabel[input.role],
  };
}

export async function sendInviteEmail(input: InviteEmailInput): Promise<InviteEmailResult> {
  const mailer = getMailer();
  if (!mailer) {
    return { delivered: false, reason: "smtp_not_configured" };
  }
  const data = buildTemplateData(input);
  try {
    await mailer.sendMail({
      from: getDefaultFromAddress(),
      to: input.to,
      subject: `Convite para ${input.organizationName}`,
      html: renderEmailTemplate("invite.html.eta", data),
      text: renderEmailTemplate("invite.txt.eta", data),
    });
    return { delivered: true };
  } catch (err) {
    return {
      delivered: false,
      reason: err instanceof Error ? err.message : "send_failed",
    };
  }
}
