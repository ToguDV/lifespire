# LifeSpire — SPEC

> High-level specification for the proof of concept.
> Status: approved for build.
> Last updated: 2026-10-23.

## 1. Summary

LifeSpire turns a person's goals and routines into a daily node map inspired by *Slay the Spire*. Each day the user chooses a path; each node represents a real-world action: a task, a rest, a treasure, a wheel, or the daily boss. A **run** lasts 7 days and has weekly objectives; the more the user completes, the more gold, XP, and loot they earn.

This document defines the current scope: a local-first vertical slice to validate the core loop on web and Android. It does not cover the full product vision.

## 2. Hypothesis and success criteria

**Hypothesis:** choosing a path with clear trade-offs and receiving visible rewards for real actions makes the user more likely to follow through on their routines and return the next day.

The POC must validate:

- That the user understands the map and why they chose their path.
- That rewards feel like a consequence of their actions, not randomness.
- That closing the day and the week feels satisfying.
- That the system is simple enough to use daily.

**It does not validate real retention**, because that requires several weeks of use. A week can be simulated with the dev panel.

Concrete criteria:

- A new user completes onboarding + day 1 in under 10 minutes using demo data.
- They can explain which node they chose, why, and what they earned.
- At least 3 out of 5 testers complete 3 simulated days and say they would come back.
- Zero data loss after reloading or closing the browser.

## 3. Scope

### Inside scope

- Responsive web app, installable as a PWA and functional offline after the first load.
- Native Android app (Expo/React Native) with the same daily loop, goals,
  collection, save format, import/export and optional account sync.
- A single local profile. Optional closed-beta sync: multi-user NestJS API
  with closed registration (admin invites) and snapshot sync between a user's
  devices; the app stays local-first and playable as a guest without a server.
  See `docs/BACKEND.md`.
- Onboarding with two options: demo data or create your own goals/routines.
- 1–10 goals, each with its routines/tasks and a weekly objective.
- A 7-day run with one map per day.
- Maps with 3–15 decision layers + a final boss, with 3–5 nodes per layer. Depth follows the goals that have at least one active routine and their weekly targets; routines shape layer width.
- Node types: task, elite, rest, treasure, wheel, and boss.
- Path selection, completing or skipping nodes, instant rewards.
- XP, simple leveling, gold, and collectible loot with no gameplay effects.
- Weekly objective progress, day summary, and run summary.
- New run while keeping the profile, gold, XP, and collection.
- Local persistence with JSON export/import and reset (localStorage on web,
  synchronous SQLite KV on Android; the save is interchangeable).
- Device-local notifications on Android: a daily map reminder, an evening nudge
  for an unresolved day, and a week-end reminder. Configurable times and
  toggles, deep link to the map, no push service.
- Dev panel to advance days and simulate a week.
- Unit tests for core logic: map generation, rewards, progress, and run completion.

### Outside scope

- Remote push notifications (accounts/sync exist as a closed-beta API; public
  signup, password recovery by email, and APNs/FCM push are still out).
- A verified iOS release, an in-app admin panel, and native sound feedback.
  The iOS code path exists but is not part of this release.
- Combat, cards, deckbuilding, relics with effects, shop, or economy.
- Calendar, health, or other app integrations.
- Automatic task verification, timers, or app blocking.
- Social features, rankings, complex achievements.
- A second native platform (iOS) verified in this release. The Android app is
  native; a web wrapper (Tauri/Capacitor) is no longer the plan.
- Recovering missed days, multiple simultaneous runs, i18n, themes, analytics, or monetization.

## 4. Concepts and rules

| Concept | Definition |
|---|---|
| **Goal** | The outcome the user is pursuing, for example "get fit". |
| **Routine / task** | A concrete, repeatable action, for example "work out for 30 minutes". |
| **Weekly target** (weekly objective in the domain model) | The number of times a goal must be completed during the run. |
| **Run** | A 7-day window starting from its creation. |
| **Day** | A map with a path that is resolved once. |
| **Node** | A stop on the map: task, elite, rest, treasure, wheel, or boss. |
| **Path** | The sequence of nodes chosen up to the boss. |
| **Daily boss** | The final node; completing it closes the day with a bonus. |

User-facing wording follows [`GLOSARY.md`](./GLOSARY.md): the interface says
goal, routine, and weekly target, while the code keeps the older "aim" names
for identifiers and styles.

Core rules:

1. A run requires between 1 and 10 goals and at least 4 active routines. Weekly objectives are derived from each goal's frequency and can be adjusted before starting.
2. Only the current day can be played. If it is not resolved before midnight, it is marked as **missed** and the run continues. For the POC there is no recovery of missed days.
3. The map is generated when the day is opened and then locked. There are no rerolls.
4. In each layer, exactly one node connected to the current node is chosen. The chosen node remains the current node until it is completed or skipped; the user can close the app and return the same day.
5. Completing grants rewards and, if it is a task, adds progress to its goal. Skipping grants 0, carries no penalty, and allows the user to advance. The user cannot go back.
6. Resolving the boss ends the day and shows the summary. If the boss is skipped, the day ends without the closing bonus.
7. On day 7, the run close is calculated: objectives met, weekly bonus, loot, and totals. A new run can then be started.
8. Editing goals or routines during the run only affects future maps: maps already drawn keep their steps and rewards. The goal icon is the exception; it is resolved when the map renders, so changing it updates the crest on the current map too.
9. The daily cutoff is local midnight. The POC trusts the device clock.
10. The app does not verify tasks: the user marks them as completed. This is acceptable for a personal app at this stage.

## 5. The map

The map is displayed bottom-up, as in *Slay the Spire*:

- An automatic start node.
- 3–15 decision layers with 3–5 nodes each. Depth grows with the goals that have at least one active routine and with their weekly targets: `layers = clamp(3, 15, goals + offset + floor(weeklyTargetSum / 7))`, where `offset = clamp(2, 5, 2 + floor(max(0, goals − 2) / 2))` and `weeklyTargetSum` only counts those goals. The goal term alone gives 1 → 3, 2 → 4, 3 → 5, 4 → 7, 5 → 8, 6 → 10, 7 → 11, 8 → 13, 9 → 14, and 10 → 15; every seven weekly targets add one layer, capped at 15.
- A single boss node at the end.
- In total, 4–16 nodes are resolved per day: 3–15 choices + boss.

Generation rules:

- Depth and width have separate inputs: goals with at least one active routine set the depth base (`goals + offset`, where `offset = clamp(2, 5, 2 + floor(max(0, goals − 2) / 2))`) and their weekly targets add one layer per seven points, capped at 15 layers; the active routine pool sets layer width (`max(3, min(5, pool + 1))`). One map is generated per day when the day is opened. Changing goals or routines only affects future maps; the current map never changes its steps or rewards. The goal crest is resolved at render, so icon edits also appear on the current map.
- Every node must be reachable from the start and must have a path to the boss.
- Each layer offers at least 3 options.
- Each node connects to 1–2 nodes in the next layer; multiple paths are allowed to converge.
- A node only connects to the nodes on the same lane and the two adjacent lanes, so no path jumps across the map.
- One layer boundary is a switchback: every connection there moves to an adjacent lane, so no start-to-boss route can avoid crossing lanes at least once.
- The width of a layer drifts by at most one node from the previous layer.
- At least one layer has an odd node count, so the exact centre lane appears once per map.
- Each layer includes at least one task node.
- There is at most one rest or treasure node per layer.
- 1–2 elite nodes appear per map.
- Repeated tasks within the same day are avoided when the pool allows it.
- The boss is preferably chosen from a goal with pending progress and high effort.
- The seed is derived from `runId + day index`, so reloading does not change the map.
- If there are not enough routines to fill all nodes, tasks may be repeated in different layers, never in the same layer.

Node types:

| Type | Action | Weekly progress | Reward |
|---|---|---|---|
| Task | Normal routine | +1 | XP and gold based on effort |
| Elite | Difficult routine | +1 | Double reward and a loot roll |
| Rest | Break, no task | — | Small XP |
| Treasure | Direct reward | — | Gold and a loot roll |
| Wheel | Mystery: task, gold, XP or rest | 0 or +1 | Surprise outcome (task rewards apply if a task is drawn) |
| Boss | Main task of the day | +1 | High reward + closing bonus |

Path choice must have visible trade-offs: tasks advance the week, treasures give an immediate reward but no progress, and elites give more resources in exchange for more effort.

## 6. Rewards and progression

Effort multiplier: light `×1`, medium `×1.5`, high `×2`.

| Node | XP | Gold | Loot | Progress |
|---|---|---|---|---|
| Task | 10 × multiplier | 10 × multiplier | — | +1 |
| Elite | 20 × multiplier | 20 × multiplier | 1 roll | +1 |
| Rest | 5 | 0 | — | — |
| Treasure | 0 | 15 | 1 roll | — |
| Wheel | 0 or task XP | 0 or 20 | — | 0 or +1 |
| Boss | 20 × multiplier + 20 | 20 × multiplier + 20 | 1 roll | +1 |

- **Loot:** a small pool of 10–12 items with common, rare, or epic rarity. No effects in the POC; it is a collection and fantasy element. Duplicates convert to gold.
- **Level:** 100 XP per level. It is display-only; there is no skill tree.
- **Gold:** in the POC it is a progress score. There is no shop or spending yet.
- **Weekly bonus:** each completed objective grants +50 XP, +50 gold, and 1 loot roll. If all are completed, +100 XP, +100 gold, and one guaranteed rare loot item.
- Node rewards are granted instantly. The weekly bonus is granted when the run closes.

## 7. Screens and flow

Minimum screens:

1. **Onboarding:** brief explanation, optional name, choose demo or create goals/routines, confirm weekly objectives.
2. **Home / Run:** current day, map access, objective progress, gold, XP, and level.
3. **Map:** main screen; traveled path, available nodes, locked nodes, and weekly objectives panel.
4. **Node detail:** task, associated goal, effort, reward, and progress; "Complete" and "Skip" buttons. The wheel spins on the node, then the reward recap opens on its own.
5. **Reward recap (wheel):** outcome summary with a "Done" button that records it; no way back, so no task is skipped by accident.
6. **Day summary:** chosen path, completed/skipped nodes, rewards, and weekly progress.
7. **Run summary:** days played/missed, objectives met, bonus, loot, and totals.
8. **Goals and routines:** minimal CRUD for goals, tasks, effort, weekly frequency, and the goal icon that marks its map nodes.
9. **Profile / collection:** level, XP, gold, and loot obtained.
10. **Settings:** export/import JSON, reset, and dev panel.

Daily flow:

1. The user opens the app and sees the day's map.
2. They choose an available node and review the task and its rewards.
3. They complete it in the real world and mark it, or skip it.
4. They receive rewards and advance to the next layer.
5. They repeat until the boss.
6. They close the day and see the summary.
7. The next day remains locked until the following day, except in dev mode.

## 8. Data model

| Entity | Key fields |
|---|---|
| **Profile** | id, name, XP, level, gold, loot, creation date |
| **Goal** | id, title, category, icon, weekly objective, active |
| **Task** | id, goalId, title, effort, active |
| **Run** | id, seed, start date, status, weekly objectives, days, totals |
| **Day** | date, status, map, path, resolved nodes, rewards |
| **Map** | id, seed, layers, boss node, current node |
| **MapNode** | id, layer, type, taskId, rewards, connections |
| **LootItem** | id, name, rarity, description, obtained date |
| **RewardEvent** | node, task, XP, gold, loot, affected goal |

Persistence: a single versioned JSON document in `localStorage`, with export/import to prevent data loss and facilitate testing.

## 9. Proposed architecture

- Web: React 19 + TypeScript + Vite, reusing the existing scaffold.
- Android: Expo SDK 58 + React Native 0.88 + TypeScript, consuming the same
  `@lifespire/core` domain and `@lifespire/app-core` store/sync package.
- Notifications: `expo-notifications`, a pure planner and a device scheduler;
  no server registration and no push credentials.
- PWA via `vite-plugin-pwa`: manifest, icons, and offline cache.
- Simple global state with Zustand + persist, or `useReducer` if avoiding dependencies is preferred.
- Domain logic in pure, testable functions: map generation, node resolution, reward calculation, and run evaluation.
- Map rendered with custom SVG; no graph library.
- CSS with custom tokens, mobile-first, no heavy UI kit.
- No router in the POC: navigation via view state.
- Vitest tests for core/web logic, Jest + jest-expo for the Android planner,
  Playwright E2E tests for critical web flows, and guided manual tests for the
  Android release checklist (docs/MOBILE.md).
- Dev panel only in the development environment: advance day, restart run, and reset data.
- Basic accessibility: nodes as buttons, visible focus, sufficient contrast, 44px touch targets, and reduced-motion support.
- Original visual direction inspired by dark fantasy, parchment, and gold; no reused art or names from *Slay the Spire*.

## 10. Acceptance criteria

The demo is considered complete when it can be run without failures:

1. Open the app from scratch, complete onboarding with demo data, and start a run.
2. See a map with 3–15 layers + boss (depth follows the goals with active routines and their weekly targets), 3–5 nodes per layer, at least three possible first choices, a forced lane crossing on every route, and all nodes reachable. Nodes that carry a routine show their goal's icon.
3. Choose a task, complete it, and see XP, gold, and weekly progress update.
4. Reload the page and confirm that the map, path, and rewards are preserved.
5. Skip a node and confirm that it advances without a reward.
6. Complete the boss and see the day summary with the bonus; on another day, skip it and confirm there is no bonus.
7. Advance a day with the dev panel and verify that the previous day is locked and a new map appears.
8. Complete 7 simulated days and see the run summary with objectives, bonus, and loot.
9. Start a new run and confirm that the profile, XP, gold, and collection are preserved.
10. Test the interface at 360px and on desktop; verify PWA installation and offline reload.
11. Export and import data, and confirm that the state is restored.
12. Export a web save, import it on Android, play a day, export it again and
    open it on web without losing the map, path, rewards or schema version.
13. On Android, enable notifications, verify the test notification, set a
    near-future reminder, tap it and land on the map; seal the day and confirm
    its reminder is cancelled. Disable reminders and confirm everything is
    cancelled, including after a force-stop.
14. Sign in on Android, play one day on Android and one on web, and verify
    snapshot sync plus the keep-mine/keep-cloud conflict path offline.
15. Run the tests for generation, rewards, weekly close, and the Android
    notification planner.

## 11. Build order

Each milestone must leave something playable or demonstrable:

- **M0 — Base:** domain types, store, persistence, demo data, visual tokens, and dev panel.
- **M1 — Map:** deterministic generator with tests, SVG rendering, path selection, and node detail.
- **M2 — Loop:** complete/skip, rewards, weekly progress, and day summary.
- **M3 — Run:** onboarding, goals/routines CRUD, weekly summary, new run, PWA, responsive layout, and export/import.
- **M4 — Playtest:** test with 3–5 people, adjust node count, rewards, and onboarding friction.
- **M5 — Android:** Expo shell, shared store/sync extraction, native auth,
  full screen parity, local notifications, save interchange and release
  checklist.

## 12. Risks and open decisions

| Risk | Mitigation |
|---|---|
| The map feels decorative | Visible trade-offs between progress, effort, and reward; validate with testers. |
| Scope creep toward a full RPG | No cards, combat, shop, or relics with effects in the POC. |
| Heavy onboarding | Demo data and a minimum of 4 routines. |
| A real week takes too long to provide feedback | Dev panel to simulate days and a 3-day test. |
| Local data loss | Export/import, versioned schema, and controlled reset. |
| Excessive resemblance to Slay the Spire | Mechanical inspiration only; original visual identity and content. |

Open decisions with a default proposal:

- Is skipping a node free? **Proposal:** yes, with no penalty beyond losing the reward and progress.
- Are missed days recoverable? **Proposal:** no in the POC.
- Are 4–16 nodes per day too many? **Proposal:** start there and adjust after the playtest.
- Does elite give 2 progress? **Proposal:** 1, to avoid distorting weekly objectives.
- Midnight or 4 a.m. cutoff? **Proposal:** midnight for simplicity.
- Does the run start any day or only on Monday? **Proposal:** any day, with a 7-day window.

## 13. Future beyond the MVP

Remote push notifications, shop and gold sinks, relics/cards with effects,
social features and rankings, calendar or health integrations, missed-day
recovery mode, adaptive content, and an iOS release. Device-local Android
reminders are in scope; sync between a user's devices exists as a closed-beta
API (`docs/BACKEND.md`); public signup, email delivery and realtime are not
part of the current scope.
