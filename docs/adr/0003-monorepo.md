# ADR-0003 — pnpm monorepo with shared core

> Amended by ADR-0007: `apps/api` and `packages/api-client` were removed; the
> monorepo now contains web, desktop, Android, `packages/core` and
> `packages/app-core`.

> Date: 2026-10-24. Status: accepted (partially implemented).

## Decision

```
apps/web/          Vite + React (moved from repo root, no code changes)
packages/core/     pure domain (dates, generator, rewards, lifecycle, schema)
```

- The web move is atomic: relative imports are untouched.
- `packages/core` started as a copy of `src/domain` + `src/content`. Dedup
  via re-export shims landed in #46: the web keeps one-line shims, core is
  the source of truth, and `scripts/check-core-parity.sh` asserts the shim
  list (it no longer diffs contents).
- The removed API used to validate documents structurally instead of importing
  core TS sources, until core shipped a build output that Nest/Vitest
  can consume without workspace source-resolution hacks.
- One Vitest setup everywhere (the API dropped Jest: NestJS 12 is ESM-only
  and Jest's CJS runtime cannot load it).

## Rationale

- Incremental, always-green migration beats a flag-day rewrite.
- Test-runner uniformity removes an entire class of ESM/CJS issues.

## Consequences

- Temporary duplication between `apps/web/src/domain` and `packages/core`.
  Schema changes (e.g. v3 `run.timeZone`) must be applied to both until the
  shim lands — CI does not yet enforce this; reviewers must.
