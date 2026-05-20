# V1 — Foundation

> **Status:** Not started
> **Depends on:** —
> **Parent PRD:** [../bgreen-greenfield-rewrite.md](../bgreen-greenfield-rewrite.md)
> **User stories covered:** PRD §1–10 (developer experience)

## Goal

Stand up the `bgreen` repo with the full three-service skeleton, end-to-end CI green, and a one-command local dev loop. No product features yet. The aim is "I can clone, `pnpm install && pnpm dev`, and have web + api + Postgres + Gotenberg running."

## Acceptance criteria

- [ ] New repo `bgreen` initialized (private GitHub under NOMAD-Consulting).
- [ ] pnpm workspaces + Turborepo monorepo layout in place.
- [ ] `apps/web` — Next.js 15 (App Router) hello-world page.
- [ ] `apps/api` — Hono on Node 22 with `/health` endpoint.
- [ ] `apps/pdf` — Hono skeleton (no Gotenberg integration yet, just a `/health` endpoint stub).
- [ ] `packages/db` — Drizzle ORM scaffold, Postgres connection, one baseline migration creates `_schema_version`.
- [ ] `packages/types`, `packages/ai`, `packages/auth`, `packages/pt-data`, `packages/form-engine`, `packages/emails` — empty folders with `package.json` + `index.ts` (placeholders so imports resolve).
- [ ] Root `CLAUDE.md` + one `CLAUDE.md` per app and per package (skeleton — describes bounded context, will fill in as verticals land).
- [ ] Biome config at repo root — single tool for lint + format. `pnpm lint` and `pnpm format` work.
- [ ] TypeScript strict mode, project references between packages, `pnpm typecheck` green.
- [ ] Vitest installed in root + each package; `pnpm test` runs (empty suites OK).
- [ ] `docker-compose.yml` brings up Postgres 16 + Gotenberg locally.
- [ ] `pnpm dev` (root) runs Next.js + Hono + Inngest dev server concurrently against the compose stack.
- [ ] Inngest local dev server bundled into `pnpm dev`.
- [ ] `.gitattributes` + `.editorconfig` enforce LF line endings.
- [ ] GitHub Actions: typecheck + Biome + vitest run on every PR. CI green.
- [ ] Vercel project linked to `apps/web` — preview deploys on PR.
- [ ] Fly.io apps created for `apps/api` and `apps/pdf`, EU region (`fra` or `cdg`). Preview-on-PR script in place (one Fly app per PR or per branch).
- [ ] Neon Postgres EU project provisioned, dev branch wired into local + preview.
- [ ] Secrets management: Doppler or Fly/Vercel native secrets configured for `ANTHROPIC_API_KEY`, `WORKOS_*`, `DATABASE_URL`, `INNGEST_*`, `S3_*`, `RESEND_API_KEY`. Empty stubs OK until later verticals.
- [ ] README at repo root with: prerequisites, one-line install, one-line dev, deploy story.
- [ ] PostHog SDK wired in `apps/web` + `apps/api` (event tracking optional this vertical; errors auto-captured).

## In scope

- Monorepo plumbing, tooling, CI, deploy targets, local dev loop, observability skeleton.

## Out of scope

- Authentication (V2).
- Any aggregates beyond `_schema_version` (V2+).
- Domain code (everything from V2 onward).
- Actual Gotenberg integration (V10).

## Module map

This vertical creates **structure only**. No domain modules yet.

```
bgreen/
├── apps/
│   ├── web/          (Next.js 15)
│   ├── api/          (Hono)
│   └── pdf/          (Hono stub)
├── packages/
│   ├── db/           (Drizzle baseline)
│   ├── types/
│   ├── ai/
│   ├── auth/
│   ├── pt-data/
│   ├── form-engine/
│   └── emails/
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
├── biome.json
├── tsconfig.base.json
└── CLAUDE.md
```

## Deep modules introduced

None this vertical. Foundation is plumbing.

## Open questions / risks

- **Secrets manager choice:** Doppler vs Fly/Vercel native. Default: native per platform, no third-party until pain.
- **Turborepo vs Nx:** locked to Turborepo per PRD; revisit only if `pnpm dev` orchestration breaks.
- **Fly preview machines per PR cost:** acceptable at dev volume; revisit if PR count grows.

## Deployable artifact

- Click PR → Vercel preview URL renders Next.js hello + calls Hono `/health` successfully.
- Local: `pnpm dev` works on macOS and Windows (LF defaults verified).
- CI runs typecheck + lint + tests on every push; PR can't merge if red.

## Notes for the next vertical (V2)

V2 will add `Identity` and `Organizations` modules. Expect:
- WorkOS env vars added to all three apps.
- First non-trivial Drizzle migration (users, organizations, organization_memberships).
- First module with `domain / application / infrastructure / api / module.ts / CLAUDE.md` shape — V1 should *not* prescribe that shape until V2 needs it.
