# bGreen — AI Assistant Brief

This is the greenfield TypeScript rewrite of bg1. Motivation, scope, and architecture live in the **master PRD** ([`plans/bgreen-greenfield-rewrite.md`](plans/bgreen-greenfield-rewrite.md)) and the **vertical plans** ([`plans/bgreen/`](plans/bgreen/)).

Read those first. This file captures only the operational rules.

## Golden Rules (override defaults)

| Rule | AI may | AI must NOT |
|---|---|---|
| G-0 | Ask for clarification when context is missing | Proceed when uncertain about requirements |
| G-1 | Use **English** for generic domain names (`Organization`, `Record`, `RecordTemplate`, `User`, `Workflow`) | Anglicize **jurisdiction-specific** PT terms (`Nif`, `Cae`, `Freguesia`, `Concelho`, `Distrito`, `CodigoPostal`, `NaturezaJuridica` values) |
| G-2 | Keep UI copy in **pt-PT** | Ship English-facing UI strings |
| G-3 | Add Drizzle migrations for schema changes | Edit migrations that have already been applied |
| G-4 | Co-locate `schema / routes / service / test` files per module | Spread one feature across many top-level folders |
| G-5 | Write zod schemas once and reuse for validation + RPC + OpenAPI + AI tool-use + Drizzle types | Maintain parallel type definitions |
| G-6 | Treat the lowest-incomplete vertical in `plans/bgreen/` as the active scope | Skip ahead to verticals whose dependencies aren't done |
| G-7 | Keep modules small enough to load into one AI context | Build sprawling modules with hidden coupling |
| G-8 | Confirm before >300 LOC or >3 files outside the active vertical's scope | Do wide refactors without alignment |

## Stack constraints

- TypeScript end-to-end. No Java, no .NET, no Angular.
- All AI calls originate from `apps/api`. The Anthropic API key never reaches `apps/web`.
- All `IAuditable` entity mutations write to `AuditLog` (from V5 onward).
- Tenant scope (organization_id) is enforced in `packages/db`; admin opt-out is explicit.

## Working with this repo

- Active vertical → the lowest-numbered plan in `plans/bgreen/` whose acceptance criteria aren't all ticked.
- Before adding a feature, check the parent PRD's "Out of scope" section and the active vertical's "Out of scope" section. Most temptations are deliberately deferred.

## Commits

- Short subject; body explains the *why* if non-obvious.
- New commits, not amends.
- Don't batch unrelated changes.
