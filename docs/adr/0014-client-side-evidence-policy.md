# ADR-014: Client-side evidence policy

- **Status:** Accepted
- **Date:** 2026-10-18
- **Related:** [`ARCHITECTURE.md` §9](../../ARCHITECTURE.md#9-evidence-and-storage), [`docs/sync-offline.md` §7](../sync-offline.md#7-offline-evidence), ADR-009, ADR-004

## Context

Evidence is produced offline, from a phone camera, on connections that may be slow or metered. Ungoverned uploads would exhaust storage budgets, stall the outbox behind giant files and burn mobile data for a photo that is only ever proof of effort.

## Decision

Evidence is prepared **on the client** before it enters the outbox: images are compressed to **~1600 px WebP at quality 0.8**, capped at **10 MB per file** and **50 files per day**, and hashed with **SHA-256** for the confirmation step. Pending blobs wait in a **local queue** and upload when connectivity returns; the task can be completed before the upload finishes. The app warns at **80% of the storage quota** and calls **`navigator.storage.persist()`** on first use. Only **photo, note and link** evidence exist — no video.

## Consequences

- + Predictable upload sizes and a bounded daily volume for both the user and the storage bill.
- + The task flow never blocks on a network round trip.
- + SHA-256 lets the server detect a corrupted or truncated upload at confirmation time.
- − Client-side compression quality is a product trade-off that must not destroy the proof value of the photo.
- − A large offline backlog can still exceed device storage; the 80% warning is a mitigation, not a guarantee.
