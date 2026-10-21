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
  - `pnpm test` — pass/fail (note any new/updated tests)
  - `pnpm build` — pass/fail
  - Manual checks performed (screen sizes, theme, offline, etc.)
- **Screenshots** — for UI changes, before/after or light+dark.
- **Out of scope / follow-ups** — anything deliberately not addressed.

### Review & merge
- PRs are opened **without requiring approval** to be created; the author (or
  agent) opens it and reports the URL.
- **The user reviews the PR and approves the merge.** Do not merge on the user's
  behalf unless explicitly asked.
- Prefer squash-merge for feature branches to keep `main` history clean.

## 4. Quality gates (must be green before opening a PR)

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If any gate fails, fix it on the branch before opening the PR. Never open a PR
with red checks.

## 5. Agent cleanup (mandatory before finishing)

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

## 6. Session checklist (agent)

1. Create session branch.
2. Make changes; commit with conventional format.
3. Run all quality gates.
4. Push branch and open PR (no approval required to open).
5. Clean up: stop servers, remove artifacts, verify `git status`.
6. Report branch + PR URL; await user review/merge.