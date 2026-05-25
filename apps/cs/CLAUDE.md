# apps/cs — Next.js Central Services console

Bounded context: everything Central Services operators (admin / maintainer / promoter) need. Template authoring, cross-org review of submissions, CS user + domain + topic admin.

## Owns
- Routes (App Router under `src/app/`).
- Server actions + route handlers acting as a thin BFF.
- Local email+password auth (`cs_session` cookie — set in V5.7, distinct from web's WorkOS flow).
- Per-app `AppShell` / `AuthenticatedShell` (Carbon UI Shell themed for bGreen).

## Does NOT own
- Heavy domain logic. Belongs in `apps/api` modules.
- AI calls. Belongs in `apps/api`.
- Cross-app shared UI primitives — `PageHeader`, `EmptyState`, `StatCard` live in `packages/ui`.

## Calling apps/api
Use Hono RPC client. CS-namespaced endpoints under `/cs/*` (inbox, records, users, domains).

## UI stack
- **`@carbon/react`** themed for bGreen — same palette + tokens as `apps/web` (theme overrides in `src/styles/carbon-theme.css`, mirrored from web).
- **Tailwind v4** for page-level layout glue only.
- **IBM Plex Sans + Mono** self-hosted via `@ibm/plex-*` packages.
- **shadcn/ui primitives** in `src/components/ui/*` survive in the `TemplateEditor` sub-components until that editor gets its own Carbon migration (the plan's "biggest visual win" — drag handles, field-type icons, nesting indicator). New UI should use Carbon.
- Same server→client renderIcon caveat as web — extract a `"use client"` wrapper for header-action buttons in server components.

## Auth model
- Middleware checks `cs_session` cookie on every request; redirects to `/login` if missing.
- Public paths: `/login`, `/setup-password`, `/design` (dev showcase).
- Roles (from `MeResponse.centralServicesRole`): `admin` (full), `maintainer` (template authoring + review), `promoter` (publish-only).

## Constraints
- UI copy in pt-PT.
- No client-side AI calls.
