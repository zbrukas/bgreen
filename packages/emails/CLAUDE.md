# packages/emails — React-Email templates

Bounded context: transactional email content.

## Owns
- React-Email templates ("Relatório pronto", invite emails, etc.).
- Resend client wrapper.

## Does NOT own
- Sending logic that composes with other modules (call sites live in `apps/api`).
