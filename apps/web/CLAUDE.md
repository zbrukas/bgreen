# apps/web — Next.js UI + thin BFF

Bounded context: anything the user sees. Server-rendered pages, server actions for fast reads, light client interactivity.

## Owns
- Routes (App Router under `src/app/`).
- Server actions + route handlers acting as a thin BFF.
- Auth session reads (WorkOS AuthKit — from V2).
- UI components (shadcn/ui + Tailwind — from V2).

## Does NOT own
- Heavy domain logic. Belongs in `apps/api` modules.
- AI calls. Belongs in `apps/api` (Anthropic API key never reaches the browser/SSR).
- Background jobs. Belongs in `apps/api` (Inngest handlers).
- PDF generation. Belongs in `apps/pdf`.

## Calling apps/api
Use Hono RPC client — typed end-to-end. No codegen.

## Constraints
- UI copy in pt-PT (`next-intl` from V3+).
- No client-side AI calls.
- Tenant scope resolves from the WorkOS session on every request.
