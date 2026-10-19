# LifeSpire — Game Design Document (GDD)

> **Version:** 1.0 (frozen for M0, 2026-10-18)
> **Date:** 2026-10-18
> **Scope:** game design. The technical part lives in [`ARCHITECTURE.md`](./ARCHITECTURE.md) and in [`docs/`](./docs/README.md).
> **Language convention:** documents, code, entities and endpoints in English.
>
> This specification is **frozen**: implementation starts at **M0** following [`docs/roadmap.md`](./docs/roadmap.md).

---

## Table of contents

1. [Vision and value proposition](#1-vision-and-value-proposition)
2. [Design pillars](#2-design-pillars)
3. [Glossary](#3-glossary)
4. [Core loop](#4-core-loop)
5. [The map and routes](#5-the-map-and-routes)
6. [Node types](#6-node-types)
7. [Tasks: SMART, timer and evidence](#7-tasks-smart-timer-and-evidence)
8. [HP, failure and death](#8-hp-failure-and-death)
9. [Progression: level, stats and skills](#9-progression-level-stats-and-skills)
10. [Economy](#10-economy)
11. [Inventory and items](#11-inventory-and-items)
12. [Shop and personal rewards catalog](#12-shop-and-personal-rewards-catalog)
13. ["?" Events and personal decks](#13--events-and-personal-decks)
14. [Daily quests](#14-daily-quests)
15. [Goals, milestones and weekly Boss](#15-goals-milestones-and-weekly-boss)
16. [AI in the gameplay](#16-ai-in-the-gameplay)
17. [Streaks, grace days and comeback](#17-streaks-grace-days-and-comeback)
18. [UX and main screens](#18-ux-and-main-screens)
19. [Appendix A — Initial Balance](#19-appendix-a--initial-balance)
20. [Appendix B — Gameplay roadmap](#20-appendix-b--gameplay-roadmap)

---

## 1. Vision and value proposition

**Elevator pitch.** LifeSpire turns your real goals into a roguelike run: each day a node map is generated in the *Slay the Spire* style, where the "enemies" are your tasks, the bosses are your milestones and the gold you earn is spent on rewards from your real life. AI helps you plan (breaking goals down into tasks), but every decision about your life is approved by you.

**Problem it solves.** Productivity and habit apps fail because (a) progress is not *felt*, (b) big goals are not broken down into daily actions and (c) failure is perceived as guilt. LifeSpire attacks all three: deep gamification with real consequences (that carry weight), AI-assisted planning (from abstract goal to today's SMART task) and an anti-guilt design (the penalty exists, but it is legible, fair and never humiliates).

**Target audience.** People who play video games (roguelike/deck-builders) and want to organize personal goals, habits and projects. **Current scope: personal use first** (you and, if you want, close friends), with multi-user architecture prepared in case it opens to the public later.

**Platforms.** Web (primary), desktop (Tauri) and Android (React Native). The daily run must be completable from any device, even offline.

---

## 2. Design pillars

Every design decision is validated against these five pillars. If a mechanic violates a pillar, it is redesigned.

1. **The real world comes first.** The app adapts to your life, not the other way around. If you are sick, traveling or overwhelmed, the app has ways not to punish you (grace days, vacation, soft re-entry). No notification shames you.
2. **Harsh penalties, but legible and fair.** Dying hurts (it is a roguelike), but you always know how much HP you have left, how much damage you will take and what you would lose if you die. There are no surprise or permanent penalties: damage happens only within an active run and when the day closes no pending debt remains.
3. **Permanent progression is never destroyed.** Level, XP, stats, skills, goals, achievements and cosmetics are never lost. What is lost on death is the *run's material stuff*: gold (a %) and consumables. That way the penalty carries weight without destroying months of work.
4. **Total customization, with AI assistance.** Stats, skills, event decks, rewards catalog and difficulty are yours. AI proposes drafts; you approve, edit or discard.
5. **AI proposes, you decide.** Nothing from AI runs in your real world without your explicit approval. This applies especially to penalties and rewards: the app never imposes on you by surprise something you did not authorize.

---

## 3. Glossary

| Term | Code | Definition |
|---|---|---|
| Run | `Run` | The day's game. It lasts from when you open the map until the close (or your death). |
| Day | `dayKey` | User's local date key; the day changes at a configurable hour (04:00 by default). |
| Map | `Map` | Graph of nodes generated procedurally for a run. |
| Node | `MapNode` | Map square: Enemy, Elite, Event, Shop, Rest or Boss. |
| Path | — | Route the player chooses through the map. |
| Task | `TaskInstance` | Playable instance of an Enemy/Elite/Boss: SMART action with timer and evidence. |
| Routine | `Routine` | Repeatable task template (daily, specific days) that feeds the map. |
| Evidence | `Evidence` | Proof of a task: photo, screenshot, note, link or timer log. |
| Timer | `TimerSession` | Time session of a task (start, pauses, end). |
| Gold | `gold` | Currency. Earned by completing nodes and quests; spent in the Shop. |
| HP | `hp` | Run's health. Lost when failing; at 0 you die. Restored each day. |
| Stat | `StatDef` | Permanent player attribute (Health, Strength, …) with a mechanical effect. |
| Skill | `Skill` | Mastery area (Programming, Art, …). Accumulates XP and grants achievements/unlocks. |
| Goal | `Goal` | Long-term objective. |
| Milestone | `Milestone` | Stage of a goal with a target date. Closed at the weekly Boss. |
| Deck | `Deck` | Personal collection of event cards (real-world penalties and rewards). |
| Card | `EventCard` | Real-world instruction: healthy penalty, reward or mixed. |
| Voucher | `RewardDef` | Personal reward purchasable in the Shop (e.g. "2 h of video games"). |
| Consumable | `ItemDef` | Functional item (potion, jump feather, die…). Lost on death. |
| Streak | `StreakState` | Consecutive days with a run properly closed. |
| Freeze | — | Grace day that protects the streak without playing. |
| Death | — | HP reaches 0: end of the day's run + harsh penalty. |
| Re-entry | — | Soft rules when coming back after days of absence. |

---

## 4. Core loop

### 4.1 Daily loop (the heart of the game)

1. **Open the app** → the day's map is revealed (generated with the daily seed). You see your HP, gold, streak and the day's quests.
2. **Choose path** → from your current node you choose where to advance (risk/reward trade-offs).
3. **Resolve nodes** → real tasks with timer and evidence; events with cards; purchases in the Shop; healing in Rest.
4. **Collect** → each resolved node pays gold, XP and (sometimes) items instantly.
5. **Close the day** (optional but recommended) → short recap, closing bonus, updated streak. If you do not close it, the day closes by itself when the deadline arrives.

You can **stop at any moment**: just do not enter the next node. Leaving early has no penalty; you only lose the rewards of unvisited nodes.

**Expected duration:** 20–90 min of real tasks depending on how many nodes you decide to play, plus 2–5 min of interaction with the game. Designed for short sessions between tasks, not for marathons.

### 4.2 Weekly loop

- Each day of the week accumulates run + streak.
- On the **closing day** (Sunday by default, configurable) the map is shorter and ends at the **Boss** node: review and close a milestone, plus the **weekly recap** (with AI support): what you completed, by skill, how your streak is going and adjustment suggestions.
- Closing the milestone gives a big reward (gold + rare item + goal progress).

### 4.3 Long-term loop

Goal → Milestones with dates → Daily tasks. AI breaks down, you approve. The map consumes the pool of pending tasks prioritizing: (1) milestones close to expiring, (2) routines scheduled for today, (3) balance between skills. Milestones are not "failed": they are rescheduled without drama (anti-guilt pillar).

---

## 5. The map and routes

### 5.1 Procedural generation

- **Deterministic daily seed:** `dailySeed = HKDF(userSeedSalt, dayKey + engineVersion)`. The same day generates the same map on all your devices. In **M0** (no backend) the `userSeedSalt` (32 bytes hex) is generated locally on first launch and stored in the local store; in **M2** the migration **adopts** that salt (the server does not issue a different one for pre-existing local data). It is **never rotated** (see [`docs/adr/0015-local-first-seed-salt.md`](./docs/adr/0015-local-first-seed-salt.md)).
- **Rule profile:** the generator is parameterized by a *rule profile* (`nodeTypeSet` + `guarantees`) defined in `packages/engine/balance/*.json`, so the same engine serves the reduced M0 set and the full M1+ game (see [`docs/adr/0016-map-rule-profiles.md`](./docs/adr/0016-map-rule-profiles.md)).
- The map is generated in full when the day opens and **is shown in full from the start** (like StS): you can plan the path by looking ahead.
- **Engine version frozen per run:** if the generator is updated, already created runs keep their version to remain deterministic.

### 5.2 Structure

| Parameter | Default value | Notes |
|---|---|---|
| Rows | 8 (7 random + final closing row) | 5 + Boss on the closing day |
| Nodes per row | 2–4 | Closing row: 1–2 |
| Possible paths | 2–3 routes | Must reconverge at least once |
| Row 1 | Always Enemy | Teaches the basic loop |
| Guarantees | ≥ 1 reachable Rest and ≥ 1 reachable Shop; on a Boss day, ≥ 1 Rest before the Boss | No two consecutive Rests on the same path |

**Guide distribution of types per row** (subject to the guarantees):

| Type | Indicative probability |
|---|---|
| Enemy | 55–65 % |
| Elite | 8–12 % |
| Event "?" | 10–15 % |
| Shop | 6–10 % |
| Rest | 8–12 % |

**M0 rule profile.** M0 ships a reduced profile of the full game described above: only `enemy` and `elite` nodes are available (no `event`, `shop`, `rest` or `boss`). It keeps 8 rows (7 + final row), 2–4 nodes per row, row 1 always Enemy and 2–3 routes that reconverge, but **disables the Rest/Shop guarantees and the closing-day Boss**. The table above describes the full game (M1+); the profile values are data in `packages/engine/balance/*.json` (see [`docs/adr/0016-map-rule-profiles.md`](./docs/adr/0016-map-rule-profiles.md)).

### 5.3 Path choice and risk/reward

From your current node you see its connections to the next row and choose. Each node type has a clear risk/reward profile:

- **Safe path:** Enemies and Rest; slow gold progress.
- **Greedy path:** Elites and Shop; more potential damage, better payouts.
- **Uncertain path:** "?" events; anything can happen (within your approved deck).

You cannot go back. You can end the run before the last row.

### 5.4 Difficulty scaling

Difficulty is **gradual and adaptive**, never a punishment for absence:

```
budget = clamp( 2.0 + 0.1 × (playerLevel − 1) + successAdjust , 2.0 , 4.4 )
successAdjust = +0.3  if successRate7d ≥ 80 %
                −0.3  if successRate7d ≤ 40 %
                0     otherwise
```

- `budget` (1–5 scale) biases the difficulty of the tasks offered by the AI and the templates.
- **M0:** the inputs are fixed (`playerLevel = 1`, `successRate7d = 0`, `streakDays = 0`) ⇒ `budget = 2.0` constant, so there is no real adaptation until M1.
- **It never goes up for days without playing.** If you have been absent ≥ 7 days, **re-entry** applies: temporary `−0.2` (one week) and the first map again guarantees an extra Rest on the path.
- Difficulty changes are shown in the weekly recap (system transparency).

### 5.5 The day

- The `dayKey` changes at the configurable **close hour** (04:00 local by default) — designed for night owls.
- When the day closes with Enemies "in progress" (timer started without being resolved), they count as **failed** and damage is applied at the close. The app warns in advance ("you have 2 unresolved tasks; at today's close they will count as failed").
- **Vacation mode** (in Settings): pauses runs and streak without penalty; days are marked as paused, not missed.

---

## 6. Node types

### 6.1 Enemy

Specific, short-term, **SMART** routine task: measurable, achievable, realistic and with time defined by timer. Requires **evidence** as proof (see §7).

- **On completion:** gold (10 + 2 × difficulty) + XP (10 × difficulty) + 10 % chance of a common consumable drop. Interacts with quests.
- **On failure / abandoning:** damage = 12 + 3 × difficulty (reduced by Strength). No gold or item loss (that is only for death).
- **Skip:** requires the "Jump Feather" item; counts as *skipped* (no damage, no reward).
- It is the most common node; the bread and butter of day-to-day life.

### 6.2 Elite

Same as Enemy but with tasks that cost you more: longer duration, stricter criterion or higher difficulty (3–5). The engine prioritizes for Elites the tasks that history flags as most postponed or outside your comfort zone (always within the approved pool).

- **On completion:** gold ×2 relative to its difficulty + XP ×2 + 35 % drop (common or rare).
- **On failure:** damage ×1.5 relative to an Enemy of its difficulty.
- **Skip:** same as Enemy (Jump Feather).

### 6.3 Event "?"

On entering, a **card from your personal deck** is drawn (§13): a healthy penalty (read X pages, exercise), a mini reward (30 min of something you like), or a mixed one. Real-world cards **were always authored or approved by you**.

- **Resolution:** accept and fulfill (the app gives you a mini-timer if applicable) or **decline at no cost** (the card is discarded and nothing happens; you only lose the opportunity).
- **Reroll:** use the "Loaded Die" item to draw another card.
- It does not grant gold/XP by itself; mixed cards may include a small bonus (e.g. +10 gold).

### 6.4 Shop

Zone to spend gold (§12). It shows 3 rotating offers (catalog items + personal reward vouchers) and 1 guaranteed voucher from your catalog.

- You can ignore it and keep going.
- The "Merchant's Amulet" item applies a −20 % discount during the run.

### 6.5 Rest

The day's camp.

- **Heal:** recovers 30 % of max HP.
- Future actions (post-MVP): "reinforce" (upgrade an item) or "prepare" (shield for the next Enemy). Out of initial scope.
- You cannot rest twice on the same day (one visit per node).

### 6.6 Boss

Only on the weekly closing day (Sunday by default). That day's map is shorter (5 rows) and ends at the Boss, which represents **closing the milestone**: a big task or checklist (typically 1–3 h of real work) chosen from the active goal; it can be broken down into visible sub-steps.

- **On completion:** 75 gold + guaranteed rare item + 10 % Phoenix Drop + 120 XP + the milestone advances/closes and the weekly recap is generated.
- **On failure:** 40 damage. The milestone is not lost; it is rescheduled (anti-guilt).
- It cannot be skipped with a Jump Feather.

### 6.7 Summary table of results per node

| Node | Complete | Fail | Skip |
|---|---|---|---|
| Enemy | Gold + XP + 10 % drop | Damage `12 + 3d` | Feather: no damage, no prize |
| Elite | Gold ×2 + XP ×2 + 35 % drop | Damage ×1.5 | Feather |
| Event | Card effect | — (cannot be failed) | Decline for free or reroll with Die |
| Shop | Purchases | — | Leave for free |
| Rest | Heals 30 % max HP | — | Ignore |
| Boss | Big loot + milestone + recap | Damage 40 | Not available |

### 6.8 M0 profile

In M0 only a subset of node types is playable; the damage/HP mechanics described in §6.1–6.7 apply from M1 (see §8).

| Node type | Availability in M0 |
|---|---|
| Enemy | Playable |
| Elite | Playable |
| Event "?" | M1+ |
| Shop | M1+ |
| Rest | M1+ |
| Boss | M1+ |

**Failure in M0 (B9):** with no HP and no death, failing an Enemy/Elite node leaves the task in `skipped`: **no reward and no consequence** (no damage, no gold/item loss).

---

## 7. Tasks: SMART, timer and evidence

### 7.1 Anatomy of a task

Every playable task satisfies SMART and is modeled like this:

| Field | Description | Example |
|---|---|---|
| Title | Concrete and specific action | "Solve 3 recursion katas on Exercism" |
| Success criterion | Measurable and verifiable by you | "3 katas with all tests green" |
| Duration | Timebox with timer | 45 min |
| Difficulty | 1–5 (defines damage, gold, XP) | 3 |
| Skills | 1–3 labeled domains | Programming |
| Required evidence | Valid type(s) | Screenshot with the tests + timer log |
| Link | Optional Goal/Milestone | Goal "Become a senior backend", Milestone "Algorithms fundamentals" |

**Task sources:**
1. **AI** (from goals/milestones): proposes drafts; you approve before they enter the pool.
2. **Routines**: repeatable templates (daily or specific days) that are injected into the map on the scheduled days with priority.
3. **Manual**: express creation in 20 seconds (title + duration + difficulty).
4. **Curated templates**: library by skill and difficulty, without the need for AI.

**Anti-guilt rule:** a task failed yesterday **is not offered again** today unless you pin it manually (pin). The system leaves space after a failure.

### 7.2 Life cycle of a task

```
pending → in_progress → { completed | failed | skipped }
```

- **In progress** starts when entering the node and starting (or at least accepting) the task.
- The terminal states (`completed`, `failed`, `skipped`) are final for that instance. If you do not resolve it and the day closes, it becomes `failed` (with prior notice).

### 7.3 Timer

- The timer is the concentration and automatic evidence tool. It records start, pauses and end.
- **Pauses:** unlimited, but all are recorded (transparency + data for the recap).
- **Early completion:** you can complete before running out of time by indicating the reason ("I finished early"); it is recorded in the log.
- A timer without a log is not a completed task: the timer log is part of the evidence.
- No anxiety mechanics: the timer does not "explode"; it simply runs out and the task stays pending until you resolve it or the day closes.

### 7.4 Evidence

- **Mandatory** in Enemy/Elite/Boss: on completion you must attach at least one piece that is not just the timer log — photo, screenshot, text note or link. The type is defined by the task (the AI or you).
- **Verification: on an honor basis.** There is no automatic validation in the MVP. AI vision verification remains an optional future improvement (see [`docs/open-questions.md`](./docs/open-questions.md)).
- **Privacy:** the evidence is yours: private bucket, short-lived signed URLs, exportable and deletable (technical detail in [`ARCHITECTURE.md`](./ARCHITECTURE.md) §9).
- Evidence is kept as a diary of your progress: it works even when you fail (you can attach "why did it fail?" for the recap).
- **Client policy (B8):** the client compresses before uploading — ~1600 px WebP at q0.8, **maximum 10 MB** per file, **50 files/day**, with a **SHA-256 checksum**. In M0 the blobs are stored in the local store and will be uploaded on reconnect from M2 (see [`docs/adr/0014-client-side-evidence-policy.md`](./docs/adr/0014-client-side-evidence-policy.md)).

---

## 8. HP, failure and death

### 8.1 Daily HP

```
maxHp = 100 + 10 × (healthLevel − 1) + 5 × (playerLevel − 1)
```

- HP **belongs to the run**: you start each day at max. Rest nodes heal within the day.
- Current HP is always visible on the map (prominent bar, no ambiguity).

### 8.2 Damage on failure

| Event | Damage |
|---|---|
| Enemy failed | `12 + 3 × difficulty` (d1: 15 → d5: 27) |
| Elite failed | ×1.5 |
| Boss failed | 40 |
| Task in progress at day close | Same as failed |

With HP ≈ 100–130, it takes ~4–6 failures in a day to die. Rests and potions stretch it out. **Dying is possible but never accidental:** every failure shows the damage applied and the remaining HP.

### 8.3 Death (0 HP) — the harsh penalty

Exact flow:

1. Death screen: run recap with a respectful tone (what happened, without sarcasm or guilt).
2. Penalties are applied:
   - **Gold: you lose 50 %** (reducible with Discipline, minimum 25 % lost — see §9).
   - **Items: you lose all consumables** (including unused reward vouchers).
   - **Streak: it breaks** (unless freeze or Phoenix Drop).
   - The run ends: you cannot play more nodes today.
3. **Never lost:** level, XP, stats, skills, remaining gold, goals, milestones, achievements, cosmetics and history.
4. Tomorrow: HP at max, new map, zero debt. The penalty is paid once, it does not carry over.

### 8.4 Phoenix Drop

Rare item (only appears in Elite/Boss loot, max. 1/week; not sold in the Shop). If you have it when you die, it is consumed automatically (with confirmation): you revive with 30 % HP, **you keep gold and items** and the streak does not break. It is the only way to cancel the harsh penalty — and it is extremely rare, like in a good roguelike.

### 8.5 Anti-guilt rules of failure

- There is no damage outside the active run: if you do not open the app, you do not lose HP.
- The day close warning is visible and anticipated; dying from forgotten tasks requires ignoring explicit warnings.
- You can **abandon** a task at any moment with a confirmation that shows the exact damage you will receive.
- Vacation mode and freezes (§17) cover the bad weeks.

---

## 9. Progression: level, stats and skills

### 9.1 Player level

- **Task XP:** Enemy = `10 × difficulty`; Elite = `20 × difficulty`; Boss = 120; quests = 25.
- **Curve:** to level up from level `n` to `n+1`: `round(100 × n^1.35)` XP.
- **On leveling up:** +1 stat point (assignable) + 5 max HP (via formula §8.1) + animation and, at milestone levels (5, 10, 25…), a cosmetic or title.

### 9.2 Stats

Permanent attributes with a **real and bounded mechanical effect**. The pool of supported effects (the balance lives here, not in the name):

| Effect (`effectKey`) | What it does |
|---|---|
| `max_hp` | +10 max HP per level |
| `damage_reduction` | −2 % damage received per level (cap 25 %) |
| `death_loss_reduction` | −2 pp of gold lost on death per level (minimum loss 25 %) |
| `gold_gain` | +3 % gold earned per level (cap 30 %) |
| `xp_gain` | +3 % XP earned per level (cap 30 %) |
| `rest_heal` | +2 pp of Rest healing per level (cap +20 pp) |
| `drop_chance` | +1 pp drop probability per level (cap +10 pp) |
| `reroll_charge` | +1 event reroll charge every 5 levels |

**Default template** (editable): Health → `max_hp`; Strength → `damage_reduction`; Intelligence → `xp_gain`; Discipline → `death_loss_reduction`. You can rename, create custom stats (max. 8) with effects from the pool, and ask the AI for an alternative set according to your goals. Stats are never lost.

### 9.3 Skills

Mastery areas that **do not alter combat** (to avoid coupling your life to numbers): Programming, Art, Languages, Fitness, whatever you define (3–8 to start; the AI suggests based on your goals).

- **Skill XP:** each labeled task contributes its XP to each labeled skill (max. 2–3 labels).
- **Curve:** `round(80 × n^1.3)` to level up to the next level.
- **On leveling up a skill:** achievement + cosmetic title (e.g. "Programming lv. 5 — Code Apprentice"), and unlocking of high-difficulty task templates for that domain. They also feed the recap (balance of your week by area) and the AI uses them to suggest tasks.
- Skills are never lost.

---

## 10. Economy

### 10.1 Gold — sources and sinks

| Source | Amount |
|---|---|
| Enemy completed | `10 + 2 × difficulty` (d1: 12 → d5: 20) |
| Elite completed | ×2 over its difficulty |
| Boss completed | 75 |
| Daily quest | 15–30 |
| Day close bonus | +5 (if you close before the deadline) |
| Mixed event | +10 (occasional) |

Streak multiplier: **+2 % per consecutive day, cap +30 %** (applies to all sources).

| Sink | Cost |
|---|---|
| Consumables in Shop | 30–150 (see §11 and §12) |
| Personal reward vouchers | 40 / 100 / 200 according to declared rarity |

Typical gold earned/day: **40–70**; Shop visit: 2–4 times per week. The complete econometric balance lives in [Appendix A](#19-appendix-a--initial-balance).

### 10.2 Philosophy

- Gold is **never connected to real money**. There are no purchases, not even indirect ones. (Monetization, if it ever exists, will be through a subscription to AI/convenience features — see [`docs/open-questions.md`](./docs/open-questions.md).)
- Prices and rewards live in **data-driven tables** of the engine (JSON), not hardcoded: balancing is editing data.

---

## 11. Inventory and items

### 11.1 Initial catalog

| Item | Effect | Price | Drop |
|---|---|---|---|
| Minor Potion | Heals 25 HP | 40 | Enemy 10 % |
| Greater Potion | Heals 60 HP | 90 | Elite 35 % |
| Jump Feather | Skips an Enemy/Elite node without damage | 60 | Elite 15 % |
| Loaded Die | Event card reroll | 35 | Event/quest |
| Shield | Cancels the next HP loss of the run | 80 | Elite 10 % |
| Merchant's Amulet | −20 % run prices | 50 | Guaranteed Shop |
| Phoenix Drop | Revives with 30 % HP without penalty (self-use) | Not sold | Elite 5 % / Boss 10 % (max. 1/week) |

### 11.2 Rules

- Free use during the run (contextual "Use" button on the map).
- **On death all consumables are lost** (includes unused vouchers). That is the real weight of the roguelike; cosmetics and achievements are never lost.
- No inventory limit in the MVP (if abuse appears, a cap is added with a warning).

---

## 12. Shop and personal rewards catalog

A Shop visit offers **3 rotating offers + 1 guaranteed voucher** from your personal catalog.

- **Rotating offers:** catalog items (§11) and vouchers from your catalog.
- **Personal reward vouchers:** real-life rewards defined by you ("2 h of video games", "an anime night", "buy that dessert"), classified by declared rarity (common / rare / epic) and fixed price by rarity (40/100/200). Using a voucher is a permission reminder: you earned it.
- **AI-assisted:** the AI proposes candidate vouchers from your interests (onboarding and Shop), and suggests a rarity/price; you approve or adjust. *Guardrails:* nothing that involves spending real money, nothing harmful, bounded and explicit duration. Vouchers are not purchases: they are permissions you grant yourself.
- You can buy all the offers of the visit that you can afford: gold is the limit.

---

## 13. "?" Events and personal decks

### 13.1 Deck composition

Your personal deck mixes three flavors:

| Flavor | Description | Examples (contributed by you or proposed by AI and approved) |
|---|---|---|
| Healthy penalty | Short action that costs you little but does you good | "Read 10 pages", "15 min of stretching", "Walk 20 min without your phone" |
| Mini reward | Short permission to enjoy | "30 min of video games", "1 episode of anime", "30 min of guilt-free scrolling" |
| Mixed | Both, combined | "20 min of exercise → 40 min of your series" |

### 13.2 Rules

- **Nothing is imposed:** each card was born from a curated template, from the AI (with your prior approval) or from your own hand. AI cards are approved **before** entering the deck, not at the moment of the event (no unpleasant surprises).
- **Declining is free:** you can discard the day's card ("I don't feel like it today"); nothing happens. The penalty is the *absence of opportunity*, not a punishment.
- **Reroll:** with the "Loaded Die" you draw another card.
- Fulfilled cards stay in your history (they feed the recap and, the healthy ones, can give small quests).
- Card limit: 5–30 per deck; the deck is managed in Settings.

---

## 14. Daily quests

Every day **2–3 quests** arrive from a pool of curated templates + AI proposals (approved in bulk). They are completed automatically when the condition is met (the engine evaluates them with the ledger events).

| Quest | Condition | Reward |
|---|---|---|
| Double Edge | 2 Enemies in a row without failing | 20 gold |
| Early Bird | Complete an Enemy before 10:00 | 25 gold + 5 % XP |
| Forgotten World | Complete a task from a skill with no activity in 5 days | 30 gold |
| No Pauses | Complete an Enemy without pausing the timer | 15 gold |
| Collector | Visit the Shop | 1 Loaded Die |

- They do not accumulate between days; uncompleted ones simply expire (without guilt).
- Reaching "3/3 quests" in a day gives an occasional surprise cosmetic bonus (e.g. profile frame of the day).

---

## 15. Goals, milestones and weekly Boss

### 15.1 Hierarchy

```
Goal                  "Become a senior backend developer"
  └─ Milestone        "Master the fundamentals of algorithms" — target date
       └─ Task        "Solve 3 recursion katas" — today, on the map
```

- **Goals:** title, description, horizon, related skills, status (`active`, `paused`, `achieved`, `archived`).
- **Milestones:** target date, optional checklist, progress (completed / total tasks), status.
- **Planning flow (AI-assisted):** you describe the goal in natural language (with context: hours/week, previous experience) → the AI proposes milestones with realistic dates and a first batch of tasks → you edit and approve → the tasks feed the map of the following days. Flow details in [`docs/ai.md`](./docs/ai.md).
- **Without AI:** you can create goals and milestones by hand and use curated templates; the game is 100 % playable without AI.

### 15.2 Weekly Boss and recap

- On the closing day (Sunday by default) the Boss represents the week's milestone: the big task that closes it or moves it forward significantly.
- On resolving it (success or failure), the **weekly recap** is generated: completeness by skill, gold, streak, success rate, and AI (or template) suggestions — with a companion tone, not a judge's. Failed milestone tasks are automatically rescheduled with a question: "shall we move it to next week?".
- **Milestones are not lost:** they are rescheduled. Only goals archived by you stop feeding the map.

---

## 16. AI in the gameplay

Summary of where it participates (full contracts, prompts and guardrails in [`docs/ai.md`](./docs/ai.md)):

| Flow | What it does | Human approval |
|---|---|---|
| `plan_goal` | Goal → milestones + candidate tasks | Mandatory (you edit the draft) |
| `generate_tasks` | Fills the daily pool of SMART tasks according to difficulty, goals and skills | Automatic per task only once (the pool is yours) |
| `suggest_decks` | Proposes event cards and reward vouchers | Mandatory before entering the deck |
| `shop_offers` | Suggests vouchers and rarities for the day's Shop | They go through your approved catalog |
| `setup_stats_skills` | Proposes an initial set of stats/skills (onboarding) | Mandatory |
| `weekly_recap` | Weekly analysis and adjustment suggestions | Read-only |

Cross-cutting rules: nothing is executed in your real life without approval; without AI the game uses curated pools; the data sent to the AI is text (never photographic evidence) and is minimized.

---

## 17. Streaks, grace days and comeback

- **The streak counts a day** if you did not die and completed ≥ 1 Enemy. (It is always shown; it protects the habit, not perfection.)
- **Freezes:** 2 automatic grace days per calendar month. If you do not open the app one day, a silent freeze is consumed: the streak does not break and there is no drama. It is shown in the profile ("2/2 freezes available").
- **Vacation mode:** explicitly pauses runs and streak (Settings). Paused day = day not counted.
- **Streak rewards:** on day 7 and day 30 (repeatable per cycle): bonus gold + rare item + cosmetic.
- **Comeback:** after ≥ 7 days absent, re-entry is soft (§5.4) and the first recap reorients you: which skills cooled down, which milestones moved, and a map with an extra Rest.
- Dying breaks the streak (agreed hard rule), unless Phoenix Drop or freeze that day.

---

## 18. UX and main screens

| # | Screen | Purpose |
|---|---|---|
| 1 | Onboarding | Initial stats/skills/decks/goals with AI assistance; first-map tutorial |
| 2 | Home / Day map | HP, gold, streak, quests; interactive map with paths and node selection |
| 3 | Node detail | Task briefing: title, criterion, duration, expected evidence |
| 4 | Timer | Fullscreen, focus mode, pauses with logging; complete/abandon button |
| 5 | Evidence | Attach photo/screenshot/note/link on completion; progress diary |
| 6 | Result | Animated victory/defeat with rewards and quests advancing |
| 7 | Event | Card draw; accept / decline / reroll |
| 8 | Shop | Offers + guaranteed voucher; purchase with price confirmation |
| 9 | Rest | Healing with campfire animation |
| 10 | Death | Run recap and applied penalties, respectful tone |
| 11 | Inventory | Contextual item use |
| 12 | Goals and milestones | Goal → milestones → tasks tree; editing and planning with AI |
| 13 | Profile | Level, stats, skills, achievements, streak, history heatmap |
| 14 | Weekly recap | Analysis + suggestions (AI/template) |
| 15 | Settings | Decks, stats, skills, notifications, close hour, vacation, data (export/delete) |
| 16 | History | Past runs, heatmap-style calendar, evidence as a diary |

**M0 vs M1+ screens.** In M0 these screens exist: a minimal **Onboarding**, **Home / Day map** (without HP, streak or quests — see below), **Node detail**, **Timer**, **Evidence**, **Result** and a basic **History**. The rest (Event, Shop, Rest, Death, Inventory, Goals and milestones, Profile, Weekly recap, full Settings) arrive in M1+. Because M0 has no backend, the header shows a **"saved locally · no account"** status indicator.

**M0 Home scope (B3):** the Home/Day map shows the map, gold, accumulated XP and the day's progress; it does **not** show HP, streak, quests or level.

**Art direction (B6).** The visual direction is **"ink and ember"**: a dark base (`bg #0B0D12`, `surface #141821`, `surface-2 #1C212C`, `border #2A3040`, `text #E8E4DA`, `muted #8B93A7`) with accents `gold #E0A94A`, `xp #8FB6D9`, `danger #C2554F`, `success #6FA46A`, `rest #C97B4A`, `event #9B8CD6`. Typography: **Inter** (UI/data, `tabular-nums`) + **Fraunces** (display). Icons: **Lucide** plus custom SVG glyphs per node type, where **shape distinguishes the type without relying on color**. Node states: `visited` (check + dimmed routes), `current` (golden halo, the only glow), `available` (clear border), `locked` (40 % opacity). Motion 150–250 ms ease-out, honoring `prefers-reduced-motion`. The layout is minimal: no sidebar, a thin top bar, the map at full width and a contextual detail panel for the selected node. These tokens live in `packages/design-tokens`.

**UX principles:**

- **Legibility of the penalty:** damage, HP and consequences visible before each decision (clear confirmations).
- **Tone:** adventure companion, never a judge. Zero passive-aggressive texts.
- **Accessibility:** AA contrast, keyboard navigation (web/desktop), clear texts, reducible animations.
- **Mobile-first for the task, desktop-first for planning.**
- Dark and clean roguelike aesthetic (see the art direction above).

---

## 19. Appendix A — Initial Balance

> These tables are the **canonical source of truth** for the numbers; they live as data in `packages/engine/balance/*.json` (see [`ARCHITECTURE.md`](./ARCHITECTURE.md) §4) and are tuned with telemetry + the balance simulator.

### A.1 Balance objectives (design targets)

| Metric | Objective |
|---|---|
| Death rate (days with a run started) | 5–10 % |
| Nodes visited/day (median) | 3–6 |
| Gold earned/day (median) | 40–70 |
| Shop visits | 2–4 per week |
| Level 10 | ~month 2–3 of regular use |
| Difficulty change | ≤ +0.3 pt/week |

### A.2 Consolidated formulas

```
maxHp                = 100 + 10 × (healthLevel − 1) + 5 × (playerLevel − 1)
enemyDamage          = 12 + 3 × difficulty            (Elite ×1.5, Boss 40)
enemyGold            = 10 + 2 × difficulty            (Elite ×2, Boss 75)
enemyXp              = 10 × difficulty                (Elite ×2, Boss 120, quest 25)
streakMultiplier     = 1 + 0.02 × streakDays          (cap 1.30)
deathGoldLoss        = max(25 %, 50 % − 2 % × disciplineLevel)
playerLevel(n→n+1)   = round(100 × n^1.35)  XP
skillLevel(n→n+1)    = round(80 × n^1.3)    XP
difficultyBudget     = clamp(2.0 + 0.1 × (playerLevel − 1) + successAdjust, 2.0, 4.4)
```

### A.3 Map distribution

See §5.2. Hard guarantees: total connectivity, ≥ 1 reachable Rest and ≥ 1 reachable Shop, no consecutive double Rest on a path, mandatory Boss on the closing day.

### A.4 Drops

| Source | Drop |
|---|---|
| Enemy completed | 10 % common consumable |
| Elite completed | 35 % (common or rare) |
| Boss completed | 100 % rare item + 10 % Phoenix Drop (max. 1/week) |
| Event/quest | Occasional (dice, potions) |

### A.5 Healing and sustain

| Source | Amount |
|---|---|
| Day start | HP at max |
| Rest | 30 % max HP (+ `rest_heal`) |
| Minor / greater potion | 25 / 60 HP |

### A.6 Shop prices

| Rarity | Range |
|---|---|
| Common consumable | 30–60 |
| Rare consumable | 80–150 |
| Common / rare / epic voucher | 40 / 100 / 200 |

### A.7 Difficulty curve per row

Within a map, row `f` (1–8) applies `+0.05 × (f−1)` to the budget for the nodes of that row (soft ramp). The Boss of the closing day uses the maximum available budget.

---

## 20. Appendix B — Gameplay roadmap

Summary; full technical phases and exit criteria in [`docs/roadmap.md`](./docs/roadmap.md).

| Phase | Gameplay |
|---|---|
| M0 | Local daily map + Enemy/Elite + SMART tasks + timer + evidence + basic gold/XP + day close; no HP/damage/death (failure = `skipped`); Home without HP/streak/quests; only Enemy/Elite nodes |
| M1 | HP/death/harsh penalty + Rest + weekly Boss + recap + "?" Events + Shop + inventory + quests + stats/skills/level + streaks + goals→milestones (manual) |
| M2 | No gameplay changes: backend, sync and multi-device for the above |
| M3 | AI: goal planning, task generation, decks, shop, recap, onboarding |
| M4 | Desktop (Tauri): native notifications, same gameplay |
| M5 | Android: adaptation of the daily loop to mobile, push, offline |
| M6 | Polish: i18n, accessibility, history/heatmap, export |

**Definitions:**

- **Playable MVP** = M0 + M1 (web, local data): the complete one-week roguelike loop, without backend or AI.
- **Truly usable MVP** = M0–M3: multi-device with sync and AI.

---

*Next steps: review of this GDD, number adjustments in Appendix A, and start of M0 according to [`docs/roadmap.md`](./docs/roadmap.md).*
