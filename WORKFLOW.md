# Workflow — LifeSpire

Standardized workflow for contributors and agents working on LifeSpire. English only.

## 1. Read this workflow first (mandatory)

Reading this document is **mandatory before making any change**: code, tests,
styles, configuration, dependencies, CI, docs, or repository housekeeping. No
exceptions, no "small change" shortcut, and no improvising around a rule.

- If a rule here conflicts with an ad-hoc request or looks inapplicable, stop
  and ask the user before proceeding.
- `AGENTS.md` points here and is binding for agents and humans alike; a change
  made without following this workflow is incomplete even if it works.
- Reading it again at the start of every session is cheap; skipping it is not.

## 2. Backward compatibility check (before anything else)

LifeSpire is **already installed and used by real people** on web (PWA/installed
app), Android and desktop, including synced accounts. Their saves, runs and
history are real data. Every change is therefore a change to a live product: it
must never overwrite, corrupt, reset or make inaccessible what an existing
installation already has.

Before writing code, tests or configuration, classify the change and answer two
questions in writing (to the user and in the PR):

1. **Is this a breaking change?**
2. **If it is, what is the migration and the rollback path?**

A change is **breaking** if, for an existing installation or an already-persisted
document, it can:

- lose, damage or corrupt saved data (`localStorage`, Android SQLite KV,
  `GameDocument`, the sync `:base` snapshot, exports/imports);
- make a document that loads today fail to load or validate tomorrow
  (`parseDocument`), or fail a migration;
- remove, rename or reinterpret a persisted field, enum value or storage key, or
  change its meaning without a migration;
- change the export/import format so previously exported files no longer import;
- break the sync protocol for a client that has not been updated yet (push/pull
  must stay safe: ADR-0001, ADR-0004, ADR-0006);
- require a manual step to keep working (reinstall, wipe data, sign in again,
  clear cache, re-enter anything);
- break an existing storage key, deep link, service-worker cache contract or the
  desktop `lifespire-app://app` origin;
- remove or alter user-visible behavior that persisted state depends on.

Rules:

- **If the answer is yes — or you are not sure — tell the user before starting.**
  State what breaks, for whom, on which client, and the migration plus rollback
  you propose. Do not implement it until the user explicitly accepts the risk.
- **Default to forward-compatible, additive changes.** Add fields with safe
  defaults, version the document and migrate on read, keep old exports
  importable, let new clients read older documents and old clients ignore
  unknown fields.
- **Never silently reset or discard a save.** On a parse/version/migration
  error, keep the original document intact, back it up before migrating, and
  surface a recoverable state instead of starting from scratch.
- **Any schema-version bump ships with** a migration from every previously
  released version, round-trip tests (old document → migrate → validate →
  export → re-import), an idempotent migration, and the rollback path documented
  in the PR.
- Destructive-but-necessary changes need an explicit, user-visible confirmation
  in the app, never a silent background rewrite.
- Development, testing and review all assume **installed clients exist**: test
  with a document created by the previous release, not only with fresh data.

## 3. Branching (one branch per session)

- **Never work directly on `main`.** `main` is the development and release line.
- At the **start of every session**, create a dedicated branch:
  ```bash
  git checkout -b <type>/<short-slug>
  ```
  - One branch per session. Do not reuse a branch across sessions; this avoids
    stacking unrelated changes into a single PR.
  - Types: `feat/`, `fix/`, `docs/`, `chore/`, `refactor/`, `test/`.
  - Keep the slug short and descriptive (e.g. `feat/dark-theme-toggle`).
- Commit early and often on the branch; push only when opening a PR.

## 4. Commit format (Conventional Commits)

```
<type>(<scope>): <short imperative summary>

<body: what and why, wrapped at 72 cols>

<footer: refs, breaking changes>
```

- Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`, `perf`.
- Scope is optional but encouraged (`domain`, `ui`, `store`, `docs`).
- Subject line ≤ 72 chars, imperative mood, no trailing period.
- One logical change per commit. Do not mix formatting with logic.
- Examples:
  - `feat(domain): add deterministic loot roll for weekly close`
  - `fix(store): persist view derivation after reconcile`
  - `docs(readme): refresh captures and English copy`

## 5. Pull requests

Open a PR from the session branch to `main`. The PR must include:

### Title
Conventional-Commits style, matching the squashed commit intent.

### Description
- **Summary** — what changed and why (2–5 bullets).
- **Scope of change** — files/areas touched.
- **Testing** — explicit list of what was tested:
  - `pnpm lint` — pass/fail
  - `pnpm typecheck` — pass/fail
  - `pnpm typecheck:e2e` — pass/fail
  - `pnpm test` — pass/fail (note any new/updated tests)
  - `pnpm build` — pass/fail
  - Manual checks performed (screen sizes, theme, offline, etc.)
  - Desktop shell check — the flow verified by running it through the Electron
    shell (packaged build or `pnpm dev:desktop`) when the change is user-facing.
- **Backward compatibility** — the §2 verdict: *not breaking*, or *breaking* with
  the approved migration, the rollback path, and the evidence that documents
  from the previous release still load (round-trip test or equivalent).
- **Screenshots** — for UI changes, before/after or light+dark.
- **Client parity (web / mobile / desktop)** — the parity table from §8, or the
  per-client exemptions (§7) when the change has no equivalent on a client.
- **Code review** — the §9 review outcome: findings fixed, and the ones left
  open as accepted follow-ups.
- **Out of scope / follow-ups** — anything deliberately not addressed.

### Review & merge
- **One PR per session.** Never open a second PR to stage the mobile or desktop
  port or a follow-up: intermediate approvals (§7) happen on the session branch.
- PRs are opened **without requiring approval** to be created; the author (or
  agent) opens it and reports the URL.
- **The user reviews the PR and approves the merge.** Do not merge on the user's
  behalf unless explicitly asked.
- Prefer squash-merge for feature branches to keep `main` history clean.

## 6. Test-driven development (TDD)

For any feature, fix, or behavior change, follow TDD:

1. **Write a failing test first** that captures the expected behavior (unit,
   integration, or E2E as appropriate). Confirm it fails for the right reason.
2. **Implement the minimal change** to make the test pass. No speculative code.
3. **Refactor** while keeping all tests green.
4. Repeat for the next behavior.

- Bug fixes must start with a regression test that reproduces the bug.
- No PR should add production code without a corresponding test, unless the
  change is purely mechanical (rename, formatting, docs).
- Pure domain logic (`src/domain/`) must always be covered by tests.
- Persistence changes are tested with data from the **previous** release:
  migration of a real old document, idempotency, round-trip
  (export → import) and rejection-free load through `parseDocument`.

## 7. Delivery order: web first, then mobile and desktop parity

LifeSpire ships three clients — web (`apps/web`), Android (`apps/mobile`) and
desktop (`apps/desktop`, an Electron shell that serves the web build) — sharing
`packages/core` and `packages/app-core`. Every user-facing change must end with
real parity on all three; to prevent divergent implementations, follow this
order:

1. **Design and implement on web only.** TDD applies (§6); keep the change
   small and reviewable.
2. **Ask the user to approve the web change.** Report the branch, the commit
   range, and what to look at (screen, flow, theme). Wait for explicit
   approval; do not start the mobile or desktop work speculatively. There is
   **one PR per session** (§5), so the web change is reviewed as commits on the
   session branch, not as a separate PR.
3. **Port the approved behavior to mobile.** Match interaction, copy, states,
   tokens (`apps/mobile/src/theme/tokens.ts`), accessibility, and persistence
   (`GameDocument`). Platform differences (native notifications, haptics, file
   system, navigation) are documented in `docs/MOBILE.md`.
4. **Verify the approved behavior on desktop.** The shell serves the web build
   unchanged, so there is no separate UI to port; confirm the change works under
   the packaged `lifespire-app://app` origin and account for the shell-specific
   differences in `docs/DESKTOP.md`: native save dialog for export, no service
   worker, sync through the main-process API proxy, no desktop notifications,
   and the desktop menu/clipboard roles. If a change requires desktop-specific
   code in `apps/desktop/src`, treat it as a port with its own tests.
5. **Verify parity across web, mobile and desktop** (§8) and only then run the
   final code review (§9).

Three-client parity is mandatory for anything that changes behavior or UI.
Changes with no plausible equivalent on a given client (native Android
notifications and haptics, desktop installers and native dialogs,
PWA/service-worker work, the sync API, tooling, docs) are exempt **for that
client only**: state the reason in the PR under "Out of scope / follow-ups", and
still check that no shared package (`packages/core`, `packages/app-core`)
changes behavior without every client being considered.

## 8. Parity verification (subagent-orchestrated)

Once the mobile port and the desktop verification land, confirm that parity is
real and not nominal across the three clients:

- **Orchestrate subagents in parallel** against the same checklist: screens and
  navigation, copy and vocabulary from `GLOSARY.md`, empty/loading/error states,
  theme (light/dark), accessibility (44 px web / 48 dp Android, focus, TalkBack,
  reduced motion), and data (same `GameDocument` shape, migrations,
  export/import, sync path). Audit `apps/web` and `apps/mobile` separately, plus
  the desktop shell contract in `docs/DESKTOP.md`; one worker may cover web and
  desktop together because desktop renders the web build, but mobile must always
  be audited on its own.
- The main agent synthesizes the reports into a parity table
  (behavior → web → mobile → desktop → equal/divergent) and decides: fix the
  divergence, or record it as an accepted follow-up with the user. A
  platform-only difference documented in `docs/MOBILE.md` or `docs/DESKTOP.md`
  is not a divergence — record it as an expected difference.
- **Do not move to the final code review while a functional divergence is
  open.** Present the table together with the mobile and desktop changes.
- Very small changes (copy tweak, one-line style fix, mechanical rename) may be
  verified by the main agent itself; say so when reporting.

## 9. Final code review (mandatory)

After web, mobile and desktop are aligned and parity is verified, delegate a
review to the `code-reviewer` subagent (read-only; it must not change code)
covering:

- architecture and module boundaries per `docs/ARCHITECTURE.md`,
  `docs/MOBILE.md` and `docs/DESKTOP.md`;
- consistency across web, mobile, desktop and shared packages (naming, state,
  tokens);
- the desktop shell contract: custom origin and persistence keys, API proxy
  allowlists, native save dialog, and no service worker or notifications;
- bugs, edge cases, and regressions, including the date-injection rule for
  calendar-dependent logic;
- persistence and sync: schema versioning, migrations, and the conservative
  auto-merge in ADR-0004;
- backward compatibility with installed clients (§2): no data loss, corruption,
  silent reset or forced manual step; migrations cover every released version
  and are covered by round-trip tests;
- tests: are the new behaviors covered, and at the right layer;
- simplicity (KISS/YAGNI) and leftover dead code.

Fix the findings that are load-bearing, re-run the quality gates (§12), and
report the remaining findings in the PR.

## 10. Delegating long tasks to subagents

Use subagents when a task is too large for one pass — several screens, a whole
flow ported to mobile and verified on desktop, new test suites, or long
verification loops:

- Split by area (web UI, mobile UI, desktop shell, tests, docs) and run
  independent workers in parallel, while keeping the order of §7 (web first,
  then mobile and desktop).
- Give each worker its own context (files, tokens, acceptance criteria, TDD
  requirement); child sessions start empty.
- The main agent integrates the work, resolves conflicts, and owns the gates:
  never accept subagent output without running lint/typecheck/tests.
- Trivial mechanical work (typos, one-line edits, renames) does not need a
  subagent.

## 11. Sync awareness (mandatory for every feature)

Every feature must keep sync working. The app is local-first with per-account
cloud sync (see `docs/BACKEND.md` and ADR-0001/ADR-0004):

- Any change to the `GameDocument` shape, domain rules, or the store must
  consider the sync path: schema versioning/migrations, server rule validation
  (the API enforces `parseDocument`), and the conservative 3-way auto-merge
  (`tryAutoMerge` in `packages/core` merges only disjoint edits).
- New resolvable state (counters, collections, run progress) must define how
  concurrent edits merge: disjoint-wins, additive counters, or explicit
  conflict. Never rely on silent last-write-wins.
- If the change touches a sync-critical path (domain/state/content/shell,
  API, shared packages, E2E config), update `apps/web/e2e/sync.spec.ts` and
  verify `pnpm test:e2e`.
- Never persist an unvalidated document as the merge base; the `:base` key
  refreshes automatically on successful push/pull.

## 12. Quality gates (must be green before opening a PR)

```bash
pnpm lint
pnpm typecheck
pnpm typecheck:e2e
pnpm test
pnpm build
```

`pnpm typecheck:e2e` compiles `e2e/` and `playwright.config.ts`, which the
application `tsc -b` build does not include. If any gate fails, fix it on the
branch before opening the PR. Never open a PR with red checks.

> Troubleshooting: if `pnpm build` fails in `@lifespire/api` with `EACCES`
> on `apps/api/dist`, that directory is root-owned from a previous privileged
> build. It is gitignored build output — fix ownership or delete it, then
> rebuild (`sudo chown -R "$(id -u):$(id -g)" apps/api/dist` or
> `sudo rm -rf apps/api/dist`). Never run builds as root.

## 13. Agent cleanup (mandatory before finishing)

When an agent finishes a session, it **must leave the environment clean**:

- **No running servers.** Stop any dev server (`pnpm dev`, `vite`, preview) and
  any background processes started during the session.
- **No leftover artifacts.** Remove temporary files, screenshots not meant to be
  committed, logs, and scratch files. Only commit intended changes.
- **No stray branches checked out.** Leave the repo on `main` (or on the session
  branch if the PR is still open and awaiting review), with a clean working tree
  except for intended uncommitted work.
- **No untracked noise.** `git status` should show only intentional changes.
- Report the branch name and PR URL to the user, then stop.

## 14. Session checklist (agent)

1. **Read this workflow** (§1) and run the backward-compatibility check (§2).
   If the change is breaking (or you are unsure), notify the user and wait for
   explicit approval before writing anything.
2. Create the session branch.
3. Implement the change on web (TDD, §6).
4. Present the web change to the user and wait for explicit approval.
5. Port the approved behavior to mobile (or record the documented per-client
   exemption).
6. Verify the approved behavior on desktop under the packaged shell, adding
   desktop-specific code only when the contract requires it.
7. Verify three-client parity (§8) with subagents and close the divergences.
8. Run the final code review (§9) and fix the load-bearing findings.
9. Run all quality gates, including `pnpm typecheck:e2e` (E2E too when critical
   paths changed).
10. **Register any new/moved/deleted `.md` file in `AGENTS.md`** (Fuentes de
    verdad) in the same change. A doc without a reference there is incomplete.
11. Push the branch and open the single PR of the session (no approval required
    to open).
12. Clean up: stop servers, remove artifacts, verify `git status`.
13. Report branch + PR URL; await user review/merge.