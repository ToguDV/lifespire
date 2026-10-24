# LifeSpire — agent guide

## Sources of truth

- **Product and rules:** [`SPEC.md`](./SPEC.md) defines the scope, game rules,
  rewards, screens, and acceptance criteria. Any functional decision must be
  traceable back to that document (or a GitHub issue).
- **Vocabulary:** [`GLOSARY.md`](./GLOSARY.md) defines the user-facing terms
  (goal, routine, weekly target) and records that the code keeps the older
  "aim" names for identifiers, CSS classes, and DOM hooks.
- **Workflow:** [`WORKFLOW.md`](./WORKFLOW.md) sets the commit format, PR
  content, the TDD requirement, and the mandatory cleanup at the end of a
  session. It is binding for agents and humans.
- **Architecture diagnosis:** [`docs/ARCHITECTURE-REVIEW.md`](./docs/ARCHITECTURE-REVIEW.md)
  records the 2026-10-23 review, prioritized findings, and remediation roadmap.
  It is a snapshot, not a contract; `docs/ARCHITECTURE.md` remains the module
  reference.
- **Backend and sync:** [`docs/BACKEND.md`](./docs/BACKEND.md) defines the NestJS
  sync API (closed registration, admin invites, snapshot sync, runbook). Sync
  decisions are recorded in [`docs/adr/`](./docs/adr/) (protocol, auth/admin,
  monorepo, conservative auto-merge in
  [`0004-sync-auto-merge.md`](./docs/adr/0004-sync-auto-merge.md),
  native auth in [`0005-native-auth.md`](./docs/adr/0005-native-auth.md)).
- **Android app:** [`docs/MOBILE.md`](./docs/MOBILE.md) defines the Expo
  architecture, SQLite persistence, native auth/sync, local notifications,
  Android setup, testing and release checks. The app lives in `apps/mobile/`
  and shares `packages/core` + `packages/app-core` with web.
- **Visual design:** the shipped application is the **accepted** visual
  reference, together with the design-system specification. Specifically:
  - [`design/DESIGN.md`](./design/DESIGN.md): design system (color, typography,
    spacing, components, and responsive rules).
  - [`apps/web/src/styles/tokens.css`](./apps/web/src/styles/tokens.css): canonical tokens.
  - [`apps/web/src/styles/app.css`](./apps/web/src/styles/app.css),
    [`apps/web/src/styles/ui.css`](./apps/web/src/styles/ui.css),
    [`apps/web/src/styles/m3.css`](./apps/web/src/styles/m3.css) and
    [`apps/web/src/styles/juice.css`](./apps/web/src/styles/juice.css): the shipped styles.
  - [`apps/web/src/styles/dev.css`](./apps/web/src/styles/dev.css): development-only styles,
    imported dynamically only when `import.meta.env.DEV` is true.
  - [`apps/mobile/src/theme/tokens.ts`](./apps/mobile/src/theme/tokens.ts): the
    Android port of the same tokens; platform differences are documented in
    `docs/MOBILE.md`.
  - [`apps/web/public/fonts/`](./apps/web/public/fonts): Alegreya and Alegreya Sans
    (SIL OFL 1.1), self-hosted on web; Android loads the same OFL families
    through Expo fonts.
  - [`docs/screenshots/`](./docs/screenshots): real app captures used by the
    root `README.md` (map in light/dark theme, desktop and mobile).

The static HTML proposal that used to live in `design/` has been retired; the
app is the reference and `design/DESIGN.md` is its spec.

Do not invent a parallel visual direction or replace tokens with loose values.
When implementing a screen, reuse the tokens, classes, components, and
hierarchies from `src/styles/`. Necessary differences are documented in
`docs/ARCHITECTURE.md` or in a design note.

The *Slay the Spire* inspiration is strictly mechanical: no names, art, layouts,
or content from the original game are reused.

## Branch and scope

- `main` is the main development and release line.
- At the start of a session, create your own branch (`feat/...`, `fix/...`,
  `docs/...`, `test/...`, `ci/...`) and open a PR. One branch per session; do
  not reuse branches across sessions. The user reviews and approves the merge.
  See [`WORKFLOW.md`](./WORKFLOW.md) for details.
- Do not rewrite `main` history or force-push.
- Sync backend: closed-beta NestJS API in `apps/api/` (multi-user, closed
  registration, admin invites, snapshot sync). The web stays local-first:
  guest play without a server, per-account sync when signed in. The Android
  app is local-first too and adds device-local reminders. See
  [`docs/BACKEND.md`](./docs/BACKEND.md) and
  [`docs/MOBILE.md`](./docs/MOBILE.md).

## Architecture

Module structure, type contracts, and persistence decisions live in
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md). Read it before touching
domain, state, or navigation.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm dev          # web (apps/web)
pnpm dev:api      # sync API (apps/api, needs DATABASE_URL)
pnpm dev:mobile   # Android app (apps/mobile, Expo)
pnpm lint         # all workspaces
pnpm typecheck    # all workspaces
pnpm typecheck:e2e  # web E2E + Playwright config
pnpm test         # all workspaces (unit, web + mobile)
pnpm test:mobile  # Android planner/auth unit tests
pnpm test:e2e     # web Playwright E2E (apps/web)
pnpm build        # all workspaces (includes the Android JS bundle)
pnpm build:mobile # Metro Android bundle only
pnpm preview      # serve the web build (PWA/offline)
```

Per-workspace: `pnpm --filter @lifespire/api test:e2e` runs the API flow
against Postgres (see `docs/BACKEND.md` §7); `pnpm --filter @lifespire/core`
and `@lifespire/api-client` scope the shared packages.

## E2E tests and CI

- E2E tests live in [`apps/web/e2e/`](./apps/web/e2e) and are configured in
  [`apps/web/playwright.config.ts`](./apps/web/playwright.config.ts). API flow
  tests live in [`apps/api/test/`](./apps/api/test) and need Postgres.
- The [`ci.yml`](./.github/workflows/ci.yml) workflow always runs lint,
  typecheck, E2E typecheck, tests, and build across all workspaces, including
  the Android Jest suite and Metro bundle; the `e2e` job only runs when
  critical paths change (web domain/state/content/shell/screens, mobile, API,
  shared packages, E2E config, lockfile) or manually via `workflow_dispatch`.
  The `api-e2e` job runs the API flow against a Postgres service under the same
  gate.
- Do not add E2E to every change: if you touch a critical path, also update
  `e2e/` to cover the new behavior.

## Working rules

- Domain logic (map, rewards, day cycle, run close) must be pure and testable,
  with no `Math.random`, `Date.now`, or UI/store imports.
- Inject the date/time into all calendar-dependent logic.
- Versioned persistence: `localStorage` on web, synchronous SQLite KV on
  Android; both use the same `GameDocument` and export/import schema. Device
  preferences (haptics, notification times, server URL) stay outside the save.
- Minimum accessibility: visible focus, 44 px web / 48 dp Android touch
  targets, sufficient contrast, keyboard navigation/TalkBack, and respect for
  reduced motion.
- Changes must leave `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:e2e`,
  `pnpm test`, and `pnpm build` green (the build includes the Android bundle).
  If the change touches critical paths, add or update the corresponding E2E and
  verify `pnpm test:e2e` (web) and the API flow when `apps/api` changes. The
  mobile notification planner, native auth grant and save import/export need
  unit coverage when touched.
- **Mandatory documentation:** whenever a `.md` file (or reference document) is
  added, moved, or deleted, update this guide (`AGENTS.md`) in the same change,
  registering it under "Sources of truth" or the relevant section. A new
  document without a reference here is considered incomplete work.
