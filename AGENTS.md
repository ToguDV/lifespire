# AGENTS.md — Guide for AI agents

> This file tells any agent (or new person) **where everything lives, what to read before touching each area and which rules are never broken**.
> Product documents: [`GDD.md`](./GDD.md) · [`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`docs/`](./docs/README.md).

---

## Project status

- **Phase: specification frozen at v1.0 (2026-10-18). Implementation in progress, starting at M0.**
- The code under `apps/` and `packages/` **does not exist yet**: the paths in this document are the structure contract, still not files.
- `SPEC.txt` is the original draft (historical): **do not edit it**.

Recommended reading order for a new agent: `GDD.md` → `ARCHITECTURE.md` → the `docs/` doc for the area to touch.

---

## 1. Documents: what to read depending on the change

| If you are going to touch… | Read first | And also check |
|---|---|---|
| Gameplay, balance, economy, progression | [`GDD.md`](./GDD.md) | Appendix A (canonical numbers) |
| Stack, monorepo, structural decisions | [`ARCHITECTURE.md`](./ARCHITECTURE.md) | `docs/adr/` |
| Endpoints, REST contracts | [`docs/api/README.md`](./docs/api/README.md) | `docs/sync-offline.md` (ops) |
| Entities, fields, relations | [`docs/data-model.md`](./docs/data-model.md) | `docs/api/README.md` |
| Sync, offline, idempotency, ledger | [`docs/sync-offline.md`](./docs/sync-offline.md) | `ARCHITECTURE.md` §6–7 |
| AI flows, prompts, guardrails | [`docs/ai.md`](./docs/ai.md) | `docs/open-questions.md` |
| Phases, scope, exit criteria | [`docs/roadmap.md`](./docs/roadmap.md) | `GDD.md` Appendix B |
| Unclosed decisions | [`docs/open-questions.md`](./docs/open-questions.md) | `docs/adr/` |

**Rule:** before changing something in an area, read its source document; if the change alters the contract, **update the doc in the same change**.

---

## 2. Where does each thing go? (planned code)

| If it is… | It goes in… | And also update… |
|---|---|---|
| Game formula or rule (damage, gold, XP, difficulty) | `packages/engine/src/rules/**` + its test | Numbers only in `packages/engine/balance/*.json`; GDD Appendix A if the design changes |
| Map generation, RNG, daily seed | `packages/engine/src/map/**`, `src/rng/**` | `ENGINE_VERSION` bump + golden tests if it alters generation |
| New node type | `packages/engine` + `MapNode.type` enum | GDD §6 and `docs/data-model.md` |
| Curated templates (tasks, cards, quests, recap) | `packages/engine/templates/**` | — |
| Shared DTO/schema (zod) | `packages/shared-types/src/**` | `docs/api/README.md` if the contract changes |
| Web screen | `apps/web/src/routes/**`, `components/**` | GDD §18 (screen map) |
| Visual tokens (colors, typography) | `packages/design-tokens/**` | — |
| REST endpoint | `apps/api/src/<module>/**` (modules in ARCHITECTURE §6.1) | `docs/api/README.md` |
| New entity | **First** `docs/data-model.md` | `apps/api/prisma/schema.prisma` + migration |
| New sync operation | `docs/sync-offline.md` (catalog §4.2) | `packages/shared-types` + `apps/api/src/sync/**` |
| AI flow | `docs/ai.md` (JSON contract) | `apps/api/src/ai/flows/**` + fallback in `packages/engine/templates` |
| Gold/HP/XP mutation | `apps/api/src/economy/**` (ledger, `clientOpId`) | Never edit balances by hand; `docs/sync-offline.md` |
| Evidence (upload, signed URLs) | `apps/api/src/evidence/**` | Client compresses before uploading (ARCHITECTURE §9) |
| Notifications | `apps/api/src/notifications/**` + `apps/desktop` (Tauri) / `apps/mobile` (Expo) | `docs/api/README.md` if endpoints change |
| Desktop UI (Tauri) | `apps/desktop/**` (reuses the web build) | Do not duplicate game logic |
| Mobile UI (Expo) | `apps/mobile/**` | Logic only from `packages/engine` and `packages/shared-types` |
| Rule/determinism tests | `packages/engine/**/*.test.ts` (vitest + golden) | — |
| API tests | `apps/api/test/**` (jest + supertest + testcontainers) | — |
| Web E2E tests | `apps/web/e2e/**` (playwright) | — |
| Database migration | `apps/api/prisma/migrations/` | Never destructive without a plan; mandatory review |
| Structural decision | `docs/adr/NNNN-title.md` | `docs/adr/` already exists with ADR-001…ADR-017; the §17 table of `ARCHITECTURE.md` is the index |
| Development services (DB, Redis, MinIO) | `docker/compose.dev.yml` | — |
| CI (lint, test, build) | `.github/workflows/**` | — |
| New product document | `docs/` + link in `docs/README.md` | This `AGENTS.md` if the structure changes |

**Reference tree** (the complete contract is in [`ARCHITECTURE.md`](./ARCHITECTURE.md) §18):

```
apps/{api,web,desktop,mobile} · packages/{engine,shared-types,design-tokens,config}
docs/{README.md,api/,data-model.md,sync-offline.md,ai.md,roadmap.md,open-questions.md,adr/}
docker/ · .github/ · GDD.md · ARCHITECTURE.md · AGENTS.md
```

---

## 3. Rules that are never broken

1. **Languages:** everything in English: documentation prose, code, identifiers, paths and file names.
2. **Balance numbers only in `packages/engine/balance/*.json`.** Never hardcode game figures in UI, API or tests.
3. **Determinism:** do not change RNG or generation without an `ENGINE_VERSION` bump and new golden tests. An old run must remain reproducible with its frozen version.
4. **Server-authoritative economy:** every gold/HP/XP/item mutation goes through the ledger with `clientOpId` (idempotent). The server decides; the client is optimistic and reverts on rejection.
5. **AI with contract and fallback:** every AI flow needs a zod schema, output validation, a token budget and a **fallback without AI**. AI never applies changes to the real world without user approval.
6. **Design guardrails (GDD §2):** no surprise or permanent penalties; permanent progression (level, stats, skills, achievements) is never destroyed; texts never humiliate.
7. **Synchronized contracts:** a change of API, entity or sync operation ⇒ update `docs/api/README.md`, `docs/data-model.md` or `docs/sync-offline.md` in the same change.
8. **Dependency graph:** `apps/*` → `packages/*`; `engine` depends on nothing in the repo; `shared-types` does not depend on `engine`.
9. **`SPEC.txt` is historical:** do not edit or delete it without asking permission.

---

## 4. Commands (planned; implemented in M0)

| Command | What it does | Phase |
|---|---|---|
| `pnpm install` | Installs the workspace | M0 |
| `pnpm dev` | Starts web + api + services (Turborepo; Postgres/Redis/MinIO via docker) | M0 (web) / M2 (full stack) |
| `pnpm lint` · `pnpm typecheck` | Quality gates | M0 |
| `pnpm test` | Unit (vitest/jest) for all packages | M0 |
| `pnpm test:e2e` | Playwright (critical web flows) | M2 |
| `pnpm sim:balance` | Monte Carlo simulator of the engine against the GDD targets | M1 |
| `pnpm db:migrate` | Prisma Migrate | M2 |
| `pnpm tauri:dev` · `pnpm expo:start` | Desktop/mobile apps | M4 / M5 |

> These commands remain the contract and will start working as M0 lands; the **Phase** column shows when each one becomes operational.

---

## 5. Agent workflow (checklist)

1. **Locate** the area in §1/§2 and read its source documents.
2. **Change** code + tests together.
3. **Update** the affected documents in the same change (contracts above all).
4. **Run the gates:** `lint` + `typecheck` + `test`; if it touches web, E2E; if it touches balance, `sim:balance`.
5. **Close the loop:** if it is a structural decision → ADR + table in `ARCHITECTURE.md` §17; if it answers an open question → update `docs/open-questions.md`.

**Definition of Done of a change:**

- [ ] Tests covering the new rule/behavior (or a justification of why it does not apply).
- [ ] Source documents updated (contract, entity, balance or GDD).
- [ ] No game figures hardcoded outside `engine/balance`.
- [ ] No secrets or keys in the client.
- [ ] `lint`, `typecheck` and `test` in green.

---

## 6. Quick recipes

- **Add a balance rule:** edit `packages/engine/balance/*.json` → update GDD Appendix A if the design changes → run `sim:balance` → golden tests if it alters generation.
- **Add an endpoint:** define the contract in `docs/api/README.md` → zod DTO in `packages/shared-types` → corresponding Nest module → e2e test if it touches economy/sync.
- **Add an entity:** `docs/data-model.md` first → Prisma schema + migration → API → shared types → sync doc if it generates operations.
- **Add a web screen:** map it in GDD §18 → `apps/web/src/routes` → components with `design-tokens` → Playwright if it is a critical flow.
- **Add an AI flow:** JSON contract in `docs/ai.md` → `apps/api/src/ai/flows` → zod validation + guardrails → fallback in `engine/templates` → injection test.
