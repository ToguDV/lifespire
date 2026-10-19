# ADR-010: REST API `/v1` + WebSocket (no GraphQL)

- **Status:** Accepted
- **Date:** 2026-10-18
- **Related:** [`ARCHITECTURE.md` §6](../../ARCHITECTURE.md#6-backend-nestjs), [`docs/api/README.md`](../api/README.md), [`docs/sync-offline.md`](../sync-offline.md)

## Context

Three clients consume the API and one of them (the outbox sync) is a batch of operations with per-item results. Caching, offline retry and error semantics must be trivial to reason about on mobile and in a Tauri WebView, and the surface is a small set of versioned endpoints.

## Decision

The API is **REST under `/v1`**, versioned in the path, with zod DTOs from `packages/shared-types` validating both request and response. Sync uses `POST /v1/sync/push`, `GET /v1/sync/pull?cursor=` and a **WebSocket** (`socket.io`) at `/v1/sync/stream` that only signals "there are changes" — it never carries critical state. **GraphQL is not used.**

## Consequences

- + Predictable HTTP semantics: status codes, retries, `clientOpId` idempotency and per-item results in the push batch.
- + A WebSocket that can drop without data loss, because the pull is the source of truth.
- + Simple client tooling (fetch/TanStack Query) and straightforward per-endpoint rate limiting.
- − Multi-resource screens may need several calls instead of one nested query.
- − Response shapes are negotiated by contract, so adding a field to an existing payload needs care around old clients.
