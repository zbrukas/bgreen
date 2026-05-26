# V1 — Foundation

> **Status:** Needs local/tooling closeout. Platform target revised 2026-05-26.
> **Depends on:** —
> **Parent PRD:** [../bgreen-greenfield-rewrite.md](../bgreen-greenfield-rewrite.md)
> **User stories covered:** PRD §1–10 (developer experience)

## Goal

Stand up the `bgreen` repo with the full service skeleton, end-to-end CI green, and a one-command local dev loop. The platform target is now a proprietary server, not Vercel/Fly/Neon. The aim is "I can clone, `pnpm install && pnpm dev`, and have web + cs + api + pdf + Inngest dev running against local Postgres, MinIO, Mailpit, and Gotenberg."

## Acceptance criteria

- [ ] New repo `bgreen` initialized (private GitHub under NOMAD-Consulting).
- [ ] pnpm workspaces + Turborepo monorepo layout in place.
- [ ] `apps/web` — Next.js 15 (App Router) app shell.
- [ ] `apps/cs` — Next.js 15 central-services console shell.
- [ ] `apps/api` — Hono on Node 22 with `/health` endpoint.
- [ ] `apps/pdf` — Hono skeleton (no Gotenberg integration yet, just a `/health` endpoint stub).
- [ ] `packages/db` — Drizzle ORM scaffold, Postgres connection, one baseline migration creates `_schema_version`.
- [ ] `packages/types`, `packages/ai`, `packages/auth`, `packages/pt-data`, `packages/form-engine`, `packages/emails` — folders with `package.json` + `src/index.ts` exports.
- [ ] Root `CLAUDE.md` + one `CLAUDE.md` per app and per package (skeleton — describes bounded context, will fill in as verticals land).
- [ ] Biome config at repo root — single tool for lint + format. `pnpm lint` and `pnpm format` work.
- [ ] TypeScript strict mode, project references between packages, `pnpm typecheck` green.
- [ ] Vitest installed in root + each package; `pnpm test` runs (empty suites OK).
- [ ] `docker-compose.yml` brings up Postgres 16 + Gotenberg locally.
- [ ] `pnpm dev` (root) runs all Next.js apps + Hono services + Inngest dev server concurrently against the compose stack.
- [ ] Inngest local dev server bundled into `pnpm dev`.
- [ ] `.gitattributes` + `.editorconfig` enforce LF line endings.
- [ ] GitHub Actions: typecheck + Biome + vitest run on every PR. CI green.
- [ ] Proprietary server deployment plan documented: Node 22 process layout for `apps/web`, `apps/cs`, `apps/api`, `apps/pdf`; reverse-proxy routes; TLS; process supervisor; log destination; rollback path.
- [ ] Production Postgres provisioned and `DATABASE_URL` wired on the proprietary server.
- [ ] Production object storage provisioned for S3-compatible uploads/reports; `S3_*` / `AWS_REGION` wired.
- [ ] Production Gotenberg reachable from `apps/pdf` only.
- [ ] WorkOS AuthKit project is provisioned; `WORKOS_*` values wired in runtime secrets.
- [ ] Inngest production project configured; `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` wired on `apps/api`.
- [ ] Secrets management on the proprietary server configured for `ANTHROPIC_API_KEY`, `WORKOS_*`, `DATABASE_URL`, `INNGEST_*`, `S3_*`, SMTP, `POSTHOG_API_KEY`, and internal service tokens.
- [ ] README at repo root with: prerequisites, one-line install, one-line dev, deploy story.
- [ ] PostHog SDK wired in `apps/web` + `apps/api` (event tracking optional this vertical; errors auto-captured).

## In scope

- Monorepo plumbing, tooling, CI, deploy targets, local dev loop, observability skeleton.

## Out of scope

- Authentication implementation details (V2); WorkOS provisioning itself is considered available.
- Any aggregates beyond `_schema_version` (V2+).
- Domain code (everything from V2 onward).
- Actual Gotenberg integration (V10).

## Module map

This vertical creates **structure only**. No domain modules yet.

```
bgreen/
├── apps/
│   ├── web/          (Next.js 15)
│   ├── cs/           (Next.js central-services console)
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

- **Secrets manager choice:** proprietary-server native mechanism unless operational pain warrants Doppler or another external manager.
- **Turborepo vs Nx:** locked to Turborepo per PRD; revisit only if `pnpm dev` orchestration breaks.
- **Preview environments:** Vercel/Fly previews are no longer scheduled. If preview review becomes necessary, add a proprietary-server staging slot per branch or a single shared staging environment.
- **Inngest deployment shape:** local dev uses `inngest-cli dev`; production needs an Inngest project in the EU region with the proprietary API URL registered as the serve endpoint.

## Deployable artifact

- Proprietary staging URL renders `apps/web`, `apps/cs`, `apps/api/health`, and `apps/pdf/health` through the reverse proxy.
- Local: `pnpm dev` works on macOS and Windows (LF defaults verified), including Inngest dev UI.
- CI runs typecheck + lint + tests on every push; PR can't merge if red.

## Notes for the next vertical (V2)

V2 will add `Identity` and `Organizations` modules. Expect:
- WorkOS env vars added to all three apps.
- First non-trivial Drizzle migration (users, organizations, organization_memberships).
- First module with `domain / application / infrastructure / api / module.ts / CLAUDE.md` shape — V1 should *not* prescribe that shape until V2 needs it.
