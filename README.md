# LifeSpire

**Turn your goals and routines into a daily node map.**

LifeSpire turns a person's goals and routines into a daily node map inspired by
*Slay the Spire*. Each day you choose a path; each node is a real-world action
(a task, a rest, a treasure, or the daily boss). A **run** lasts 7 days with
weekly objectives — the more you complete, the more gold, XP, and loot you earn.

It's a local-first web app: a single profile, no accounts, no backend. Installable
as a PWA and fully usable offline after the first load.

The node map is the heart of the app: each day you pick a path through 4 layers
plus a boss, with visible trade-offs between progress, effort, and reward.

---

## Quick start

```bash
pnpm install --frozen-lockfile
pnpm dev        # dev server
```

Open the printed URL. On first launch you can load **demo data** and start a run
in one click, or create your own goals and routines.

### Requirements

- Node 24 (see `.nvmrc`)
- pnpm 11 (see `packageManager` in `package.json`)

### Scripts

```bash
pnpm lint       # oxlint
pnpm typecheck  # TypeScript (tsc -b)
pnpm test       # Vitest
pnpm build      # typecheck + production build
pnpm preview    # serve the build (test PWA / offline)
```

---

## How it works

1. **Onboarding** — pick demo data or create 1–3 goals with their routines.
2. **Each day** — open the day's map (4 decision layers + a boss, 2–3 nodes per
   layer), pick a node, complete the real-world action, mark it done.
3. **Rewards** — XP, gold, and loot are granted instantly. Tasks also add
   progress to their goal's weekly objective.
4. **Close the day** — resolving the boss ends the day with a bonus.
5. **Close the run** — after 7 days you get a weekly summary with bonuses and
   loot. Start a new run keeping your profile, gold, XP, and collection.

Path choice has visible trade-offs: tasks advance the week, treasures pay
immediately but give no progress, elites pay double in exchange for more effort.

---

## Scope

**In scope**

- Onboarding with demo or custom data; 1–3 goals with routines
- 7-day runs with deterministic maps (4 layers + boss)
- Node types: task, elite, rest, treasure, boss
- Instant rewards (XP, gold, loot), weekly progress, day & run summaries
- New run keeping profile, gold, XP, and collection
- Local persistence with JSON export/import and reset
- Dev panel to advance days and simulate a week
- PWA, offline after first load, responsive (360px → desktop)

**Out of scope**

Accounts, backend, sync, notifications, combat, cards, deckbuilding, shop,
relics with gameplay effects, calendar/health integrations, automatic task
verification, social features, native apps.

> Relics are a **collection** in the current scope (12 items, rarities, duplicates
> convert to gold). Gameplay-effect relics are deliberately deferred — see
> [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) §8.

---

## Project layout

```
src/
  domain/      pure, testable logic (map, rewards, lifecycle, run close, schema)
  content/     loot catalog + demo factory
  state/       Zustand store + persist + injectable clock
  ui/          components & screens (no router — view state)
  styles/      tokens + app styles
```

Maps are rendered with custom SVG. No graph library, no UI kit.

---

## Documentation

- Spec & rules: [`SPEC.md`](./SPEC.md)
- Architecture & contracts: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- Design system: [`design/DESIGN.md`](./design/DESIGN.md) — the spec the app implements
- UI notes: [`docs/UI.md`](./docs/UI.md)
- PWA / offline: [`docs/PWA.md`](./docs/PWA.md)
- Playtest protocol: [`docs/playtest-plan.md`](./docs/playtest-plan.md)
- Agent guide: [`AGENTS.md`](./AGENTS.md)

---

## Persistence

All game state lives in a single versioned `localStorage` key. Settings →
export/import produces a readable JSON backup or restores one. The dev panel
only exists in `pnpm dev`.

---

## Branch

Everything lives on `main`, the development and release line. Use short-lived
branches (`feat/...`, `fix/...`) for larger changes and merge back.

```bash
git checkout main
```