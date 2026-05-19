# packages/types — Shared zod schemas

Single source of truth for: request/response shapes, OpenAPI emission, Hono RPC type inference, Anthropic tool definitions, Drizzle column type inference where applicable.

## Owns
- Cross-package zod schemas.

## Does NOT own
- DB schema (lives in `packages/db`).
- Tool implementations (live in `packages/ai`).
- Domain logic.

## Rule
- One zod schema → many derived artifacts. Never duplicate a schema across the repo.
