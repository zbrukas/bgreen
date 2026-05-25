// V11.3 — "Relatório pronto" email. Sent by ReportService after
// the PDF lands in S3. The link points at the in-app report detail
// page (which gates by membership before redirecting to a presigned
// S3 URL) rather than directly at S3 — the same posture as the
// invite-email pattern.

import { getDefaultFromAddress, getMailer } from "./mailer";

export interface ReportReadyEmailInput {
  to: string;
  organizationName: string;
  reportTitle: string;
  // Deep-link into the bGreen app, NOT a direct S3 URL. The app
  // checks org membership before producing a presigned download URL.
  downloadUrl: string;
  // ISO timestamp surfaced in the body ("gerado a 2026-05-25 12:34
  // UTC").
  generatedAt: string;
}

export interface ReportReadyEmailResult {
  delivered: boolean;
  reason?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatGeneratedAt(iso: string): string {
  // Deterministic UTC formatting — same approach the PDF template
  // uses so users see the same string in the email + on the cover.
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    ` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
  );
}

function renderHtml(input: ReportReadyEmailInput): string {
  const generated = formatGeneratedAt(input.generatedAt);
  return `<!doctype html>
<html lang="pt-PT">
  <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #222;">
    <p>Olá,</p>
    <p>
      O relatório <strong>${escapeHtml(input.reportTitle)}</strong> de
      <strong>${escapeHtml(input.organizationName)}</strong> está pronto para descarregar.
    </p>
    <p>
      <a href="${escapeHtml(input.downloadUrl)}"
         style="display:inline-block;padding:0.75rem 1.25rem;background:#1f7a3d;color:#fff;text-decoration:none;border-radius:0.25rem;">
        Abrir relatório
      </a>
    </p>
    <p style="color:#555;font-size:0.9rem;">Se o botão não funcionar, copie este endereço:</p>
    <p style="font-family:monospace;font-size:0.85rem;word-break:break-all;">${escapeHtml(input.downloadUrl)}</p>
    <hr style="border:none;border-top:1px solid #eee;margin:1.5rem 0;" />
    <p style="color:#777;font-size:0.8rem;">
      Gerado a ${escapeHtml(generated)}. O conteúdo está sujeito à validação humana.
    </p>
  </body>
</html>`;
}

function renderText(input: ReportReadyEmailInput): string {
  const generated = formatGeneratedAt(input.generatedAt);
  return [
    "Olá,",
    "",
    `O relatório "${input.reportTitle}" de ${input.organizationName} está pronto para descarregar.`,
    "",
    "Abrir relatório:",
    input.downloadUrl,
    "",
    `Gerado a ${generated}. O conteúdo está sujeito à validação humana.`,
  ].join("\n");
}

export async function sendReportReadyEmail(
  input: ReportReadyEmailInput,
): Promise<ReportReadyEmailResult> {
  const mailer = getMailer();
  if (!mailer) {
    return { delivered: false, reason: "smtp_not_configured" };
  }
  try {
    await mailer.sendMail({
      from: getDefaultFromAddress(),
      to: input.to,
      subject: `Relatório pronto — ${input.reportTitle}`,
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
