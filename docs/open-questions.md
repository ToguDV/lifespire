# Open decisions

> **Status:** living log. The **initial state of v1.0 (2026-10-18)** already incorporates the decisions **B1–B9 (OQ-23…OQ-30)**, and **OQ-04 is closed**; the remaining questions stay open with their default proposal until the indicated phase.
> Each entry has a **default proposal** so that implementation is not blocked; the final decision is documented here and, if structural, as an ADR.
> Criterion: if a question does not change the work of the current phase, it is answered with the default and revisited in the indicated phase.

---

## Product

| ID | Question | Default proposal | Decide before |
|---|---|---|---|
| OQ-01 | Monetization? | None for now (personal project). If it opens to the public: subscription to AI features, never pay-to-win nor selling gold/items. | Opening public registration |
| OQ-02 | Social features (friends, streak duels, leaderboard)? | Not in the MVP. Private challenges between friends as a possible future phase; no public rankings (privacy and anti-comparison). | Post-M6 |
| OQ-03 | Final name and branding | **Decided (2026-10-18):** the product is called **LifeSpire**. | Decided |
| OQ-04 | Aesthetics/final art | **Decided (2026-10-18):** ink & ember direction; 12 tokens in packages/design-tokens (ADR-011). | Decided |
| OQ-05 | English and other languages? | Spanish now; English in M6. Texts externalized from M0. | M6 |

## Gameplay and balance

| ID | Question | Default proposal | Decide before |
|---|---|---|---|
| OQ-06 | The % of gold lost on death, does it apply to total gold or only to the gold earned during the day? | **Total gold** (50 %, reducible), as specified. Revisit after M1 telemetry if it feels disproportionate. | M1 (end of phase) |
| OQ-07 | Can extra freezes be bought with gold? | Not by default (2 free/month). Buying streak protection can foster anxiety; revisit if there is real demand. | M6 |
| OQ-08 | Is the Phoenix Drop sold in the Shop? | No: Elite/Boss loot only (max. 1/week). | M1 |
| OQ-09 | Alternative actions in Rest (upgrade an item, prepare a shield)? | Post-M6; first measure whether the plain Rest already fulfills its role. | Post-M6 |
| OQ-10 | Reviving by paying gold? | No: Phoenix Drop only. The penalty must hurt and must not be re-purchasable with the currency that is lost. | M1 |
| OQ-11 | Difficulty manually adjustable by the user? | Not in the MVP: the curve is adaptive and freezes/vacations cover the bad weeks. Revisit with data. | M6 |
| OQ-12 | External integrations as automatic evidence (Strava, GitHub, Anki, Notion, Google Calendar) | Post-M6; first validate the manual-evidence habit. | Post-M6 |
| OQ-13 | Evidence verification by AI vision | Optional future, never mandatory: costs, latency and false negatives can frustrate. | Post-M6 |
| OQ-14 | Map length and exact node rates | Current values (8 rows, distribution in GDD §5.2) are the starting point; tune with M1 telemetry. | M1 |
| OQ-15 | Full XP for repeated routines? Risk of farming? | Full XP (trust on an honor basis); if abuse appears, add diminishing returns. | M6 |
| OQ-16 | Editorial policy for event cards (tone, content limits) | Guardrails from [`ai.md`](./ai.md) §6 as a basis; review real examples at the end of M1. | M1 |

## Technical

| ID | Question | Default proposal | Decide before |
|---|---|---|---|
| OQ-17 | OAuth (Google) in M2 or later? | After the MVP (email + password first). | M2 |
| OQ-18 | Web Push (VAPID) vs local notifications on web | Local with the tab open + optional push in M6; the end of an offline timer is covered by desktop/mobile local notifications. | M6 |
| OQ-19 | Final hosting | Fly.io (API) + Cloudflare Pages (web) + Neon (Postgres) + Upstash (Redis) + R2 (evidence). Decide in M2 with real costs. | M2 |
| OQ-20 | Product telemetry | Aggregated events without PII (runs, deaths, AI usage); visible opt-out. Define the exact list before opening to the public. | Opening public registration |
| OQ-21 | Default evidence retention | Keep (it is the player's journal); configurable per user. | M2 |
| OQ-22 | Backup and PITR strategy | Daily backups + WAL to R2 if self-hosted; managed PITR if Neon/Supabase. Test restoration in M2. | M2 |

---

## Decisions closed before M0 (2026-10-18)

| ID | Question | Decision | Decided |
|---|---|---|---|
| OQ-23 | Offline daily seed without a backend: where does the salt come from? | **Decided (2026-10-18):** without a backend, `userSeedSalt` (32-byte hex) is generated on the client at first launch and stored locally; in M2 the migration **adopts** that salt (idempotent endpoint) and the server never issues a different one for pre-existing data; it is never rotated. | Decided |
| OQ-24 | Map generator profiles in M0? | **Decided (2026-10-18):** the generator is parameterized with `nodeTypeSet` + `guarantees` in `packages/engine/balance/*.json`; the M0 profile is only `enemy` and `elite`, with no Rest/Shop guarantees and no Boss. | Decided |
| OQ-25 | Scope of Home in M0? | **Decided (2026-10-18):** map, gold, accumulated XP and the progress of the day; no HP, streak, quests or level; a "local-only" indicator. | Decided |
| OQ-26 | i18n library? | **Decided (2026-10-18):** i18next + react-i18next, keys in English, source locale `es`, `Intl` for dates/numbers. | Decided |
| OQ-27 | `dayKey` and time zone? | **Decided (2026-10-18):** `dayKey(timestampMs, tzOffsetMinutes, closeHour)` pure in the engine; the client refreshes the offset with `Intl` on open; defaults to the system TZ and `closeHour = 4`. | Decided |
| OQ-28 | Toolchain, repository and license? | **Decided (2026-10-18):** Node 24 LTS + pnpm 11 + strict TypeScript, ESLint 9 (flat) + Prettier 3, `@lifespire/*` scope, public repo with MIT license, Conventional Commits, trunk-based with protected `main`, CI in GitHub Actions. | Decided |
| OQ-29 | Client-side evidence policy? | **Decided (2026-10-18):** compression to ~1600 px WebP q0.8, max 10 MB, 50/day, SHA-256, local blob queue, warning at 80 % quota, `navigator.storage.persist()`; photo/note/link only. | Decided |
| OQ-30 | Task failure in M0? | **Decided (2026-10-18):** with no HP or death, failing an Enemy/Elite node leaves the task `skipped`, with no reward or consequence; the day can still be closed. Revisit in M1 when HP/death arrive. | Decided |

---

## How to close a decision

1. Edit the row with the final decision and date (the "Decide before" column becomes "Decided").
2. If it changes architecture, create an ADR in `docs/adr/` and update the table of [`ARCHITECTURE.md`](../ARCHITECTURE.md#17-decision-log-adrs).
3. If it changes gameplay, update [`GDD.md`](../GDD.md) (and the balance if applicable).
4. If it changes the API/data contract, update [`docs/api/README.md`](./api/README.md) or [`docs/data-model.md`](./data-model.md).
5. ADRs live in [`docs/adr/`](./adr/README.md) (one numbered file per decision); whenever one is created or decided, update the §17 table of [`ARCHITECTURE.md`](../ARCHITECTURE.md#17-decision-log-adrs) in the same change.
