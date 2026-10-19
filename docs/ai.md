# AI — flows, contracts and guardrails

> **Status:** specification (v0.1). Implements decision ADR-004: **AI always goes through the backend**; clients never hold API keys.
> Associated game principle: **AI proposes, the user approves** (GDD §2).

---

## 1. Principles

1. **Single proxy.** The backend talks to the provider; clients only talk to `/v1/ai/*`.
2. **Closed contracts.** Every output is validated against a JSON schema (zod). Invalid output → repair → fallback. Free text is never interpreted as an action.
3. **Human approval.** `plan_goal`, `suggest_decks`, `setup_stats_skills` and `shop_offers` produce drafts that are **not applied** until the user approves them. Nothing in the real world is ever executed on its own.
4. **Without AI, the game still works.** All flows have curated template pools in `packages/engine`.
5. **Minimal privacy.** Only the necessary text is sent (never evidence photos); context is minimized and what is sent is documented.
6. **Bounded cost.** Model routed per flow, cache by input hash, monthly per-user and global budget, kill switch.

---

## 2. Provider configuration

Backend environment variables (never in clients):

| Variable | Example | Use |
|---|---|---|
| `AI_ENABLED` | `true` | Global kill switch |
| `AI_PROVIDER` | `openai` · `anthropic` · `gemini` | Active adapter |
| `AI_MODEL_FAST` | small/cheap model | `generate_tasks`, `shop_offers`, `suggest_decks`, `setup_stats_skills` |
| `AI_MODEL_SMART` | large model | `plan_goal`, `weekly_recap` |
| `AI_MONTHLY_TOKEN_BUDGET_DEFAULT` | `150000` | Budget per user/month |
| `AI_GLOBAL_MONTHLY_BUDGET_USD` | `50` | Global spending cutoff |
| `AI_TIMEOUT_MS` | `30000` (fast) / `90000` (smart) | Timeouts |

The adapter implements a common interface: `generate({ model, system, messages, schema }) → { json, usage }`. Changing provider does not change the flows.

---

## 3. Flow catalog

| Flow | Input | Output | Model | Approval | Limit |
|---|---|---|---|---|---|
| `plan_goal` | Goal + context (hours/week, experience, constraints) | Milestones + candidate tasks | smart | Mandatory (editable draft) | 10/day |
| `generate_tasks` | Target difficulty + available pool + skills + recent failures | 3–8 SMART tasks | fast | Once (when approving the pool) | 20/day |
| `suggest_decks` | `kind: event/reward` + interests + existing cards | Proposed cards/vouchers | fast | Mandatory (they enter the deck unapproved) | 10/day |
| `shop_offers` | Run context + approved catalog + history | 3 offers with price | fast | Implicit (catalog only) | 30/day |
| `setup_stats_skills` | Onboarding answers | Stats (4–6) + skills (3–8) + suggested goals | fast | Mandatory | 5/day |
| `weekly_recap` | Week metrics + tone preferences | Recap + suggestions | smart | Read-only | 1/week |

The long flows (`plan_goal`, `weekly_recap`) are asynchronous: `202 + jobId` and polling (`GET /ai/jobs/:id`). The short ones respond synchronously.

---

## 4. JSON contracts (output)

### 4.1 `plan_goal`

```json
{
  "goalSummary": "string (≤ 200 chars)",
  "milestones": [
    {
      "title": "string (≤ 80)",
      "description": "string (≤ 300)",
      "targetWeek": 3,
      "successCriteria": "measurable string"
    }
  ],
  "taskDrafts": [
    {
      "title": "string (≤ 90)",
      "successCriteria": "measurable string",
      "durationMin": 45,
      "difficulty": 2,
      "skills": ["Programming"],
      "evidenceTypes": ["screenshot", "note"],
      "milestoneIndex": 0
    }
  ],
  "assumptions": ["string"],
  "warnings": ["string"]
}
```

Validation rules:

- `milestones`: 2–8; `targetWeek` increasing and within the goal horizon.
- `taskDrafts`: 3–20; `durationMin ∈ {15, 25, 45, 60, 90, 120}`; `difficulty` an integer 1–5 within the budget ±1.
- `skills`: subset of the user's skills (if one is missing, it is proposed in `warnings`).
- `evidenceTypes ⊆ {photo, screenshot, note, link}`.
- Duplicate tasks (high similarity with existing ones) are discarded in post-processing.

### 4.2 `generate_tasks`

```json
{
  "tasks": [
    {
      "title": "string",
      "successCriteria": "string",
      "durationMin": 45,
      "difficulty": 3,
      "skills": ["Art"],
      "evidenceTypes": ["photo"],
      "goalId": "g_12",
      "milestoneId": "m_3",
      "rationale": "string (≤ 140, optional)"
    }
  ]
}
```

Rules: do not repeat tasks from `recentFails` (except `pinned`); respect the difficulty budget; maximum 3 skills per task; tasks without a valid `goalId` are offered as generic.

### 4.3 `suggest_decks`

```json
{
  "cards": [
    {
      "kind": "penalty" | "reward" | "mixed",
      "title": "string (≤ 60)",
      "description": "string (≤ 240)",
      "durationMin": 15
    }
  ]
}
```

Rules: 3–10 cards; `durationMin` 5–180; **every draft is born `approved = false`**. Automatic rejection of harmful, illegal, medical, financial, sexual or extreme content, or content that involves spending money.

### 4.4 `shop_offers`

```json
{
  "offers": [
    {
      "kind": "item" | "reward",
      "itemKey": "potion_minor",
      "rewardDefId": "rw_2",
      "rarity": "common" | "rare" | "epic",
      "priceGold": 45,
      "reason": "string (≤ 120)"
    }
  ]
}
```

Rules: exactly 3 offers; `itemKey` from the engine catalog; `rewardDefId` from the user's **approved** catalog; price within the rarity range (GDD Appendix A.6); no repeats of recently purchased items.

### 4.5 `setup_stats_skills`

```json
{
  "stats": [
    { "name": "Health", "effectKey": "max_hp" },
    { "name": "Strength", "effectKey": "damage_reduction" }
  ],
  "skills": [{ "name": "Programming" }, { "name": "Art" }],
  "suggestedGoals": [{ "title": "string", "horizonWeeks": 12 }],
  "notes": "string (≤ 300)"
}
```

Rules: 4–6 stats with `effectKey` from the supported pool (`max_hp`, `damage_reduction`, `death_loss_reduction`, `gold_gain`, `xp_gain`, `rest_heal`, `drop_chance`, `reroll_charge`); 3–8 skills; no duplicates.

### 4.6 `weekly_recap`

```json
{
  "summary": "string (≤ 400)",
  "highlights": ["string"],
  "frictionPoints": ["string"],
  "suggestions": [
    { "action": "string", "reason": "string", "kind": "goal" | "task" | "deck" | "difficulty" }
  ],
  "toneCheck": "supportive"
}
```

Rules: max. 3 suggestions; no medical diagnoses or judgments; suggestions are proposals, never automatic changes.

---

## 5. Validation pipeline

```
prompt → provider → JSON.parse → zod.safeParse
   ├─ valid → post-processing (dedupe, limits, filters) → result
   └─ invalid → repair (1 attempt with validation errors)
                    ├─ valid → result
                    └─ invalid/error → curated fallback + incident log
```

- **Deterministic post-processing:** trimming, similarity deduplication, clamping of prices/durations, verification of references (`itemKey`, `rewardDefId`, `skillId`).
- **Provider errors** (timeout, 5xx, quota): single retry with backoff; then fallback.
- Every incident feeds quality telemetry (repair rate, fallback rate).

---

## 6. Content and real-world guardrails

**Always rejected** (output filter + validator):

- Harmful, illegal or dangerous actions, or actions involving third parties without consent.
- Medical, psychological, financial or legal advice.
- Spending real money, purchases, bets or debts.
- Sexual, violent or discriminatory content.
- Humiliating or extreme penalties, or penalties that contradict the anti-guilt pillar.
- Out-of-range durations (cards 5–180 min; tasks 15–120 min).

**Always required:**

- `EventCard` and `RewardDef` generated by AI: `approved = false` until explicit approval.
- Proposed vouchers can only come from the user's approved catalog.
- The weekly recap is informational: it cannot modify goals, stats or difficulty by itself.
- The proposed difficulty is bounded to the day's budget (±1).

---

## 7. Prompt security

- User text (goals, titles, notes) is treated as **untrusted data**: it is delimited (XML tags/JSON) and the system prompt states that it is not instructions.
- The model **has no tools** nor access to the DB; it only returns JSON.
- System prompts never contain secrets, emails, unnecessary internal IDs or paths.
- Inputs with injection attempts ("ignore your rules…") are neutralized by design (closed contract + output validation).
- Data sent to the provider per flow: text of goals/milestones/tasks/skills, aggregated metrics. **Never** photographic evidence, tokens, passwords or other users' data.

---

## 8. Costs, cache and limits

| Flow | Estimated tokens (in/out) | Strategy |
|---|---|---|
| `plan_goal` | ~2 500 / 1 500 | Smart, asynchronous, cache by goal+context hash |
| `generate_tasks` | ~1 200 / 800 | Fast, cache by `(dayKey, budget, hash(pool))` |
| `suggest_decks` | ~600 / 500 | Fast, cache by hash of interests + existing cards |
| `shop_offers` | ~800 / 400 | Fast, cache by `(runId, hash(catalog))` |
| `setup_stats_skills` | ~700 / 400 | Fast, once per onboarding |
| `weekly_recap` | ~2 000 / 800 | Smart, 1/week |

- **Response cache:** table keyed by `(flow, inputHash)` with TTL; identical responses are not paid for twice.
- **Budget:** per user/month (default 150k tokens) and global in USD. At 80 % a warning is issued; at 100 % it is blocked with `AI_BUDGET_EXCEEDED` and fallback is used.
- **Logging:** `AiUsage` (tokens/cost per flow) for user transparency (`GET /ai/usage`) and operational control.
- **Queue:** BullMQ for asynchronous flows, with priority and retries; `AiJob` persists status and result.

---

## 9. Fallback without AI

Curated pools in `packages/engine` (versioned with the game):

| Flow | Fallback |
|---|---|
| `plan_goal` | Template-based assistant: the user picks a goal archetype (learning, fitness, project, language) and edits the suggested milestones/tasks |
| `generate_tasks` | Template library per skill + difficulty (min. 20 per common skill) |
| `suggest_decks` | Base catalog of example cards and vouchers (editable) |
| `shop_offers` | Offers from the rarity table without AI |
| `setup_stats_skills` | Default set (Health, Strength, Intelligence, Discipline) + skills suggested by goals |
| `weekly_recap` | Deterministic recap with metrics and template phrases (friendly tone) |

The fallback activates without friction: the UI indicates "base suggestions" and allows retrying the AI later.

---

## 10. Evaluation and quality

- **Golden prompt set** (anonymized real examples) run in manual/monthly CI: validates structure, limits and guardrails.
- **Injection tests:** adversarial prompts in goals/notes must not alter the contract.
- **Cost regression:** alert if the average tokens per flow rises > 20 %.
- **Metrics:** repair rate, fallback rate, p95 latency, satisfaction (did the user approve the draft?).
