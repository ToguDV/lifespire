# Roadmap — phases M0 to M6

> **Status:** specification (v1.0, frozen 2026-10-18). Each phase ends in a playable/usable increment; there are no target dates (personal project), there are **verifiable exit criteria**.
> **Agreed order:** Local web → backend/sync → AI → desktop → Android → polish.

---

## Definitions

- **Playable MVP** = **M0 + M1**: the complete one-week roguelike loop on web with local data (no backend or AI).
- **Truly usable MVP** = **M0–M3**: multi-device with synchronization and AI.
- **Exit criterion:** list of concrete verifications; a phase is not considered closed if any of them fails.

---

## M0 — Local playable core (web)

**Objective:** validate as fast as possible that the "real task → map → reward" loop hooks.

**Scope:**

- Monorepo (pnpm + Turborepo) with `engine`, `web`, `shared-types`, `design-tokens`, `config`.
- `engine` v0: deterministic RNG, daily seed, map generation with the **M0 rule profile** (declared in `packages/engine/balance/*.json`: only `enemy` and `elite` node types, 8 rows — 7 plus the final row, 2–4 nodes per row, row 1 always Enemy, 2–3 paths that reconverge, and the Rest/Shop and Boss guarantees disabled), balance JSON, SVG layout, gold/XP formulas and drops.
- Web: shell, interactive map, node and path selection, task/timer/evidence screens (blobs in IndexedDB), rewards, day close and basic history.
- Nodes: **only Enemy and Elite**. Tasks: manual creation + templates + simple routines.
- **i18n from day 1 (es)** (i18next + react-i18next, one namespace per screen, keys in English, source locale `es`).
- PWA: installable and playable offline after the first load.

**Out of scope:** HP, damage, death or failure with consequences (a failed node is a `skipped` task: no reward and no penalty); Rest/Shop/Events/Quests/Boss nodes, stats/skills; AI; account and server; desktop; mobile.

**Exit criteria:**

1. Play a full day (3–6 nodes) offline and with attached evidence.
2. Deterministic map: same seed + version ⇒ identical map across reloads and between client and simulator (golden tests).
3. Map invariants verified with fast-check (connectivity, guarantees, no orphan rows).
4. 3 days of continued use without blocking bugs.
5. Failing a node (Enemy/Elite) produces no consequence: the task becomes `skipped` and the day can still be closed.
6. The UI never shows HP, streak or quests, and the status indicator reads "local-only".

---

## M1 — Full gameplay (local)

**Objective:** close the full game design (a whole week) before investing in infrastructure.

**Scope:**

- Complete **HP, failure and death**: damage, death screen, harsh penalty (gold/items/streak), Phoenix Drop, day-close warnings.
- **Rest** (healing) and **weekly Boss** with template recap.
- **"?" Events** with personal decks (create/approve cards) and resolution (accept/decline/reroll).
- **Shop** (offers + guaranteed vouchers) and **inventory** with the full item catalog.
- **Daily quests** with automatic progress.
- **Progression:** level, XP, customizable stats (effect pool), skills with achievements.
- **Streaks:** freezes, vacation mode, day 7/30 rewards, smooth re-entry.
- **Goals → milestones → tasks** (manual flow; AI arrives in M3).
- Manual onboarding + first-map tutorial.
- Balance simulator (`pnpm sim:balance`) and first tuning pass against the GDD targets.

**Exit criteria:**

1. A full week playable with the weekly Boss and recap cycle.
2. Death flow tested end-to-end (including Phoenix Drop) without balance inconsistencies.
3. Monte Carlo simulator within targets: death on 5–10 % of days, gold/day 40–70, difficulty curve without jumps.
4. Simulation of 30 consecutive days (with absences and a vacation period) without corrupted states.

---

## M2 — Backend and synchronization

**Objective:** play on several devices with the economy audited by the server.

**Scope:**

- `apps/api` (NestJS): auth, users, goals, runs, economy (ledger), inventory, shop, quests, events, evidence, sync, notifications (base).
- Postgres + Prisma (model from [`data-model.md`](./data-model.md)) + Redis (queues) + S3-compatible storage for evidence.
- Complete offline-first sync ([`sync-offline.md`](./sync-offline.md)): outbox, push/pull, idempotency, WebSocket, re-sync, blob upload after reconnection.
- Connected web: migration of local data to the account, multi-device.
- JSON export and account deletion.
- CI/CD with e2e (including the mandatory sync protocol tests).

**Exit criteria:**

1. Two browsers/devices: same run, no duplicated rewards (two-device test in green).
2. Full day in airplane mode → sync → correct ledger and balances.
3. Idempotent operation replay (applying the same batch twice = same state).
4. Full re-sync after an invalid cursor without losing the outbox.
5. Auditable ledger: every currency/XP/HP has its entry and its origin.

---

## M3 — AI

**Objective:** the complete planning cycle assisted by AI, with controlled cost.

**Scope:**

- Configurable provider proxy + adapter (`AI_PROVIDER`), cache, budgets, BullMQ queue, kill switch, `AiUsage`.
- Complete flows ([`ai.md`](./ai.md)): `plan_goal`, `generate_tasks`, `suggest_decks`, `shop_offers`, `setup_stats_skills`, `weekly_recap`.
- Draft approval UI (milestones, tasks, cards, vouchers, stats/skills).
- Curated fallbacks enabled without friction.
- Golden prompt set + injection tests in CI.

**Exit criteria:**

1. Plan a real goal end to end (text → milestones → tasks → map) with human approval.
2. Kill switch tested: with AI off, all flows use the fallback and the game loses no features.
3. Guardrails in green (automatic rejections of prohibited content and of real-money spending).
4. Cost per user within the monthly budget; reasonable cache hit rate (> 30 % on `generate_tasks`).

---

## M4 — Desktop (Tauri v2)

**Objective:** native desktop app reusing the web build.

**Scope:**

- Tauri wrapper with local SQLite (same sync protocol), native notifications, system tray, signed auto-update, deep links.
- Installers for Linux, Windows and macOS.

**Exit criteria:**

1. Install, play a full day offline and sync without losses.
2. Timer-end notification with the app closed (or in the tray).
3. Smooth automatic update between two versions.
4. Functional parity with web in the daily flow (full planning can stay web-only).

---

## M5 — Android (Expo React Native)

**Objective:** complete the daily run from the phone, with camera and push.

**Scope:**

- Mobile UI of the loop: map (simplified for a small screen), task, timer, evidence with camera, results, day close, minimal settings and inventory.
- `expo-sqlite` (same local model), FCM/APNs push (timer end, day reminder, recap), local notifications for offline timers.
- Full offline + sync with the same protocol.

**Exit criteria:**

1. Full day from the phone in airplane mode; correct sync after 3 days offline.
2. Timer-end push with the app in the background or closed.
3. Photo evidence compressed and uploaded on reconnection.
4. No data loss after killing the app in the middle of a task.

---

## M6 — Polish and product

**Objective:** get it ready for sustained real use and for inviting trusted people.

**Scope:**

- i18n (add `en`; `es` ships from M0), AA accessibility, `prefers-reduced-motion`.
- History with heatmap, JSON export from all three platforms, configurable evidence retention.
- Full observability (Sentry, logs, alerts, product metrics), backups with tested restoration, operational runbook.
- Minimal landing + polished onboarding; stable `staging`/`prod` deploy.
- Decide the pending items of [`open-questions.md`](./open-questions.md) that apply to this stage.

**Exit criteria:**

1. Two weeks of stable use without critical incidents.
2. Backup restoration verified end to end.
3. New user completes onboarding → first day played without assistance.
4. All `docs/` documents updated to the real state of the product.

---

## Dependencies and risks

**Mandatory sequence:** M1 closes the design → M2 (the API depends on stable engine rules) → M3 (AI depends on the backend/proxy) → M4/M5 (clients depend on stable sync + protocol).

| Risk | Mitigation |
|---|---|
| Scope creep (especially in M1) | Phases with closed exit criteria; new stuff goes to "post-M6" |
| Poorly calibrated balance | Simulator + telemetry from M1; data-driven numbers (edit JSON, not code) |
| Runaway AI cost | Per-user/global budgets, cache, fallback, kill switch (M3) |
| Sync/determinism bugs | Golden tests shared by the client/server engine + mandatory protocol tests (M2) |
| Drift between platforms | Shared logic in `engine`; platform-specific UI (ADR-008) |
| Project motivation/energy | Each phase delivers something playable; nothing blocks "using the app" for more than one phase |

---

## Recommended work order within each phase

1. Engine and data (`engine` + balance) → 2. Minimum playable UI flow → 3. Rest of the UI → 4. Tests and golden files → 5. Updated documentation.

The documents `GDD.md`, `ARCHITECTURE.md` and `docs/` are considered **living deliverables**: each phase closes with a consistency review against what was implemented.
