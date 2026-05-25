# UI Carbon Migration — bGreen

> **Status:** Phase 2 complete on apps/web (2026-05-25). Every authenticated web route uses Carbon chrome (PageHeader / DataTable / Tile / Tag / InlineNotification / EmptyState / StatCard). Phase 3 (apps/cs migration) pending.
> **Scope:** Visual overhaul of `apps/web` and `apps/cs`. Replaces the current `shadcn/ui` + `lucide-react` + bespoke Tailwind tokens with **IBM Carbon Design System** themed for bGreen. Not a feature vertical.
> **Parent PRD:** [../bgreen-greenfield-rewrite.md](../bgreen-greenfield-rewrite.md)
> **Source:** Review performed 2026-05-25. Direction agreed in session: Carbon Design System, emerald primary preserved, both apps in parallel.

The current UI is functionally complete but visually generic — pure shadcn/ui defaults with a single emerald token swapped in. No icons, no active-nav state, text-only metrics, header layout breaks at admin permissions. Behaviour and validation logic (notably `CreateOrganizationForm` with VIES) are sound; only the visual surface changes.

bGreen is a regulator-facing ESG product for Portuguese SMEs. The aesthetic target is institutional enterprise — trustworthy, data-forward, light-themed, square-cornered, dense without feeling cramped. Carbon's tokens, type system, and component library are designed for exactly this.

## Decisions taken in this session

| Decision | Value | Reversible? |
|---|---|---|
| Component library | `@carbon/react` (replaces shadcn/ui) | Reversible per-page during Phase 2/3 |
| Icons | `@carbon/icons-react` (replaces `lucide-react`) | Easy swap |
| Charts | `@carbon/charts-react` only where it adds value (peer bars, score breakdowns); keep existing custom SVG sparkline + trend chart | — |
| Brand colour | Emerald = primary interactive. Overrides Carbon's `$interactive-01`, `$link-primary`, `$button-primary` and chart category 1 | Tokenised — one file to flip |
| Theme base | Carbon **White** (light). `g10` reserved for "muted" panels. No dark mode in v1 | Carbon supports g90/g100 when wanted |
| Typography | IBM Plex Sans (Carbon default) for UI; IBM Plex Mono for IDs/numerals. Loaded via `next/font/google` | One import to change |
| Corners | Carbon defaults (square / 2px). Part of the institutional feel | — |
| Density | Default (md) on **both apps**. ~~Compact for apps/cs~~ — reversed during Phase 0 review (2026-05-25): visual consistency across apps preferred over CS-specific density | Per-component `size` prop if revisited |
| Layout co-existence | Tailwind 4 kept for page layout / margins / grids. Carbon owns components, Tailwind owns glue. | — |
| Showcase location | `/_design` route built in **both apps** from day one | — |
| Component location | Initially in `apps/web/src/components/ui/` and `apps/cs/src/components/ui/` (replacing shadcn files). Extract to `packages/ui` only after Phase 4 if duplication justifies it | — |

## Phased plan

Each phase ends in a demoable artefact. Phase 0 gates everything else: no real-page migration until the showcase is approved.

### Phase 0 — Design system showcase (`/design`) — ✅ COMPLETE 2026-05-25

Goal: Carbon installed, themed for bGreen, every primitive visible on a single page in **both apps** so the look can be approved before any real page is touched.

**Lessons / deviations from the initial plan:**
- Route is `/design`, **not `/_design`** — Next.js App Router treats underscore-prefixed folders as private (excluded from routing). The page itself gates with `notFound()` when `NODE_ENV === "production"`.
- Did **not** use `next/font/google`. Carbon's CSS hardcodes `font-family: 'IBM Plex Sans'` (not via a CSS variable), so `next/font`'s generated family names wouldn't resolve without overriding hundreds of selectors. Used `@import url(...)` from Google Fonts in `globals.css` instead. Switch to self-hosted `@ibm/plex-*` packages is a Phase 4 cleanup candidate.
- Override selector is `:root, [data-carbon-theme="white"], [data-carbon-theme="g10"]`. The `[data-carbon-theme]` attribute is set by the `<Theme>` component on the same element that gets the `.cds--white` class — equal specificity (0,1,0), so source order (our override imported AFTER Carbon CSS) wins.
- CS middleware needed `/design` added to `PUBLIC_PATHS` so the showcase is reachable without a CS session.
- Added `react-is@^19` as a direct dep in both apps to satisfy Carbon's peer (transitive `downshift` pulled in 18.2.0 which fell in Carbon's peer-range gap).
- Charts deferred to Phase 2 as planned.

**What shipped:**

- [x] Install dependencies in `apps/web` and `apps/cs`:
  - `@carbon/react@^1.108.0` (React 19 native support confirmed)
  - `@carbon/styles@^1.107.0` (precompiled `css/styles.css` — no SCSS pipeline)
  - `@carbon/icons-react@^11.81.0`
  - `react-is@^19.0.0` (peer-dep fix)
- [x] Verify Next 15 + React 19 + Carbon compat — clean install, no overrides needed.
- [x] Load IBM Plex Sans + IBM Plex Mono via Google Fonts `@import url(...)` in `globals.css` (both apps).
- [x] Create `apps/web/src/styles/carbon-theme.css` and `apps/cs/src/styles/carbon-theme.css` with emerald override:
  - `--cds-interactive`, `--cds-link-primary` (+ hover/visited/inverse), `--cds-button-primary` (+ hover/active), `--cds-focus`, `--cds-background-brand`.
  - Import order in `layout.tsx`: `globals.css` → `@carbon/styles/css/styles.css` → `carbon-theme.css`.
- [x] Verified override survives — emerald `#1f7a3d` is the **last** `--cds-button-primary` declaration in the compiled `layout.css` (line 31200 of 31211), beating Carbon's `#0f62fe` default at equal specificity.
- [x] Build `apps/web/src/app/design/page.tsx` (gate) + `DesignShowcase.tsx`. 14 sections (charts deferred):
  1. **Typography** — display, h1–h5, body-01/02, label-01/02, code-01, helper text. Plex Sans + Plex Mono samples.
  2. **Colour tokens** — emerald scale (mapped onto `$support-success-*`), neutrals (gray 10/20/50/70/90), semantic swatches (interactive, support-error/warning/info/success), with hex + token name.
  3. **Icons** — the lucide → Carbon icon mapping we plan to standardise on (~25 icons covering nav, actions, fields, status). 16/20/24px sizes.
  4. **Button** — Primary / Secondary / Tertiary / Ghost / Danger × sm/md/lg/xl, with and without leading/trailing icons, loading state.
  5. **Tag** (Carbon's "badge") — variants + dot indicators; map our 6 record-status variants (draft/submitted/approved/changes_requested/rejected + tier badge).
  6. **PageHeader** — proposed shared component: title + description + actions slot + optional icon + optional breadcrumb. Three demo variants.
  7. **StatCard** — proposed shared component: big number + sparkline + delta + icon + tier tag. Replaces the home/dashboard card sprawl.
  8. **EmptyState** — proposed shared component: inline-SVG illustration + title + body + primary/secondary actions. Three demo variants (dashboard / inbox / records).
  9. **DataTable** — Carbon's `<DataTable>` with sortable header, row hover, status tag column, action overflow menu. Demo with records-like data.
  10. **StructuredList** — for definition-list-style read-only record views.
  11. **Notification** — inline + toast variants for our 4 semantic states.
  12. **Form patterns** — `TextInput`, `Select`, `Dropdown`, `NumberInput`, `Checkbox`, `RadioButtonGroup`, `TextArea`, `FileUploader`. Validation states (invalid + warn). Inline helper text. Currency/unit prefixes.
  13. **UI Shell preview** — `SideNav` + `Header` (not yet wired to real routes). Collapsed + expanded states. Active route marker.
  14. **Motion samples** — Carbon's productive-motion tokens applied to button hover, panel mount, tag pulse. CSS only.
  15. **Charts** *(if `@carbon/charts-react` installed)* — sparkline, line chart, simple bar comparison (peer rank), donut. Themed.
- [x] Mirror `apps/cs/src/app/design/page.tsx` with the same 14 sections. Originally shipped with compact density (`SIZE = "sm"`); reverted to default (`SIZE = "md"`) after Phase 0 review for visual consistency. CS section content keeps power-user vocabulary (template editor, review inbox, score schema) — only the density was rolled back.
- [x] Route-gate both `/design` pages: `notFound()` returned when `NODE_ENV === "production"`. No link from the live header. CS middleware updated to mark `/design` as a public path.
- [ ] **Approval gate:** review `/design` on both apps (http://localhost:3000/design and http://localhost:3001/design with dev servers running). Sign-off here unblocks Phase 1.

**Deliverable:** two `/design` pages showing the full Carbon-themed primitive set. Both apps visually consistent. ✅ Shipped.

### Phase 1 — Shared shell + page header — ✅ COMPLETE 2026-05-25

Goal: replace the current top-wrapping header with Carbon's UI Shell. Establish the `<PageHeader>` and `<EmptyState>` conventions used by every subsequent page.

- [x] Build `<AppShell>` in each app (`src/components/shell/AppShell.tsx`):
  - Carbon `Header` with brand mark, account `HeaderPanel` (email + role + sign-out), org-switcher `HeaderPanel` (web only, shown when ≥2 orgs).
  - Carbon `SideNav` (persistent, fixed) with icons + labels, active-route highlight via `usePathname()`, role-aware items (web: Membros + Convidar only for `org_admin`; cs: Utilizadores/Domínios only for `admin`).
  - `<main>` content area with margin-left animation when the side nav toggles.
- [x] Build `<PageHeader>` shared component (`src/components/shell/PageHeader.tsx`): title, description, icon, breadcrumb, actions slot. Replaces the `← Voltar` + `<h1>` + `<p>` pattern.
- [x] Build `<EmptyState>` shared component (`src/components/shell/EmptyState.tsx`): inline-SVG illustration + title + description + primary/secondary actions.
- [x] Build `<AuthenticatedShell>` server wrapper that fetches session/org data and either renders `<AppShell>` (signed-in org users) or just `{children}` (unauth, CS users, onboarding-state).
- [x] Wire `<AuthenticatedShell>` into `apps/web/src/app/layout.tsx`. Unauth, CS-bound, and zero-org users render without chrome.
- [x] Wire `<AuthenticatedShell>` into `apps/cs/src/app/layout.tsx`. /login + /setup-password skip because middleware lets them through without a session and `fetchMe()` returns null.
- [x] Strip per-page `<Header>` calls from 12 web pages + 9 CS pages. Collapsed now-unused `fetchMe` / `fetchMyOrganizations` / `getActiveOrgId` Promise.all destructures into the minimum still in use per page.
- [x] Smoke check: dev typecheck clean on both apps; CS auth-gated routes 307→`/login`; web auth-gated routes 307 or 200 (per existing per-page withAuth pattern); /login, /setup-password, /design serve 200. No Carbon/shell errors in either dev log.

**Deviations / decisions made during execution:**
- Used `data-carbon-theme="white"` on the outer wrapper so the theme override file's attribute-selector matches at the right specificity.
- Used `Globe` icon for the CS Domínios nav item (initial choice `WorldFilled` doesn't exist in `@carbon/icons-react`).
- Old `apps/web/src/app/_components/Header/` and `apps/cs/src/app/_components/Header.tsx` left in place but unused — will be deleted in Phase 4 cleanup once we are sure no Phase 2/3 page accidentally re-imports them.

**Deliverable:** both apps render Carbon UI Shell on every authenticated route. Inner page content is still shadcn — that's Phase 2/3. ✅ Shipped.

### Phase 2 — Migrate `apps/web` pages — ✅ COMPLETE 2026-05-25

Goal: replace shadcn primitives with Carbon equivalents page-by-page.

- [x] **`/`** (home) — PageHeader + EconomicProfileCta as Tile + EconomicProfileSummary as 3 StatCards + system-health as StructuredListWrapper.
- [x] **`/dashboard`** — PageHeader + ScoreCard rebuilt over shared StatCard (sparkline + tier Tag + delta vs prior submission) + PeerRankCard as Tile + horizontal bar comparison + RecommendationsCta as Tile. Local EmptyState deleted (replaced by shared one).
- [x] **`/records` + `/records/new` + `/records/[id]`** — list uses Carbon DataTable (extracted to RecordsListView client component), per-template tertiary "new record" buttons, EmptyState when zero records. Detail page wraps with PageHeader + status Tag + InlineNotification for review comment. RecordForm itself untouched (separate scope).
- [x] **`/inbox`** — DataTable (InboxTable client wrapper) + shared EmptyState + state Tag column.
- [x] **`/templates` + `/templates/[id]`** — list as DataTable (TemplatesTable). Detail keeps the recursive FieldRow visual but with Tag + Plex Mono styling. (StructuredList was the original proposal but the recursive nested-fields shape fits a Tile + custom list better.)
- [x] **`/economic-profile/*`** — six sub-pages. List → PageHeader + DataTable + ProfileActions. Manual/IES/trend/benchmark all wrapped with PageHeader + breadcrumbs; inner forms/chart/status views left intact. Benchmark uses InlineNotification. Trend uses Tile + Tag.
- [x] **`/organizations/*` + `/invites/[token]`** — new-org, members list (with MembersHeaderActions client wrapper), member edit, invite form, branding settings, invite-accept all wrapped with PageHeader + breadcrumbs. Members table → DataTable. CreateOrganizationForm itself unchanged. Invite-accept is a hero Tile centred in viewport.
- [x] **`/recommendations` + `/coverage` + `/reports`** — added since the plan was written; all wrapped with PageHeader. Coverage uses InlineNotification + small client wrapper for the CS-only header action. Reports nav item added to AppShell.

**Pattern established:** any page that needs a `<Button renderIcon={...}>` in its `actions` slot (server-rendered PageHeader) requires a small `"use client"` wrapper component, since Carbon Button is client and icon component refs can't cross the server→client boundary. Extracted: `ProfileActions`, `MembersHeaderActions`, `CoverageHeaderAction`, `ReportsHeaderActions`, `AcceptInviteButton`.

**What's left (deferred to Phase 4):** shadcn primitives in `apps/web/src/components/ui/*` are still imported by `RecordForm` (form-engine internals), `CreateOrganizationForm`, `ManualEntryForm`, `BrandingForm`, `MemberEditForm`, `InviteMemberForm`, `UploadIesForm`, `GenerateForm`, plus a few coverage/recommendations sub-components. Form-engine migration is its own concern; shell + page chrome is done.

**Deliverable:** every authenticated web route renders Carbon-themed chrome. ✅ Shipped.

### Phase 3 — Migrate `apps/cs` pages

Same page-by-page approach. CS uses default (md) density — same as web. (Compact density was considered for CS power-user surfaces but reversed during Phase 0 review.)

- [ ] **`/`** (home) — `PageHeader` + session info as `StructuredList`.
- [ ] **`/login` + `/setup-password`** — Carbon `Form` + `TextInput` + `Button`. Single tile centred layout.
- [ ] **`/inbox`** — `DataTable` with role-aware action column.
- [ ] **`/templates` + `/templates/[id]`** — list as `DataTable`.
- [ ] **`/templates/new`** — the **biggest visual win**: `TemplateEditor` gets drag-handle reorder (`@dnd-kit` or Carbon's drag-and-drop primitives — decide during the page), field-type icons per row, visual nesting indicator for repeating groups, sticky save bar, validation summary panel.
- [ ] **`/orgs`** — `DataTable` (currently a stub; build when navigated).
- [ ] **`/users`** — `DataTable` with inline-edit role column; new-user form as a Carbon `Modal` triggered by header action.
- [ ] **`/domains` + `/topics`** — `DataTable` patterns.
- [ ] **`/records/[id]`** — read-only record view as `StructuredList`; `ReviewPanel` rebuilt as Carbon `RadioButtonGroup` + `TextArea` + sticky-bottom action bar.
- [ ] Remove `apps/cs/src/components/ui/*` at end of phase.

**Deliverable:** `apps/cs` fully on Carbon. Both apps visually consistent.

### Phase 4 — Cleanup

- [ ] Remove `lucide-react` from both apps' `package.json` (verify no remaining imports).
- [ ] Remove `class-variance-authority` if no longer used outside removed shadcn primitives.
- [ ] Audit `apps/web/src/app/globals.css` and `apps/cs/src/app/globals.css` — strip dead shadcn tokens; keep only the Carbon-override layer and any genuinely-app-specific styles.
- [ ] Decide on `packages/ui` extraction:
  - Extract iff `apps/web` and `apps/cs` have ≥3 identical shared wrappers (`PageHeader`, `EmptyState`, `StatCard`, `AppShell`).
  - Otherwise leave duplicated and revisit after Phase 5.
- [ ] Update `apps/web/CLAUDE.md` and (create) `apps/cs/CLAUDE.md` to reflect "UI: `@carbon/react` themed for bGreen" instead of "shadcn/ui + Tailwind".
- [ ] Smoke-test every page; type-check both apps; run existing vitest suites.

**Deliverable:** no dead deps, no dead files, docs in sync with reality.

## Carbon token overrides — concrete mapping

Brand palette (named by the brand team, locked 2026-05-25):

| Name | Hex | Role |
|---|---|---|
| **mint leaf** | `#63B995` | Primary interactive: buttons, links, focus, brand surfaces |
| **shadow grey** | `#37323E` | Text primary, icon primary |
| **cinnabar** | `#FF312E` | Danger / destructive (button bg + support-error + text-error) |
| **fern** | `#50723C` | support-success |
| **jasmine** | `#FFD97D` | support-warning |

Hover / active states use slight tonal shifts of the base colours (e.g. mint hover `#4FA481`, mint active `#3D8B6A`) so the UI gives feedback on press — they are *not* separate named brand colours.

WCAG AA contrast was explicitly deprioritised in favour of consistent use of the named palette (decision 2026-05-25). Revisit later if needed.

Override file: `apps/{web,cs}/src/styles/carbon-theme.css`.

| Carbon token | Default | bGreen value |
|---|---|---|
| `--cds-interactive` | `#0f62fe` | `#63B995` (mint) |
| `--cds-button-primary` | `#0f62fe` | `#63B995` |
| `--cds-button-primary-hover` | `#0050e6` | `#4FA481` (mint −10% L) |
| `--cds-button-primary-active` | `#002d9c` | `#3D8B6A` (mint −20% L) |
| `--cds-focus` | `#0f62fe` | `#63B995` |
| `--cds-background-brand` | — | `#63B995` |
| `--cds-link-primary` | `#0f62fe` | `#63B995` (mint — consistency over AA) |
| `--cds-link-primary-hover` | `#0050e6` | `#4FA481` |
| `--cds-text-primary` | `#161616` | `#37323E` (shadow grey) |
| `--cds-icon-primary` | `#161616` | `#37323E` |
| `--cds-support-success` | `#24a148` | `#50723C` (fern) |
| `--cds-support-warning` | `#f1c21b` | `#FFD97D` (jasmine) |
| `--cds-support-error` | `#da1e28` | `#FF312E` (cinnabar) |
| `--cds-text-error` | `#da1e28` | `#FF312E` (cinnabar — consistency over AA) |
| `--cds-button-danger-primary` | `#da1e28` | `#FF312E` (cinnabar) |
| `--cds-button-danger-hover` | `#b81921` | `#E62825` |
| `--cds-button-danger-active` | `#750e13` | `#C61F1D` |
| Chart category 1 | IBM blue | mint leaf |

## Dependency delta

**Added:**
- `@carbon/react`
- `@carbon/styles`
- `@carbon/icons-react`
- `@carbon/charts-react` + `@carbon/charts` *(Phase 2)*
- `@dnd-kit/core` + `@dnd-kit/sortable` *(Phase 3, only if Carbon's primitives don't cover template-editor reorder)*

**Removed (Phase 4):**
- `lucide-react`
- `class-variance-authority` *(if no remaining callers)*

**Unchanged:**
- `tailwindcss` v4 — layout glue only
- `clsx`, `tailwind-merge` — utility helpers; harmless
- `next/font` — built into Next; no install
- `@tanstack/react-query`, `@workos-inc/authkit-nextjs`, `hono`, `@bgreen/*` workspace packages

## Risks

- **React 19 peer-dep on Carbon.** Carbon v11 historically pinned React 18. Verify peer ranges before committing; fall back to `npm overrides` or wait for a matching Carbon release if blocked. **Mitigation:** smoke-test in Phase 0 with a single `<Button>` before building the rest of `/_design`.
- **Tailwind ↔ Carbon CSS collisions.** Carbon's reset and ours can fight over `body`, headings, focus rings. **Mitigation:** load order is Carbon CSS → Tailwind preflight → app overrides. Test on `/_design` early.
- **Bundle size.** Carbon is heavier than shadcn (which ships nothing). Tree-shaking helps but baseline grows. **Mitigation:** authenticated app, not a marketing surface — acceptable. Audit bundle after Phase 2 with `next build`.
- **Theme override scope.** Carbon's `<Theme>` re-declares CSS vars in a scoped block; our overrides must live inside the same scope or be more specific. **Mitigation:** put overrides inside `[data-carbon-theme="white"]` (or whatever wrapper attribute Carbon emits) — verified during Phase 0.
- **Inconsistent visual quality across apps if migrated at different paces.** **Mitigation:** Phase 1 (shell) ships to both apps simultaneously; subsequent page migrations can stagger but the chrome stays consistent throughout.
- **Custom validation flair on `CreateOrganizationForm` may not map 1-to-1 to Carbon props.** Carbon `TextInput` has `invalid`/`warn`/`helperText` — should cover everything, but the inline VIES status copy ("A consultar VIES…", ✓ NIF válido) may need a custom helper-text formatter. **Mitigation:** treat that form as the canary; if it doesn't fit cleanly, the abstraction we want isn't ready and we step back.

## Out of scope

- **Dark mode.** Carbon supports it via `g90`/`g100`. Defer to a post-v1 vertical.
- **Mobile-specific layouts.** Carbon is responsive; we will not redesign for mobile-first. Tablet/desktop targets only in v1.
- **Internationalisation of the design itself.** Copy stays pt-PT per `CLAUDE.md` G-2. RTL support deferred.
- **Marketing / landing pages.** Not in repo today.
- **Custom Carbon component forks.** If Carbon is missing a primitive, we compose; we do not fork.
- **Migration of `apps/api`, `apps/pdf`.** API has no UI; PDF generation has its own templating stack (V11).
- **Replacing the workflow / scoring / form-engine logic.** UI overhaul only.

## Open questions

- Should `/_design` be permanently dev-only, or kept behind a stable route in production (useful for design reviews, hiring portfolio)? **Default:** dev-only via `NODE_ENV` check; revisit at end of Phase 4.
- Carbon's `DataTable` has built-in pagination — should we adopt it now, or keep the current "render everything" pattern until a list grows? **Default:** adopt the component, but skip pagination until any list exceeds 50 rows.
- For the CS template editor reorder, does Carbon's built-in drag work cleanly with our nested repeating groups, or do we need `@dnd-kit`? **Default:** prototype with Carbon first, fall back to `@dnd-kit` if nesting gets ugly.
- `packages/ui` extraction — defer the call to end of Phase 4 as planned, or set up the package upfront so both `/_design` pages already import from it? **Default:** defer. Premature shared package == two refactors.

## References

- Carbon Design System: <https://carbondesignsystem.com>
- Carbon React: <https://react.carbondesignsystem.com>
- Carbon for IBM Cloud (closest reference product): <https://cloud.ibm.com>
- IBM Plex on Google Fonts: <https://fonts.google.com/specimen/IBM+Plex+Sans>
- Current shadcn primitives being replaced: `apps/web/src/components/ui/`, `apps/cs/src/components/ui/`
- Current visual review notes: see conversation that produced this plan (2026-05-25).
