# ADR-004: AI exclusively through the backend proxy, configurable provider

- **Status:** Accepted
- **Date:** 2026-10-18
- **Related:** [`ARCHITECTURE.md` §10](../../ARCHITECTURE.md), [`docs/ai.md`](../ai.md), [`GDD.md` §16](../../GDD.md)

## Context

Several flows (goal planning, task generation, shop offers, recaps) benefit from an LLM, but an API key in a web, desktop or mobile build is immediately extractable. Provider pricing and quality also move quickly, and the game must remain playable when AI is unavailable or over budget.

## Decision

AI is reachable **only** through the `ai` module of the backend. The provider is chosen per environment (`AI_PROVIDER`, `AI_MODEL_FAST`, `AI_MODEL_SMART`: OpenAI, Anthropic or Gemini) behind an adapter. Each flow has a zod-validated JSON contract, caching by `(flow, hash(input))`, a monthly token budget per user, a BullMQ queue for long flows, an `AiUsage` audit trail and a **non-AI fallback** in the engine's curated templates.

## Consequences

- + No provider key ever ships to a client.
- + Providers can be swapped, rate-limited or killed by env var without touching the clients.
- + Every flow degrades to curated content, so the game is 100% playable without AI.
- − The backend is on the critical path for AI features and needs its own latency and budget handling.
- − Each flow needs two implementations: the AI path and the fallback pool.
