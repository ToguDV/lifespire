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
- **Visual design:** the shipped application is the **accepted** visual
  reference, together with the design-system specification. Specifically:
  - [`design/DESIGN.md`](./design/DESIGN.md): design system (color, typography,
    spacing, components, and responsive rules).
  - [`src/styles/tokens.css`](./src/styles/tokens.css): canonical tokens.
  - [`src/styles/app.css`](./src/styles/app.css),
    [`src/styles/ui.css`](./src/styles/ui.css),
    [`src/styles/m3.css`](./src/styles/m3.css) and
    [`src/styles/juice.css`](./src/styles/juice.css): the shipped styles.
  - [`src/styles/dev.css`](./src/styles/dev.css): development-only styles,
    imported dynamically only when `import.meta.env.DEV` is true.
  - [`public/fonts/`](./public/fonts): Alegreya and Alegreya Sans
    (SIL OFL 1.1), self-hosted.
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
- There is no backend, accounts, or sync in the current scope.

## Architecture

Module structure, type contracts, and persistence decisions live in
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md). Read it before touching
domain, state, or navigation.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm dev        # development
pnpm lint       # oxlint
pnpm typecheck  # tsc -b
pnpm typecheck:e2e  # tsc -p tsconfig.e2e.json (E2E + Playwright config)
pnpm test       # vitest run (unit tests)
pnpm test:e2e   # Playwright E2E (install browsers with test:e2e:install)
pnpm build      # typecheck + production build
pnpm preview    # serve the build (PWA/offline)
```

## E2E tests and CI

- E2E tests live in [`e2e/`](./e2e) and are configured in
  [`playwright.config.ts`](./playwright.config.ts).
- The [`ci.yml`](./.github/workflows/ci.yml) workflow always runs lint,
  typecheck, E2E typecheck, tests, and build; the `e2e` job only runs when
  critical paths change (domain, state/persistence, content, shell, screens, E2E
  config, lockfile) or manually via `workflow_dispatch`.
- Do not add E2E to every change: if you touch a critical path, also update
  `e2e/` to cover the new behavior.

## Working rules

- Domain logic (map, rewards, day cycle, run close) must be pure and testable,
  with no `Math.random`, `Date.now`, or UI/store imports.
- Inject the date/time into all calendar-dependent logic.
- Versioned persistence in `localStorage`; export/import uses the same schema.
- Minimum accessibility: visible focus, 44 px touch targets, sufficient
  contrast, keyboard navigation, and respect for `prefers-reduced-motion`.
- Changes must leave `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:e2e`,
  `pnpm test`, and `pnpm build` green. If the change touches critical paths, add
  or update the corresponding E2E and verify `pnpm test:e2e`.
- **Mandatory documentation:** whenever a `.md` file (or reference document) is
  added, moved, or deleted, update this guide (`AGENTS.md`) in the same change,
  registering it under "Sources of truth" or the relevant section. A new
  document without a reference here is considered incomplete work.
