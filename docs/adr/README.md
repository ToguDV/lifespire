# Architecture Decision Records (ADRs) — LifeSpire

> **Version:** 0.1 · **Date:** 2026-10-18
> One file per structural decision. Summary table in [`ARCHITECTURE.md` §17](../../ARCHITECTURE.md#17-decision-log-adrs).

## What is an ADR?

An ADR is a short, versioned record of **one structural decision**: the problem that forced a choice, the choice made, and its consequences. It is not a design document or a tutorial — it is the logbook that explains *why* the architecture looks the way it does. Decisions are not rewritten in place: when one is replaced, a new ADR supersedes it and the old file stays, marked `Superseded by ADR-NNN`.

## Format

Files are named `NNNN-slug.md` (zero-padded, sequential, English slug) and keep this structure:

```md
# ADR-NNN: Title

- **Status:** Accepted | Proposed | Superseded by ADR-NNN
- **Date:** YYYY-MM-DD
- **Related:** links to documents/sections, if any

## Context
What problem forces a decision (2–5 lines).

## Decision
What is decided, concrete and in present tense.

## Consequences
- + advantages
- − costs/risks and what remains pending
```

Each ADR is 15–40 lines, with no filler.

## Rules

1. **Every structural decision requires an ADR.** Stack, packages, contracts, persistence, sync, tooling or a new platform: if it constrains future work, it gets a file here.
2. **And a row in the table.** The decision is also summarized in [`ARCHITECTURE.md` §17](../../ARCHITECTURE.md#17-decision-log-adrs) — same change, same commit.
3. **Contracts stay synchronized.** If the decision changes an API, entity or sync operation, the source document is updated in the same change (see [`docs/README.md` §4](../README.md) and [`AGENTS.md` §2](../../AGENTS.md)).
4. **Balance numbers are never duplicated here.** Figures live in `packages/engine/balance/*.json`; the canonical reference is [GDD Appendix A](../../GDD.md#19-appendix-a--initial-balance).

## Index

| ID | Title | Status |
|---|---|---|
| [ADR-001](./0001-pnpm-turborepo-monorepo.md) | pnpm + Turborepo monorepo with `apps/*` and `packages/*` | Accepted |
| [ADR-002](./0002-shared-deterministic-engine.md) | Shared deterministic game engine in pure TypeScript | Accepted |
| [ADR-003](./0003-server-authoritative-economy.md) | Server-authoritative economy via idempotent event ledger | Accepted |
| [ADR-004](./0004-ai-through-backend-proxy.md) | AI exclusively through the backend proxy, configurable provider | Accepted |
| [ADR-005](./0005-postgres-prisma.md) | Postgres + Prisma as the database | Accepted |
| [ADR-006](./0006-offline-first-outbox.md) | Offline-first with outbox + incremental pull (no CRDT) | Accepted |
| [ADR-007](./0007-tauri-v2-desktop.md) | Tauri v2 for desktop (reuses the web build) | Accepted |
| [ADR-008](./0008-expo-react-native-android.md) | React Native + Expo for Android, own UI (no react-native-web) | Accepted |
| [ADR-009](./0009-evidence-s3-signed-urls.md) | Evidence in S3-compatible storage with signed URLs | Accepted |
| [ADR-010](./0010-rest-v1-websocket.md) | REST API `/v1` + WebSocket (no GraphQL) | Accepted |
| [ADR-011](./0011-web-stack.md) | React 19 + Vite web stack on TanStack, Zustand and Tailwind | Accepted |
| [ADR-012](./0012-i18n-i18next.md) | i18next + react-i18next internationalization, no hardcoded text | Accepted |
| [ADR-013](./0013-toolchain-repo-license.md) | Node 24 + pnpm 11 toolchain, `@lifespire/*` scope, MIT license | Accepted |
| [ADR-014](./0014-client-side-evidence-policy.md) | Client-side evidence policy: compression, quotas, local blob queue | Accepted |
| [ADR-015](./0015-local-first-seed-salt.md) | Local-first `userSeedSalt` generated in the client, adopted by the server | Accepted |
| [ADR-016](./0016-map-rule-profiles.md) | Map generation parameterized by rule profiles in balance JSON | Accepted |
| [ADR-017](./0017-daykey-pure-function.md) | `dayKey` as a pure engine function, no `Intl` dependency | Accepted |
