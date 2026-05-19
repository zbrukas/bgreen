# apps/api — Hono API

Bounded context: heavy domain logic, AI calls, IES extraction, public API for partners.

## Owns
- All domain modules under `src/modules/` (added per vertical: Identity, Organizations, Records, …).
- AI tool registrations + AnthropicAiClient usage (`packages/ai`).
- Inngest event handlers.
- Public OpenAPI surface (`@hono/zod-openapi`).
- Hono RPC export consumed by `apps/web`.

## Does NOT own
- UI rendering. Belongs in `apps/web`.
- PDF rendering. Belongs in `apps/pdf`.

## Module shape (from V2 onward)

```
src/modules/<name>/
├── domain/
├── application/
├── infrastructure/
├── api/
├── module.ts
└── CLAUDE.md
```

Cross-module reads go through typed Application Ports (interfaces). No cross-module ORM navigations.

## Constraints
- Auth required on every route except `/health`.
- `organization_id` resolved from session on every request, injected into context.
- AI API key server-side only.
