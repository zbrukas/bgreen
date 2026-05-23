# bGreen

ESG data collection, AI-powered recommendations, and regulator-ready PDFs for Portuguese mid-caps.

Planning lives here:
- **Master PRD:** [`plans/bgreen-greenfield-rewrite.md`](plans/bgreen-greenfield-rewrite.md)
- **Vertical plans (V1–V10):** [`plans/bgreen/`](plans/bgreen/)

## Stack

- TypeScript end-to-end
- Next.js 15 (App Router) for `apps/web`
- Hono on Node 22 for `apps/api` and `apps/pdf`
- Postgres 16 + Drizzle ORM
- WorkOS AuthKit + FGA *(from V2)*
- Claude Sonnet 4.x via `@anthropic-ai/sdk` *(from V6)*
- Inngest for background jobs
- Gotenberg for PDF rendering *(from V10)*
- Biome for lint + format
- Vitest for unit tests
- pnpm + Turborepo

## Prerequisites

- Node.js 22 LTS (see `.nvmrc`)
- pnpm 9.15+ (`corepack enable && corepack prepare pnpm@9.15.4 --activate`)
- Docker Desktop (for local Postgres + Gotenberg)

## Local development

```bash
# 1. Install dependencies
pnpm install

# 2. Bring up Postgres + Gotenberg
docker compose up -d

# 3. (Once schemas exist) Generate + apply baseline migration
pnpm db:generate
pnpm db:push

# 4. Start all apps in dev mode
pnpm dev
```

Services:
- `apps/web` → http://localhost:3000
- `apps/cs` → http://localhost:3001
- `apps/api` → http://localhost:8787
- `apps/pdf` → http://localhost:8788
- Postgres → localhost:5432 (user `bgreen`, password `bgreen_dev`, db `bgreen`)
- Gotenberg → localhost:3010
- Inngest dev UI → http://localhost:8288

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run all apps + Inngest dev server |
| `pnpm build` | Build all apps + packages |
| `pnpm typecheck` | TypeScript checks across the monorepo |
| `pnpm test` | Vitest unit tests |
| `pnpm lint` | Biome lint check |
| `pnpm format` | Biome format (writes) |
| `pnpm db:generate` | Generate Drizzle migration from schema |
| `pnpm db:push` | Apply migrations to local Postgres |
| `pnpm db:studio` | Open Drizzle Studio |

## Layout

```
apps/
  web/         Next.js (UI + thin BFF)
  api/         Hono (heavy API, AI calls, IES extraction)
  pdf/         Hono wrapper around Gotenberg
packages/
  db/          Drizzle schema + migrations
  types/       Shared zod schemas
  ai/          AnthropicAiClient + tool registry
  auth/        WorkOS helpers + FGA wrapper
  pt-data/     PT reference data (CAE, freguesias, …)
  form-engine/ FormSchemaInterpreter
  emails/      React-Email templates
```

Each app and package carries its own `CLAUDE.md` describing its bounded context.

## Status

V1 (Foundation) — local scaffold. CI, Vercel, Fly, Neon, WorkOS not yet provisioned. See vertical plans for what comes next.
