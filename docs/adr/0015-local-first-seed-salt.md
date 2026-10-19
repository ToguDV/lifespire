# ADR-015: Local-first `userSeedSalt` adopted by the server

- **Status:** Accepted
- **Date:** 2026-10-18
- **Related:** [`ARCHITECTURE.md` §4.2, §7](../../ARCHITECTURE.md), [`docs/sync-offline.md`](../sync-offline.md#3-daily-seed-and-offline-generation), ADR-002

## Context

The daily seed is derived from a per-user `userSeedSalt`, and in M0 there is no backend at all: the web app must generate playable, reproducible maps from the first launch. If the server later issued its own salt, every map already created locally would silently change or stop being reproducible.

## Decision

In **M0** the `userSeedSalt` (32 bytes, hex) is generated **in the client** with `crypto.getRandomValues` on first startup and stored in the local `meta` store. In **M2** the migration **adopts** that salt through an idempotent endpoint that only accepts it if the account has none yet; the server never issues a different salt for pre-existing local data. The salt is **never rotated**.

## Consequences

- + The game is fully playable before any backend exists, with reproducible maps.
- + Existing runs keep their maps across the M0 → M2 migration, per ADR-002's frozen `engineVersion`.
- + Adoption is idempotent, so a retried migration call is harmless.
- − A locally generated salt has no server-side provenance and cannot be recovered if the client storage is wiped.
- − A lost salt means lost map reproducibility for that user; account export must include it.
