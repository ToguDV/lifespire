# Documentation — LifeSpire

> **Version:** 1.0 · **Date:** 2026-10-18
> This directory contains the detailed documentation. The root documents are [`GDD.md`](../GDD.md) (game design) and [`ARCHITECTURE.md`](../ARCHITECTURE.md) (technical architecture).

---

## Index

| Document | Content |
|---|---|
| [api/README.md](./api/README.md) | `/v1` API conventions, modules, planned endpoints, errors, example flows |
| [data-model.md](./data-model.md) | Entities, fields, relations and ER diagram |
| [sync-offline.md](./sync-offline.md) | Offline-first protocol: outbox, ledger, idempotency, merge, offline daily seed |
| [ai.md](./ai.md) | AI flows, JSON contracts, guardrails, costs, fallbacks and privacy |
| [roadmap.md](./roadmap.md) | Phases M0–M6 with objectives and exit criteria; MVP definition |
| [open-questions.md](./open-questions.md) | Pending decisions with context and default proposal |
| `adr/` | [adr/README.md](./adr/README.md) — individual ADRs, numbered, with the format context/decision/consequences |
| [../AGENTS.md](../AGENTS.md) | Guide for AI agents: where everything goes, repo rules and workflow |

## Documentation conventions

1. **Language:** documents and prose in English; code identifiers (entities, fields, endpoints, flows) also in English, inside `backticks`.
2. **Source of truth for numbers:** [GDD Appendix A](../GDD.md#19-appendix-a--initial-balance). No document redefines balance figures: they are referenced.
3. **Source of truth for entities:** [`data-model.md`](./data-model.md). If a document needs a new entity, it is created here first.
4. **Structural changes:** require an ADR in `docs/adr/` (format: context, decision, consequences) and updating the ADR table of [`ARCHITECTURE.md`](../ARCHITECTURE.md#17-decision-log-adrs).
5. **Consistency:** when editing a document, review the documents that reference it (cross-links included).
6. **Project status:** spec **frozen at v1.0**; implementation starts at M0 per [`roadmap.md`](./roadmap.md). The endpoints and schemas remain the target contract.
