# ADR-005: Postgres + Prisma as the database

- **Status:** Accepted
- **Date:** 2026-10-18
- **Related:** [`ARCHITECTURE.md` §6, §14](../../ARCHITECTURE.md), [`docs/data-model.md`](../data-model.md)

## Context

The backend stores a relational domain — users, goals, runs, nodes, ledger entries, inventory, quests — with transactional guarantees required by the economy ledger. Migrations must be reviewable and reversible, and the single-developer scope rules out operating a bespoke database layer.

## Decision

**Postgres 16** is the database and **Prisma** the access layer. The schema lives in `apps/api/prisma/schema.prisma`; every change goes through Prisma Migrate with mandatory review in CI and is never destructive without a plan. Entities and relations are specified first in [`docs/data-model.md`](../data-model.md), and local development runs Postgres 16 in `docker/compose.dev.yml`.

## Consequences

- + Real transactions and unique constraints, which the idempotent ledger depends on (`clientOpId` uniqueness).
- + Typed queries and generated migrations aligned with the TypeScript codebase.
- + Managed deployment options (Neon, Supabase) keep the personal-scope operations cheap.
- − Prisma's abstraction leaks on complex queries, which may need raw SQL escape hatches.
- − A relational DB does not fit the offline clients directly; the sync layer (ADR-006) carries the extra complexity.
