# Glossary — LifeSpire

Vocabulary of the product. It fixes what a word means in the interface and
where the code still uses an older name.

Last updated: 2026-11-04.

## 1. User-facing terms

| Term | Meaning | Example |
|---|---|---|
| **Quest** | An area of life the user is pursuing during a journey. It owns trials and a weekly vow. | "Wayfarer", "Craft" |
| **Trial** | A concrete, repeatable action that belongs to a quest. Trials are what appear on the map. | "Walk the north trail" |
| **Weekly vow** | How many trials of that quest the user wants to finish during the 7-day journey (1–7). | 4 |
| **Difficulty** | How hard a trial is: Easy, Standard or Hard. It scales the reward, never the weekly progress. | Hard |
| **Journey** | A 7-day window with its own weekly vows. | Journey I |
| **Day** | One map, resolved once. | Day 3 |
| **Encounter** | A stop on the map: trial, elite, respite, hoard, wheel of fortune or warden. | Trial encounter |
| **Route** | The sequence of encounters chosen up to the warden. | The climbed route |
| **Warden** | The final encounter of the day; claiming it closes the day with a bonus. | The daily warden |
| **Reel / Reliquary** | The collection of relics (spoils) found during journeys. | The reliquary |
| **Nearby device** | Another Android or desktop app on the same local network that can sync with this one. | Pair my phone |
| **Pairing** | The one-time exchange of a QR/code and a certificate fingerprint that makes two devices trust each other. | Show my code |
| **Auto-sync** | A paired device's permission to sync automatically while both apps are open on the same network. | Sync automatically |
| **Discoverable** | Whether this device advertises itself over UDP so other devices can find it. | Nearby sync off |

Relationship in one sentence: a **quest** holds **trials**, and claiming
trials moves the quest toward its **weekly vow**.

## 2. Renamed terms

The interface has been renamed twice. "Aim" became "goal" because it was not
self-explanatory; the current RPG pass then replaced the generic vocabulary.
The table records the full path so older screenshots, issues and commits remain
readable.

| Old wording | Current wording |
|---|---|
| Aim | Quest |
| Goal | Quest |
| Routine | Trial |
| Task (map stop) | Trial |
| Effort | Difficulty |
| light / medium / heavy | Easy / Standard / Hard |
| Weekly aim | Weekly vow |
| Weekly target / weekly objective | Weekly vow |
| Run | Journey |
| Node | Encounter |
| Path | Route |
| Boss | Warden |
| Rest | Respite |
| Treasure | Hoard |
| Wheel | Wheel of Fortune |
| Loot | Spoils |
| Profile | Wayfarer |
| Complete | Claim |
| Skip | Pass |
| Reset today | Abandon today |
| Missed day | Lost day |
| Days played | Days kept |
| Level / XP | Level / XP (kept: both are already clear and are heavily used) |

Kept as-is because they are already RPG vocabulary or unambiguous: Relic,
Reliquary, Gold, Day, Map and Camp. **Wheel** is the compact form of Wheel of
Fortune in tight feedback labels (toasts and short reward lines).

## 3. The code keeps the old names

The rename is **only** in the user-facing copy. Code identifiers, CSS classes,
DOM hooks, persisted fields and the export schema keep the old names on purpose,
to avoid a risky rename of persisted structures and styles.

Kept in code:

- `AimRow` component and its `aim-row`, `aim-group`, `summary-aim`,
  `node-aim` CSS classes.
- `screen--aims`, `data-screen="aims"`, `aria-labelledby="aims-title"`.
- `CONTENT_MESSAGES.aimWithoutRoutine` and `AIM_WITHOUT_ROUTINE`.
- `allAimsBonusCopy`, `goalHasActiveRoutine`, `routineErrors`.
- `draft-card--routine`, `field-grid--routine`, `review-routines`,
  `routine-list`, `routine__body`, `routine__actions` CSS classes.
- Domain types and fields: `Goal`, `Task`, `goalId`, `weeklyObjective`,
  `Effort`, `Run`, `MapNode`, `NodeType`, `boss`, `loot` and `path`.
- Mobile identifiers such as `GoalFormDialog`, `TaskFormDialog`, `AimRow`,
  `EffortDots`, `activeRoutines` and `routines`.

Rules for future work:

- New or edited **copy** uses Quest, Trial, Weekly vow, Difficulty, Journey,
  Encounter, Route, Warden, Respite, Hoard, Wheel of Fortune, Spoils, Wayfarer,
  Claim, Pass, Abandon today and Lost day.
- New or edited **identifiers** may keep the "aim"/"goal"/"routine"/"run"/"node"
  families for consistency with the surrounding code; renaming them is out of
  scope unless it is a dedicated, tested refactor.
- The persisted schema is unchanged: saved files keep `goals`, `tasks`,
  `goalId`, `weeklyObjective`, `effort`, `run`, `days`, `map`, `path` and
  `loot`, so no migration is needed.

## 4. Related documents

- [`SPEC.md`](./SPEC.md) — product scope and game rules.
- [`design/DESIGN.md`](./design/DESIGN.md) — design system and screen specs.
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — modules and type
  contracts.
- [`docs/UI.md`](./docs/UI.md) — screen map and shared components.
