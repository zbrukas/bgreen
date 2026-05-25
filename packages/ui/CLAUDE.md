# packages/ui — Shared Carbon-themed components

Components imported by both `apps/web` and `apps/cs` to avoid drift.

## Owns
- `PageHeader` — title + description + icon + breadcrumb + actions slot.
- `EmptyState` — illustration + title + description + primary/secondary actions.
- `StatCard` — big number + optional sparkline + tier Tag + delta + icon, optional href makes it a ClickableTile.

## Does NOT own
- App shells (`AppShell` / `AuthenticatedShell`) — per-app because nav items, auth flow, and org switcher differ between web and CS.
- Theme tokens — `carbon-theme.css` is duplicated per-app for now (cross-package CSS imports add Next.js build complexity).
- Form-engine internals — `packages/form-engine` owns those.

## Rule
- Components here must not import app-specific paths (`@/app/actions`, etc.) — they take everything they need as props.
- "use client" only when Carbon icon prop refs (`renderIcon={…}`) actually cross the server→client boundary inside the component.
