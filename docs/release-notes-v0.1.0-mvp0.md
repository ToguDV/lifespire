# LifeSpire MVP-0 — release notes v0.1.0-mvp0

Status: **release candidate, ready to tag**. This document describes the local
demo that closes MVP-0. The tag `v0.1.0-mvp0` is intentionally **not created** in
this change; the orchestrator tags the final `mvp-0` commit after review.

- Branch: `mvp-0`
- Product spec: [`SPEC.md`](../SPEC.md)
- Acceptance evidence: [`acceptance-mvp0.md`](./acceptance-mvp0.md)
- Playtest protocol: [`playtest-plan.md`](./playtest-plan.md)
- Playtest results (internal dry run): [`playtest-results.md`](./playtest-results.md)
- PWA details: [`PWA.md`](./PWA.md)
- Architecture: [`ARCHITECTURE.md`](./ARCHITECTURE.md)

## 1. What this release is

LifeSpire turns a small set of goals and routines into a seven-day node map.
Each day the player chooses a path through four layers and a boss, completes or
skips real-world actions, and earns XP, gold, weekly progress and cosmetic
relics. A run closes after seven days with a weekly bonus.

MVP-0 is a **local-first vertical slice**, not a product launch:

- one local profile, no account, no backend, no sync;
- data lives in `localStorage` under `lifespire:mvp0`;
- installable as a PWA and usable offline after the first load;
- a development-only panel simulates days for testing;
- the visual direction is the accepted [`design/`](../design) system, with no
  reused art or names from *Slay the Spire*.

## 2. What is included

- Onboarding with demo data (two aims, five routines) or a four-step custom
  wizard (name, aims, routines, review).
- One to three goals, each with routines and a weekly objective.
- A deterministic seven-day run. The map is generated once per day and locked.
- Maps with four decision layers, two to three nodes per layer and a boss; every
  node is reachable and has a path to the boss.
- Node types: task, elite, rest, treasure and boss.
- Path selection, complete/skip, instant rewards and weekly progress.
- XP, display-only levels, gold and a 12-item cosmetic relic collection.
- Duplicate relics converted to gold.
- Day summary, run summary, weekly bonus, guaranteed rare when every aim is met.
- A new run that keeps the profile, XP, gold, level and collection.
- Goals/routines CRUD, including archive/restore and run-safe validation.
- Profile/reliquary, light/dark/system theme.
- Versioned JSON export/import with validation and a preview; a typed `RESET`
  confirmation for reset.
- Corrupt/future-save recovery that does not overwrite the blocked document.
- Development panel (development build only): advance a day, start a demo run,
  restart the run, reset all data.
- PWA manifest, icons, service worker and offline app-shell cache.

Explicitly out of scope: accounts, backend, synchronization, push notifications,
deployment, combat/cards/deckbuilding, a shop or gold sink, relics with effects,
automatic task verification, calendar/health integrations, social features,
native apps, missed-day recovery, multiple simultaneous runs, i18n, analytics and
monetization.

## 3. How to run locally

Requirements: Node 24 (`.nvmrc`) and pnpm 11 (`packageManager` in
`package.json`).

```bash
git checkout mvp-0
pnpm install --frozen-lockfile
pnpm dev
# open http://localhost:5173
```

Quality gates:

```bash
pnpm lint       # oxlint
pnpm typecheck  # tsc -b
pnpm test       # vitest run
pnpm build      # typecheck + production build + PWA service worker
```

Production build and PWA check:

```bash
pnpm preview --port 4173
# open http://localhost:4173, reload once, then enable Offline in DevTools
```

First-run flow:

1. Open the app with empty storage.
2. Choose **Begin with demo data** (or create your own aims and routines).
3. Open today's path, select a node and read its rewards.
4. Use **Mark complete** or **Skip this step**; the rewards and weekly progress
   update immediately.
5. Complete or skip the boss to close the day and read the summary.
6. The next day is locked until midnight. Use the dev panel in `pnpm dev` to
   simulate days.
7. After seven days, read the run summary, then start a new run.
8. Use Settings → Export save to make a copy; Settings → Import save restores it.
   Reset requires typing `RESET`.

The dev clock offset is not persisted. Run reload checks on real day 1, before
advancing the dev clock; do not reload between simulated days.

## 4. Quality and verification

Final clean-worktree verification was run from a detached worktree of `mvp-0`:

```bash
git worktree add --detach /tmp/opencode/lifespire-release mvp-0
cd /tmp/opencode/lifespire-release
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm preview --port 4183
```

Results:

| Gate | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Pass |
| `pnpm lint` (oxlint) | Pass |
| `pnpm typecheck` (`tsc -b`) | Pass |
| `pnpm test` | **24 files, 296 tests passed** |
| `pnpm build` | Pass; Vite production build + PWA service worker, 16 precache entries |
| Production load | Pass |
| PWA manifest + activated service worker | Pass |
| Offline reload | Pass — app shell and persisted profile/run loaded with the network offline |
| Dev panel in production | Absent (no “Dev panel” text or trigger) |
| 360 px layout | Pass — no horizontal document overflow |
| Export/import | Pass — schema v1 JSON, preview, replace, state restored |
| Reset | Pass — exact `RESET` phrase, returns to onboarding |

The clean-worktree pass used Chromium via Playwright on Linux. It re-checked the
critical acceptance items; the full 12-item matrix from M3-07 remains in
[`acceptance-mvp0.md`](./acceptance-mvp0.md).

## 5. Acceptance matrix (SPEC §10)

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Fresh onboarding with demo data and a started run | **Pass** | Clean production build: “Begin with demo data” created `Wren`, two aims, five routines, run and day 1 map. |
| 2 | Four layers + boss, 2–3 nodes/layer, at least two paths, all reachable | **Pass** | Inspected the final build map: layers `[2,3,2,3]`, 11 nodes, 14 start→boss paths, all nodes reachable from the start and able to reach the boss, 1+ task per layer, 2 elites, boss with no outgoing edge. Generator invariants covered by tests. |
| 3 | Complete a task; XP, gold and weekly progress update | **Pass** | “Write one page” (medium) → +15 XP, +15 gold, Craft 0→1/3, toast and path updated. |
| 4 | Reload preserves map, path and rewards | **Pass** | Reload after a completion kept the same map id, path length, XP 15 and gold 15. |
| 5 | Skip advances without a reward | **Pass** | Skip recorded `action: 'skip'`, path 1→2 and XP/gold unchanged; toast said “Step skipped · no XP, gold, loot or weekly progress.” |
| 6 | Complete boss → day summary with bonus; skip boss → no bonus | **Pass** | Final build day 1: +20 XP/+20 gold closing bonus in the summary. Dev dry run day 2: boss skipped, bonus “Forfeited”, no XP/gold for that node. |
| 7 | Dev panel advances a day; previous day locked and a new map appears | **Pass in dev build** | M3-07 acceptance and the internal dry run: after advance, day 1 stayed `completed`, day 2 became `available`, a distinct map was generated. The panel is intentionally absent from production. |
| 8 | Seven simulated days → run summary with aims, bonus and loot | **Pass in dev build** | Internal dry run: 7/7 days, 35 steps (11 kept, 24 skipped), +465 XP, +535 gold, 6 relics, both aims met, weekly bonus +200 XP/+245 gold incl. duplicate gold. Domain tests cover 0/partial/all objectives. |
| 9 | New run keeps profile, XP, gold and collection | **Pass** | Internal dry run: level 5, 465 XP, 535 gold and 6 relics survived; run reset to day 1 with days 2–7 locked. |
| 10 | 360 px and desktop; PWA install and offline reload | **Pass with accepted limitation** | Final build: 360×800 has no document overflow; offline reload and activated service worker pass. Native install prompt on a physical phone is not verifiable here because installation requires HTTPS; the manifest/icons/service worker are present. |
| 11 | Export/import restores the state | **Pass** | Final build: exported schema v1 JSON (12,084 bytes), reset, created a fresh demo, imported the file, preview showed Wren/level 1/0 gold/day 1, replace restored the original run and map ids. |
| 12 | Generation, reward and weekly-close tests are green | **Pass** | `pnpm test`: 24 files, 296 tests, including `generator`, `rewards`, `runClose`, `lifecycle` and `schema`. |

No acceptance criterion is silently waived. Criterion 10's native-install part is
recorded as an accepted limitation, not as a pass.

## 6. Playtest status and highlights

- The protocol is written and repeatable: [`playtest-plan.md`](./playtest-plan.md).
- One **facilitator dry run** was executed: [`playtest-results.md`](./playtest-results.md).
  It covered onboarding, day 1, reload/tab-close persistence, day 2 with a
  skipped boss, day 3, a compressed seven-day close, a new run and reset.
- Onboarding + day 1 took about **53 seconds** for a facilitator who knew the
  flow. This is a mechanical timing, **not** a new-user result.
- No data loss in the reload and tab-close checks; no blocker; no console errors.
- Four copy/legibility fixes came out of the dry run: “four layers” instead of
  “four choices”, correct singular trade-off copy, effort visible in the path
  rail, and “No new relic this week” in the closed-week empty state.
- **External testers have not been run.** The SPEC §2 criteria about real
  comprehension, return intent and 3-of-5 completion remain **unvalidated**.
  The release is a local demo with a rehearsed protocol, not a validated habit
  product.

## 7. Known limitations

- **No backend, accounts, sync or cloud backup.** One browser profile only; data
  is lost if the browser storage is cleared without an export.
- **No public deployment.** The app is served locally. A phone cannot install it
  from a plain `http://<LAN-IP>` origin; installation and service workers require
  HTTPS (or `localhost` on the same device). A tunnel is not a production
  deployment.
- **No missed-day recovery.** A day not closed before local midnight is marked
  `missed`; the run continues. This is the SPEC §12 default.
- **One active run.** A new run replaces the previous run record; the profile,
  XP, gold and collection are kept, but past run maps/summaries are not stored.
- **No gold sink or shop.** Gold is a progress score in MVP-0.
- **No relic effects.** The collection is cosmetic.
- **Dev clock is volatile.** The development offset is not persisted and the
  panel is absent from production. Do not reload between simulated days.
- **No cross-browser/device certification.** Verification used Chromium on
  Linux at 360, 768 and 1280 widths; phone install and Safari/Firefox were not
  exercised.
- **External playtest pending.** The 3–5 tester round, return intent and
  comprehension evidence are not part of this release.
- **Accessibility is MVP-level.** Focus, keyboard, touch targets, contrast and
  reduced motion were checked in M3-07; a formal WCAG audit is out of scope.
- **Run label is always “Run I”.** There is no run counter/history in the schema.
- **Analytics and telemetry are absent by design.** There is no usage data to
  inspect after a session.

## 8. Release decision

MVP-0 is ready to tag as **`v0.1.0-mvp0`** as a local demo and a mechanically
complete vertical slice. The release commit is the `mvp-0` commit that contains
this document; the orchestrator creates the annotated tag after review.

Do not describe this release as “validated with users” or “retention-proven”.
The external playtest is the next milestone. The honest claim is: the loop is
complete, the acceptance matrix passes (with the native-install limitation), the
build is reproducible from a clean worktree, and the playtest protocol is ready
to run.
