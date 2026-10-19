# ADR-001: pnpm + Turborepo monorepo

- **Status:** Accepted
- **Date:** 2026-10-18
- **Related:** [`ARCHITECTURE.md` §3](../../ARCHITECTURE.md#3-monorepo-and-packages), §18, [`AGENTS.md`](../../AGENTS.md)

## Context

The product ships the same game rules to a web app, a desktop wrapper and an Android app, plus a backend that must validate and pay out rewards with identical logic. Rules duplicated across four repositories diverge, and a diverged generator breaks the reproducibility of the daily map.

## Decision

LifeSpire is a single **pnpm workspaces + Turborepo** monorepo with two top-level groups: `apps/*` (web, desktop, mobile, api) and `packages/*` (engine, shared-types, design-tokens, config). Dependencies flow one way: `apps/*` → `packages/*`. `engine` depends on nothing in the repo, and `shared-types` does not depend on `engine`. Turborepo caches `lint`, `typecheck`, `test` and `build` per package.

## Consequences

- + One version of every rule, DTO and token, shared by all clients and the server.
- + Atomic changes: a contract change and all its consumers land in one commit.
- + Turborepo caching keeps CI affordable as the package count grows.
- − A workspace learning curve and stricter packaging hygiene (explicit dependency per package).
- − Shared packages must stay platform-neutral: a DOM or Node import inside `packages/engine` is a reviewable defect.
