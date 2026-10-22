# Glossary — LifeSpire

Vocabulary of the product. It fixes what a word means in the interface and
where the code still uses an older name.

Last updated: 2026-10-21.

## 1. User-facing terms

| Term | Meaning | Example |
|---|---|---|
| **Goal** | An area of life the user is pursuing during a run. It owns routines and a weekly target. | "Wayfarer", "Craft" |
| **Routine** | A concrete, repeatable action that belongs to a goal. Routines are what appear on the map. | "Walk the north trail" |
| **Weekly target** | How many routines of that goal the user wants to finish during the 7-day run (1–7). | 4 |
| **Effort** | How hard a routine is: light, medium or heavy. It scales the reward, never the weekly progress. | heavy |
| **Run** | A 7-day window with its own weekly targets. | Run I |
| **Day** | One map, resolved once. | Day 3 |
| **Node** | A stop on the map: task, elite, rest, treasure or boss. | Task node |
| **Path** | The sequence of nodes chosen up to the boss. | The climbed path |
| **Boss** | The final node of the day; completing it closes the day with a bonus. | The daily boss |
| **Reel / Reliquary** | The collection of relics (loot) found during runs. | The reliquary |

Relationship in one sentence: a **goal** holds **routines**, and completing
routines moves the goal toward its **weekly target**.

## 2. Renamed terms

The interface used to say "aim" for what it now calls "goal". The rename
happened because "aim" was not self-explanatory for new users.

| Old wording | Current wording |
|---|---|
| Aim | Goal |
| Aims (screen, nav label) | Goals |
| Weekly aim | Weekly target |
| "+1 weekly aim" | "+1 toward weekly target" |

## 3. The code keeps "aim"

The rename is **only** in the user-facing copy. Code identifiers, CSS classes
and DOM hooks keep the old name on purpose, to avoid a risky rename of
persisted structures and styles.

Kept as "aim" in code:

- `AimRow` component and its `aim-row`, `aim-group`, `summary-aim`,
  `node-aim` CSS classes.
- `screen--aims`, `data-screen="aims"`, `aria-labelledby="aims-title"`.
- `CONTENT_MESSAGES.aimWithoutRoutine` and `AIM_WITHOUT_ROUTINE`.
- `allAimsBonusCopy`.
- Domain types and fields: `Goal`, `Task`, `goalId`, `weeklyObjective`.

Rules for future work:

- New or edited **copy** uses Goal, Routine and Weekly target.
- New or edited **identifiers** may keep the "aim" family for consistency
  with the surrounding code; renaming them is out of scope unless it is a
  dedicated, tested refactor.
- The persisted schema is unchanged: saved files keep `goals`, `tasks`,
  `goalId` and `weeklyObjective`, so no migration is needed.

## 4. Related documents

- [`SPEC.md`](./SPEC.md) — product scope and game rules.
- [`design/DESIGN.md`](./design/DESIGN.md) — design system and screen specs.
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — modules and type
  contracts.
- [`docs/UI.md`](./docs/UI.md) — screen map and shared components.
