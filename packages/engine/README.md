# @lifespire/engine

The deterministic heart of LifeSpire: RNG, daily seed, day key and pure game
rules. **Every rule lives here once** and every platform (web, desktop,
Android, server) runs the same code (ADR-002).

## Public surface

| Export | Purpose |
| --- | --- |
| `ENGINE_VERSION` | Frozen version of the rules/generator (`0.1.0`). Bump it whenever generation or rules change. |
| `createRng(seed)` | xoshiro128\*\* PRNG seeded through cyrb128. `next()`, `nextInt(max)`, `pick(items)`. |
| `deriveDailySeed(salt, dayKey, engineVersion)` | `HKDF-SHA-256(salt, dayKey + engineVersion)` as 64-char hex. |
| `dayKey(ts, tzOffsetMinutes, closeHour)` | Pure `YYYY-MM-DD`, no `Intl` (ADR-017). |
| `computeRewards(node, difficulty, streakDays?)` | Gold, XP and drop chance (GDD Appendix A). |
| `computeDamage(node, difficulty, stats?)` | Failure damage, reduced by `damageReductionPct` (cap 25 %). |
| `computeDeathPenalty(gold, stats?)` | Gold lost on death, 50 % reduced by 2 pp per level (min 25 % loss). |
| `xpToNext(level)` | `round(100 × n^1.35)`. |
| `difficultyBudget(playerLevel, successRate7d)` | Adaptive budget clamped to `[2.0, 4.4]`. |
| `balance` | Balance tables loaded from `balance/balance.json`. |
| `profiles` / `getProfile(id)` | Rule profiles loaded from `balance/profiles.json`. |
| `generateMap` / `validateMap` / `layoutMap` | Map surface (implemented under `src/map/*`). |

Types (`NodeType`, `MapData`, `MapGenInput`, `Rewards`, `RuleProfile`, …) are
exported from the package root and frozen for v0.1.0.

## Determinism rules

- Pure TypeScript: **no** `node:crypto`, `fs`, DOM, `Date.now()`, `Math.random()`
  or `Intl`. Timezone offsets and close hours are explicit arguments.
- Same seed ⇒ same RNG stream, on every runtime.
- Same `(userSeedSalt, dayKey, ENGINE_VERSION)` ⇒ same daily seed; changing any
  of them changes the map.
- `dayKey` uses integer arithmetic only. With `closeHour = 4`, 03:59 on the
  19th still belongs to the 18th.
- **Balance numbers live only in `balance/*.json`** (canonical source: GDD
  Appendix A). Never hardcode figures in code or tests.
- Changing anything that alters generation or rules requires bumping
  `ENGINE_VERSION` and adding golden tests.

## Known gap

The frozen `StatSnapshot` has no `disciplineLevel` field yet, so
`computeDeathPenalty` reads the level from `stats.healthLevel`. When the snapshot
grows a dedicated field, switch to it in the same change (no behaviour change
for the default `{}` case: 50 % loss).

## Scripts

```sh
pnpm --filter @lifespire/engine typecheck
pnpm --filter @lifespire/engine lint
pnpm --filter @lifespire/engine test
```
