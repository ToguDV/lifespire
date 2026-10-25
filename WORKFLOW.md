# Workflow — LifeSpire

Standardized workflow for contributors and agents working on LifeSpire. English only.

## 1. Branching (one branch per session)

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

## 2. Commit format (Conventional Commits)

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

## 3. Pull requests

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
- **Screenshots** — for UI changes, before/after or light+dark.
- **Mobile parity** — the parity table from §6, or the documented exemption
  (§5) when the change has no mobile equivalent.
- **Code review** — the §7 review outcome: findings fixed, and the ones left
  open as accepted follow-ups.
- **Out of scope / follow-ups** — anything deliberately not addressed.

### Review & merge
- **One PR per session.** Never open a second PR to stage the mobile port or a
  follow-up: intermediate approvals (§5) happen on the session branch.
- PRs are opened **without requiring approval** to be created; the author (or
  agent) opens it and reports the URL.
- **The user reviews the PR and approves the merge.** Do not merge on the user's
  behalf unless explicitly asked.
- Prefer squash-merge for feature branches to keep `main` history clean.

## 4. Test-driven development (TDD)

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

## 5. Delivery order: web first, then mobile parity

LifeSpire ships two clients — web (`apps/web`) and Android (`apps/mobile`) —
that share `packages/core` and `packages/app-core`. To prevent divergent
implementations, every user-facing change follows this order:

1. **Design and implement on web only.** TDD applies (§4); keep the change
   small and reviewable.
2. **Ask the user to approve the web change.** Report the branch, the commit
   range, and what to look at (screen, flow, theme). Wait for explicit
   approval; do not start the mobile port speculatively. There is **one PR per
   session** (§3), so the web change is reviewed as commits on the session
   branch, not as a separate PR.
3. **Port the approved behavior to mobile.** Match interaction, copy, states,
   tokens (`apps/mobile/src/theme/tokens.ts`), accessibility, and persistence
   (`GameDocument`). Platform differences (native notifications, haptics, file
   system, navigation) are documented in `docs/MOBILE.md`.
4. **Verify parity** (§6) and only then run the final code review (§7).

Mobile parity is mandatory for anything that changes behavior or UI. Changes
with no plausible mobile equivalent (PWA/service-worker work, the sync API,
tooling, docs) are exempt: state the reason in the PR under
"Out of scope / follow-ups", and still check that no shared package
(`packages/core`, `packages/app-core`) changes behavior without the mobile side
being considered.

## 6. Parity verification (subagent-orchestrated)

Once the mobile port lands, verify that parity is real and not nominal:

- **Orchestrate at least two subagents in parallel**, one auditing `apps/web`
  and one auditing `apps/mobile`, against the same checklist: screens and
  navigation, copy and vocabulary from `GLOSARY.md`, empty/loading/error
  states, theme (light/dark), accessibility (44 px web / 48 dp Android, focus,
  TalkBack, reduced motion), and data (same `GameDocument` shape, migrations,
  export/import).
- The main agent synthesizes both reports into a parity table
  (behavior → web → mobile → equal/divergent) and decides: fix the divergence,
  or record it as an accepted follow-up with the user.
- **Do not move to the final code review while a functional divergence is
  open.** Present the table together with the mobile change.
- Very small changes (copy tweak, one-line style fix, mechanical rename) may be
  verified by the main agent itself; say so when reporting.

## 7. Final code review (mandatory)

After web and mobile are both approved and parity is verified, delegate a
review to the `code-reviewer` subagent (read-only; it must not change code)
covering:

- architecture and module boundaries per `docs/ARCHITECTURE.md` and
  `docs/MOBILE.md`;
- consistency across web, mobile, and shared packages (naming, state, tokens);
- bugs, edge cases, and regressions, including the date-injection rule for
  calendar-dependent logic;
- persistence and sync: schema versioning, migrations, and the conservative
  auto-merge in ADR-0004;
- tests: are the new behaviors covered, and at the right layer;
- simplicity (KISS/YAGNI) and leftover dead code.

Fix the findings that are load-bearing, re-run the quality gates (§10), and
report the remaining findings in the PR.

## 8. Delegating long tasks to subagents

Use subagents when a task is too large for one pass — several screens, a whole
flow ported to mobile, new test suites, or long verification loops:

- Split by area (web UI, mobile UI, tests, docs) and run independent workers in
  parallel, while keeping the order of §5 (web first, then mobile).
- Give each worker its own context (files, tokens, acceptance criteria, TDD
  requirement); child sessions start empty.
- The main agent integrates the work, resolves conflicts, and owns the gates:
  never accept subagent output without running lint/typecheck/tests.
- Trivial mechanical work (typos, one-line edits, renames) does not need a
  subagent.

## 9. Sync awareness (mandatory for every feature)

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

## 10. Quality gates (must be green before opening a PR)

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

## 11. Agent cleanup (mandatory before finishing)

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

## 12. Session checklist (agent)

1. Create the session branch.
2. Implement the change on web (TDD, §4).
3. Present the web change to the user and wait for explicit approval.
4. Port the approved behavior to mobile (or record the documented exemption).
5. Verify parity (§6) with subagents and close the divergences.
6. Run the final code review (§7) and fix the load-bearing findings.
7. Run all quality gates, including `pnpm typecheck:e2e` (E2E too when critical
   paths changed).
8. **Register any new/moved/deleted `.md` file in `AGENTS.md`** (Fuentes de
   verdad) in the same change. A doc without a reference there is incomplete.
9. Push the branch and open the single PR of the session (no approval required
   to open).
10. Clean up: stop servers, remove artifacts, verify `git status`.
11. Report branch + PR URL; await user review/merge.