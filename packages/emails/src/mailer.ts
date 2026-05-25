import nodemailer, { type Transporter } from "nodemailer";

let _transport: Transporter | null = null;

/**
 * Lazily build the nodemailer transport from SMTP_* env vars. Returns null
 * when SMTP isn't configured — callers should treat the email as undelivered
 * and fall back to a copy-link / queue / retry strategy.
 *
 * Dev: defaults match the Mailpit container in docker-compose.yml.
 * Prod: point SMTP_HOST at a real relay (SES, Mailgun, Postmark, …).
 */
export function getMailer(): Transporter | null {
  if (_transport) return _transport;
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT ?? 1025);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  _transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });

  return _transport;
}

export function getDefaultFromAddress(): string {
  return process.env.SMTP_FROM ?? "bGreen <noreply@bgreen.local>";
}
