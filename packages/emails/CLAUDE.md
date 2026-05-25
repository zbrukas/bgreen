# packages/emails — transactional email templates

Bounded context: transactional email content.

## Owns
- ETA templates under `templates/` (one `.html.eta` + one `.txt.eta`
  per email). Variables are escaped by default via `<%= %>`; raw
  output via `<%~ %>` is reserved for trusted strings (and there
  aren't any today).
- Nodemailer transport wrapper (`mailer.ts`). SMTP_* env vars
  configure host/port/auth; unconfigured → `getMailer()` returns
  null and callers treat the email as undelivered.
- Per-email modules (`invite-email.ts`, `report-ready-email.ts`)
  that build typed template data + render via `renderEmailTemplate`.

## Does NOT own
- Sending logic that composes with other modules (call sites live in
  `apps/api`).
- Hosted-API providers (Resend / SendGrid / Postmark). We talk plain
  SMTP via nodemailer; choose any of those as the relay by setting
  SMTP_HOST + credentials.

## Templates layout
```
packages/emails/
├── src/            # render code + per-email modules
└── templates/      # ETA .html.eta + .txt.eta files
```
`templates/` is resolved at runtime via `import.meta.url` from
`renderer.ts`, so it stays a sibling of `src/`. Don't move it
without updating that path.

## Rule
- Per-email modules build a typed `*TemplateData` shape, render
  HTML + text via `renderEmailTemplate`, and pass both to nodemailer.
- HTML escaping is ETA's job — no manual `escapeHtml` in render
  code anymore.
