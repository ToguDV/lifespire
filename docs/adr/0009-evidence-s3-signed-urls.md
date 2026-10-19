# ADR-009: Evidence in S3-compatible storage with signed URLs

- **Status:** Accepted
- **Date:** 2026-10-18
- **Related:** [`ARCHITECTURE.md` §8, §9](../../ARCHITECTURE.md#9-evidence-and-storage), [`docs/api/README.md`](../api/README.md)

## Context

Evidence photos are private, can be large, and must never be reachable through a public link. Streaming them through the API would hold Node workers busy on bytes, and storing blobs in Postgres would bloat backups.

## Decision

Photo evidence lives in an **S3-compatible bucket** (MinIO in dev, Cloudflare R2 or S3 in production). The API only brokers metadata and cryptography: `POST /v1/evidence/uploads` returns a **short-lived signed PUT URL**, the client uploads directly, and `POST /v1/evidence/:id/confirm` verifies the checksum before the evidence is attached to a task. Reads use signed URLs with a 5-minute lifetime, the bucket is private, and provider-side encryption at rest is enabled.

## Consequences

- + The API never proxies photo bytes, so uploads do not consume API capacity.
- + Private by default: a leaked database row does not expose a usable photo URL.
- + Local development uses the same interface through MinIO, so no environment-specific code path.
- − Two-step upload plus confirmation introduces a partial state (uploaded but unconfirmed) that sync must handle.
- − Signed-URL lifetimes and clock skew become an operational detail to monitor.
