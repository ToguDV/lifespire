# LifeSpire

LifeSpire is a **productivity roguelike**: your real-life tasks become the rooms of a daily
dungeon run. Complete tasks, clear the map, earn gold/XP and level up — never through punishment,
always through progress.

## Documentation

- [GDD.md](./GDD.md) — game design (rules, balance, art direction).
- [ARCHITECTURE.md](./ARCHITECTURE.md) — stack, monorepo layout and structural decisions.
- [docs/README.md](./docs/README.md) — documentation hub.
- [docs/roadmap.md](./docs/roadmap.md) — phases, scope and exit criteria.

## Status

**M0 in progress** — the workspace skeleton (pnpm + Turborepo, shared config, design tokens and CI)
is being laid down. Game packages (`engine`, `shared-types`) and `apps/web` arrive next.

## Commands

```bash
pnpm install        # install the workspace
pnpm dev            # run every dev task (Turborepo)
pnpm build          # build every package
pnpm lint           # lint every package
pnpm typecheck      # type-check every package
pnpm test           # run every unit test suite
pnpm format         # format with Prettier
```

## License

MIT — see [LICENSE](./LICENSE).
