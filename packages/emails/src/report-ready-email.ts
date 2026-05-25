// V11.3 — "Relatório pronto" email. Sent by ReportService after the
// PDF lands in S3. The link points at the in-app report detail page
// (which gates by membership before redirecting to a presigned S3
// URL) rather than directly at S3 — the same posture as the invite
// email.

import { getDefaultFromAddress, getMailer } from "./mailer";
import { renderEmailTemplate } from "./renderer";

export interface ReportReadyEmailInput {
  to: string;
  organizationName: string;
  reportTitle: string;
  // Deep-link into the bGreen app, NOT a direct S3 URL. The app
  // checks org membership before producing a presigned download URL.
  downloadUrl: string;
  // ISO timestamp; formatted to "yyyy-mm-dd HH:MM UTC" in the body
  // so users see the same string in the email + on the PDF cover.
  generatedAt: string;
}

export interface ReportReadyEmailResult {
  delivered: boolean;
  reason?: string;
}

function formatGeneratedAt(iso: string): string {
  // Deterministic UTC formatting — same approach the PDF template
  // uses so the email + the cover footer agree.
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    ` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
  );
}

interface ReportReadyTemplateData extends Record<string, unknown> {
  organizationName: string;
  reportTitle: string;
  downloadUrl: string;
  generatedAt: string;
}

function buildTemplateData(input: ReportReadyEmailInput): ReportReadyTemplateData {
  return {
    organizationName: input.organizationName,
    reportTitle: input.reportTitle,
    downloadUrl: input.downloadUrl,
    generatedAt: formatGeneratedAt(input.generatedAt),
  };
}

export async function sendReportReadyEmail(
  input: ReportReadyEmailInput,
): Promise<ReportReadyEmailResult> {
  const mailer = getMailer();
  if (!mailer) {
    return { delivered: false, reason: "smtp_not_configured" };
  }
  const data = buildTemplateData(input);
  try {
    await mailer.sendMail({
      from: getDefaultFromAddress(),
      to: input.to,
      subject: `Relatório pronto — ${input.reportTitle}`,
      html: renderEmailTemplate("report-ready.html.eta", data),
      text: renderEmailTemplate("report-ready.txt.eta", data),
    });
    return { delivered: true };
  } catch (err) {
    return {
      delivered: false,
      reason: err instanceof Error ? err.message : "send_failed",
    };
  }
}
