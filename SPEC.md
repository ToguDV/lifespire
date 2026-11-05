# LifeSpire — SPEC

> High-level specification for the proof of concept.
> Status: approved for build.
> Last updated: 2026-10-23.

## 1. Summary

LifeSpire turns a person's quests and trials into a daily encounter map inspired by *Slay the Spire*. Each day the user chooses a route; each encounter represents a real-world action: a trial, a respite, a hoard, a wheel of fortune, or the daily warden. A **journey** lasts 7 days and has weekly vows; the more the user completes, the more gold, XP, and spoils they earn.

This document defines the current scope: a local-first vertical slice to validate the core loop on web and Android. It does not cover the full product vision.

## 2. Hypothesis and success criteria

**Hypothesis:** choosing a route with clear trade-offs and receiving visible rewards for real actions makes the user more likely to follow through on their trials and return the next day.

The POC must validate:

- That the user understands the map and why they chose their route.
- That rewards feel like a consequence of their actions, not randomness.
- That closing the day and the week feels satisfying.
- That the system is simple enough to use daily.

**It does not validate real retention**, because that requires several weeks of use. A week can be simulated with the dev panel.

Concrete criteria:

- A new user completes onboarding + day 1 in under 10 minutes using demo data.
- They can explain which encounter they chose, why, and what they earned.
- At least 3 out of 5 testers complete 3 simulated days and say they would come back.
- Zero data loss after reloading or closing the browser.

## 3. Scope

### Inside scope

- Responsive web app, installable as a PWA and functional offline after the first load.
- Desktop app (Electron) that reuses the web build unchanged, with unsigned
  installers for Linux (`.deb`, AppImage, `tar.gz`) and Windows (NSIS `.exe`,
  portable zip). See `docs/DESKTOP.md`.
- Native Android app (Expo/React Native) with the same daily loop, quests,
  collection, save format, import/export and optional nearby sync.
- A single local profile. Optional serverless nearby sync between the user's
  Android and desktop apps over the local network: UDP discovery, self-signed
  HTTPS with certificate pinning, QR/code pairing and conservative auto-merge.
  No accounts, passwords, email or cloud copy. The browser stays local-only and
  uses export/import. See `docs/adr/0007-local-lan-sync.md`.
- Onboarding with two options: demo data or create your own quests/trials.
- 1–10 quests, each with its trials and a weekly vow.
- A 7-day journey with one map per day.
- Maps with 3–15 decision layers + a final warden, with 3–5 encounters per layer. Depth follows the quests that have at least one active trial and their weekly vows; trials shape layer width.
- Encounter types: trial, elite, respite, hoard, wheel of fortune, and warden.
- Route selection, claiming or passing encounters, instant rewards.
- XP, simple leveling, gold, and collectible spoils with no gameplay effects.
- Weekly vow progress, day summary, and journey summary.
- New journey while keeping the profile, gold, XP, and collection.
- Local persistence with JSON export/import and reset (localStorage on web,
  synchronous SQLite KV on Android; the save is interchangeable).
- Device-local notifications on Android: a daily map reminder, an evening nudge
  for an unresolved day, and a week-end reminder. Configurable times and
  toggles, deep link to the map, no push service.
- Dev panel to advance days and simulate a week.
- Unit tests for core logic: map generation, rewards, progress, and journey completion.

### Outside scope

- Remote push notifications (APNs/FCM), public signup and password recovery:
  there are no accounts or servers.
- A verified iOS release, an in-app admin panel, and native sound feedback.
  The iOS code path exists but is not part of this release.
- Combat, cards, deckbuilding, relics with effects, shop, or economy.
- Calendar, health, or other app integrations.
- Automatic task verification, timers, or app blocking.
- Social features, rankings, complex achievements.
- A second native platform (iOS) verified in this release. The Android app is
  native; desktop ships as an Electron shell around the web build (see
  `docs/DESKTOP.md`), not a second UI. A Tauri/Capacitor wrapper is not planned.
- Recovering lost days, multiple simultaneous journeys, i18n, themes, analytics, or monetization.

## 4. Concepts and rules

| Concept | Definition |
|---|---|
| **Quest** | The outcome the user is pursuing, for example "get fit". |
| **Trial** | A concrete, repeatable action, for example "work out for 30 minutes". |
| **Weekly vow** (weekly objective in the domain model) | The number of times a quest must be completed during the journey. |
| **Journey** | A 7-day window starting from its creation. |
| **Day** | A map with a route that is resolved once. |
| **Encounter** | A stop on the map: trial, elite, respite, hoard, wheel of fortune, or warden. |
| **Route** | The sequence of encounters chosen up to the warden. |
| **Warden** | The final encounter; claiming it closes the day with a bonus. |

User-facing wording follows [`GLOSARY.md`](./GLOSARY.md): the interface says
quest, trial, weekly vow, journey, encounter, route and warden, while the code
keeps the older "aim", "goal", "task", "routine", "run", "node" and "boss"
identifiers and styles.

Core rules:

1. A journey requires between 1 and 10 quests and at least 4 active trials. Weekly vows are derived from each quest's frequency and can be adjusted before starting.
2. Only the current day can be played. If it is not resolved before midnight, it is marked as **lost** and the journey continues. For the POC there is no recovery of lost days.
3. The map is generated when the day is opened and then locked. There are no rerolls.
4. In each layer, exactly one encounter connected to the current encounter is chosen. The chosen encounter remains the current encounter until it is claimed or passed; the user can close the app and return the same day.
5. Claiming grants rewards and, if it is a trial, adds progress to its quest. Passing grants 0, carries no penalty, and allows the user to advance. The user cannot go back.
6. Claiming the warden ends the day and shows the summary. If the warden is passed, the day ends without the closing bonus.
7. On day 7, the journey close is calculated: vows met, the vow bonus, spoils, and totals. A new journey can then be started.
8. Editing quests or trials during the journey applies from the next day, or today after abandoning the day: maps already drawn keep their steps and rewards. New quests join the weekly panel, edited titles/vows update it, and archived quests leave it. The quest icon is the exception; it is resolved when the map renders, so changing it updates the crest on the current map too. The player may abandon today at will (with confirmation); its map, XP, gold, spoils and progress are taken back.
9. The daily cutoff is local midnight. The POC trusts the device clock.
10. The app does not verify trials: the user marks them as claimed. This is acceptable for a personal app at this stage.

## 5. The map

The map is displayed bottom-up, as in *Slay the Spire*:

- An automatic start encounter.
- 3–15 decision layers with 3–5 encounters each. Depth grows with the quests that have at least one active trial and with their weekly vows: `layers = clamp(3, 15, quests + offset + floor(weeklyVowSum / 7))`, where `offset = clamp(2, 5, 2 + floor(max(0, quests − 2) / 2))` and `weeklyVowSum` only counts those quests. The quest term alone gives 1 → 3, 2 → 4, 3 → 5, 4 → 7, 5 → 8, 6 → 10, 7 → 11, 8 → 13, 9 → 14, and 10 → 15; every seven weekly vows add one layer, capped at 15.
- A single warden encounter at the end.
- In total, 4–16 encounters are resolved per day: 3–15 choices + warden.

Generation rules:

- Depth and width have separate inputs: quests with at least one active trial set the depth base (`quests + offset`, where `offset = clamp(2, 5, 2 + floor(max(0, quests − 2) / 2))`) and their weekly vows add one layer per seven points, capped at 15 layers; the active trial pool sets layer width (`max(3, min(5, pool + 1))`). One map is generated per day when the day is opened. Changing quests or trials only affects future maps; the current map never changes its steps or rewards. The quest crest is resolved at render, so icon edits also appear on the current map.
- Every encounter must be reachable from the start and must have a route to the warden.
- Each layer offers at least 3 options.
- Each encounter connects to 1–2 encounters in the next layer; multiple routes are allowed to converge.
- An encounter only connects to the encounters on the same lane and the two adjacent lanes, so no route jumps across the map.
- One layer boundary is a switchback: every connection there moves to an adjacent lane, so no start-to-warden route can avoid crossing lanes at least once.
- The width of a layer drifts by at most one encounter from the previous layer.
- At least one layer has an odd encounter count, so the exact centre lane appears once per map.
- Each layer includes at least one trial encounter.
- There is at most one respite or hoard encounter per layer.
- 1–2 elite encounters appear per map.
- Repeated trials within the same day are avoided when the pool allows it.
- The warden is preferably chosen from a quest with pending progress and high difficulty.
- The seed is derived from `runId + day index`, so reloading does not change the map.
- If there are not enough trials to fill all encounters, trials may be repeated in different layers, never in the same layer.

Encounter types:

| Type | Action | Weekly progress | Reward |
|---|---|---|---|
| Trial | Normal trial | +1 | XP and gold based on difficulty |
| Elite | Difficult trial | +1 | Double reward and a spoils roll |
| Respite | Break, no trial | — | Small XP |
| Hoard | Direct reward | — | Gold and a spoils roll |
| Wheel of Fortune | Mystery: trial, gold, XP or respite | 0 or +1 | Surprise outcome (trial rewards apply if a trial is drawn) |
| Warden | Main trial of the day | +1 | High reward + closing bonus |

Route choice must have visible trade-offs: trials advance the week, hoards give an immediate reward but no progress, and elites give more resources in exchange for more difficulty.

## 6. Rewards and progression

Difficulty multiplier: Easy `×1`, Standard `×1.5`, Hard `×2`.

| Encounter | XP | Gold | Spoils | Progress |
|---|---|---|---|---|
| Trial | 10 × multiplier | 10 × multiplier | — | +1 |
| Elite | 20 × multiplier | 20 × multiplier | 1 roll | +1 |
| Respite | 5 | 0 | — | — |
| Hoard | 0 | 15 | 1 roll | — |
| Wheel of Fortune | 0 or trial XP | 0 or 20 | — | 0 or +1 |
| Warden | 20 × multiplier + 20 | 20 × multiplier + 20 | 1 roll | +1 |

- **Spoils:** a small pool of 10–12 items with common, rare, or epic rarity. No effects in the POC; it is a collection and fantasy element. Duplicates convert to gold.
- **Level:** 100 XP per level. It is display-only; there is no skill tree.
- **Gold:** in the POC it is a progress score. There is no shop or spending yet.
- **Vow bonus:** each met vow grants +50 XP, +50 gold, and 1 spoils roll. If all are met, +100 XP, +100 gold, and one guaranteed rare spoil item.
- Encounter rewards are granted instantly. The vow bonus is granted when the journey closes.

## 7. Screens and flow

Minimum screens:

1. **Onboarding:** quest-style tutorial (origin, quests, review), optional name, choose demo or create quests/trials with descriptions, confirm weekly vows.
2. **Home / Journey:** current day, map access, vow progress, gold, XP, level, and a confirmed "Abandon today" that replays the day without its rewards.
3. **Map:** main screen; traveled route, available encounters, locked encounters, weekly vows panel, first-day coach hints, and the same confirmed "Abandon today".
4. **Encounter detail:** trial, associated quest, difficulty, reward, and progress; "Claim" and "Pass" buttons. The wheel of fortune spins on the encounter, then the reward recap opens on its own.
5. **Reward recap (wheel):** outcome summary with a "Done" button that records it; no way back, so no trial is passed by accident.
6. **Day summary:** chosen route, claimed/passed encounters, rewards, and vow progress.
7. **Journey summary:** days kept/lost, vows met, bonus, spoils, and totals.
8. **Quests and trials:** minimal CRUD for quests (with optional description), trials, difficulty, weekly frequency, and the quest icon that marks its map encounters.
9. **Wayfarer / collection:** level, XP, gold, and spoils obtained.
10. **Settings:** export/import JSON, reset, and dev panel.

Daily flow:

1. The user opens the app and sees the day's map.
2. They choose an available encounter and review the trial and its rewards.
3. They claim it in the real world and mark it, or pass it.
4. They receive rewards and advance to the next layer.
5. They repeat until the warden.
6. They close the day and see the summary.
7. The next day remains locked until the following day, except in dev mode.

## 8. Data model

The table keeps the persisted/code names. The interface calls **Goal → Quest**,
**Task → Trial**, **Run → Journey**, **MapNode → Encounter**, **Effort →
Difficulty**, **Boss → Warden**, **Path → Route**, **Profile → Wayfarer** and
**LootItem → Relic/Spoils**; the stored document is unchanged.

| Entity | Key fields |
|---|---|
| **Profile** | id, name, XP, level, gold, loot, creation date |
| **Goal** | id, title, category, description (optional, ≤280), icon, weekly objective, active |
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
- Desktop: Electron shell (`apps/desktop`) that serves the production web build
  from a custom `lifespire-app://app` origin; `electron-builder` produces the
  Linux and Windows installers. No separate UI.
- Android: Expo SDK 58 + React Native 0.88 + TypeScript, consuming the same
  `@lifespire/core` domain and `@lifespire/app-core` store/sync package.
- Notifications: `expo-notifications`, a pure planner and a device scheduler;
  no server registration and no push credentials.
- PWA via `vite-plugin-pwa`: manifest, icons, and offline cache.
- Simple global state with Zustand + persist, or `useReducer` if avoiding dependencies is preferred.
- Domain logic in pure, testable functions: map generation, encounter resolution, reward calculation, and journey evaluation.
- Map rendered with custom SVG; no graph library.
- CSS with custom tokens, mobile-first, no heavy UI kit.
- No router in the POC: navigation via view state.
- Vitest tests for core/web logic, Jest + jest-expo for the Android planner,
  Playwright E2E tests for critical web flows, and guided manual tests for the
  Android release checklist (docs/MOBILE.md).
- Dev panel only in the development environment: advance day, restart journey, and reset data.
- Basic accessibility: encounters as buttons, visible focus, sufficient contrast, 44px touch targets, and reduced-motion support.
- Original visual direction inspired by dark fantasy, parchment, and gold; no reused art or names from *Slay the Spire*.

## 10. Acceptance criteria

The demo is considered complete when it can be run without failures:

1. Open the app from scratch, complete onboarding with demo data, and start a journey.
2. See a map with 3–15 layers + warden (depth follows the quests with active trials and their weekly vows), 3–5 encounters per layer, at least three possible first choices, a forced lane crossing on every route, and all encounters reachable. Encounters that carry a trial show their quest's icon.
3. Choose a trial, claim it, and see XP, gold, and vow progress update.
4. Reload the page and confirm that the map, route, and rewards are preserved.
5. Pass an encounter and confirm that it advances without a reward.
6. Claim the warden and see the day summary with the bonus; on another day, pass it and confirm there is no bonus.
7. Advance a day with the dev panel and verify that the previous day is locked and a new map appears.
8. Complete 7 simulated days and see the journey summary with vows, bonus, and spoils.
9. Start a new journey and confirm that the profile, XP, gold, and collection are preserved.
10. Test the interface at 360px and on desktop; verify PWA installation and offline reload.
11. Export and import data, and confirm that the state is restored.
12. Export a web save, import it on Android, play a day, export it again and
    open it on web without losing the map, route, rewards or schema version.
13. On Android, enable notifications, verify the test notification, set a
    near-future reminder, tap it and land on the map; seal the day and confirm
    its reminder is cancelled. Disable reminders and confirm everything is
    cancelled, including after a force-stop.
14. Pair the Android app and the desktop app on the same Wi-Fi, play one day on
    each while the other is closed, then sync and verify the conservative merge
    plus the keep-mine/keep-peer conflict path.
15. Run the tests for generation, rewards, journey close, and the Android
    notification planner.
16. Install the desktop build on Linux (`.deb`) and Windows (`.exe`), finish
    onboarding, resolve a day, reload and confirm the save survives; export the
    save and confirm the native save dialog opens.

## 11. Build order

Each milestone must leave something playable or demonstrable:

- **M0 — Base:** domain types, store, persistence, demo data, visual tokens, and dev panel.
- **M1 — Map:** deterministic generator with tests, SVG rendering, route selection, and encounter detail.
- **M2 — Loop:** claim/pass, rewards, vow progress, and day summary.
- **M3 — Journey:** onboarding, quests/trials CRUD, journey summary, new journey, PWA, responsive layout, and export/import.
- **M4 — Playtest:** test with 3–5 people, adjust encounter count, rewards, and onboarding friction.
- **M5 — Android:** Expo shell, shared store/sync extraction, the local LAN
  node, full screen parity, local notifications, save interchange and release
  checklist.

## 12. Risks and open decisions

| Risk | Mitigation |
|---|---|
| The map feels decorative | Visible trade-offs between progress, difficulty, and reward; validate with testers. |
| Scope creep toward a full RPG | No cards, combat, shop, or relics with effects in the POC. |
| Heavy onboarding | Demo data and a minimum of 4 trials. |
| A real week takes too long to provide feedback | Dev panel to simulate days and a 3-day test. |
| Local data loss | Export/import, versioned schema, and controlled reset. |
| Excessive resemblance to Slay the Spire | Mechanical inspiration only; original visual identity and content. |

Open decisions with a default proposal:

- Is passing an encounter free? **Proposal:** yes, with no penalty beyond losing the reward and progress.
- Are lost days recoverable? **Proposal:** no in the POC.
- Are 4–16 encounters per day too many? **Proposal:** start there and adjust after the playtest.
- Does elite give 2 progress? **Proposal:** 1, to avoid distorting weekly vows.
- Midnight or 4 a.m. cutoff? **Proposal:** midnight for simplicity.
- Does the journey start any day or only on Monday? **Proposal:** any day, with a 7-day window.

## 13. Future beyond the MVP

Remote push notifications, shop and gold sinks, relics/cards with effects,
social features and rankings, calendar or health integrations, lost-day
recovery mode, adaptive content, and an iOS release. Device-local Android
reminders are in scope; serverless nearby sync between Android and desktop
exists (ADR-0007). Public signup, email delivery, a cloud copy and remote push
to a closed app are not part of the current scope.
