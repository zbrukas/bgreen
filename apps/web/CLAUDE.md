# apps/web — Next.js UI + thin BFF

Bounded context: anything the user sees. Server-rendered pages, server actions for fast reads, light client interactivity.

## Owns
- Routes (App Router under `src/app/`).
- Server actions + route handlers acting as a thin BFF.
- Auth session reads (WorkOS AuthKit — from V2).
- Per-app `AppShell` / `AuthenticatedShell` (Carbon UI Shell themed for bGreen).

## Does NOT own
- Heavy domain logic. Belongs in `apps/api` modules.
- AI calls. Belongs in `apps/api` (Anthropic API key never reaches the browser/SSR).
- Background jobs. Belongs in `apps/api` (Inngest handlers).
- PDF generation. Belongs in `apps/pdf`.
- Cross-app shared UI primitives — `PageHeader`, `EmptyState`, `StatCard` live in `packages/ui`.

## Calling apps/api
Use Hono RPC client — typed end-to-end. No codegen.

## UI stack
- **`@carbon/react`** themed for bGreen (mint leaf / shadow grey / cinnabar / fern / jasmine). Theme overrides in `src/styles/carbon-theme.css`.
- **Tailwind v4** for page-level layout / margins / grids only. Carbon owns components.
- **IBM Plex Sans + Mono** self-hosted via `@ibm/plex-*` packages.
- **shadcn/ui primitives** in `src/components/ui/*` survive in inner form bodies (`RecordForm`, `CreateOrganizationForm`, etc.) until those forms get their own Carbon migration. New UI should use Carbon.
- Server components can't pass Carbon icon function refs (`renderIcon={…}`) across the server→client boundary — extract a small `"use client"` wrapper for any header-action button.

## Constraints
- UI copy in pt-PT (`next-intl` from V3+).
- No client-side AI calls.
- Tenant scope resolves from the WorkOS session on every request.
