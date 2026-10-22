# MVP-0 playtest results — M4-02

> Historical record: this dry run describes the four-layer MVP-0 build. The
> current generator derives map depth from the active goals (3–5 layers); see
> [`SPEC.md`](../SPEC.md) §5.

> **Internal dry run — external tester sessions pending.**
> No human testers were recruited or run in this environment. The only session
> recorded here is a facilitator rehearsal of
> [`playtest-plan.md`](./playtest-plan.md). It is useful for protocol timing,
> flow breaks and copy problems; it is **not** evidence about users, retention or
> preference. Do not cite the timings below as a new-user result.

Date: 2026-10-21. Branch: `mvp-0`. Build under test: `2d8c080` plus the
documentation commit that adds this file. Environment: Chromium via Playwright,
Linux, dev server on `http://localhost:5182`; the dry run used the default
desktop viewport (1280×720). The 360×800 check belongs to the M3-07 acceptance
pass, not to this dry run. Tests: 296 green, 0 console errors or warnings in the
exercised flow.

## 1. Status

| Item | Status |
| --- | --- |
| Protocol written and repeatable | **Done** — [`playtest-plan.md`](./playtest-plan.md) |
| Internal facilitator dry run | **Done** — one session, recorded below |
| External testers recruited | **Pending** — not possible in this environment |
| 3–5 external sessions | **Pending** |
| 3-of-5 return-intent evidence | **Not collected** |
| Tuning from observed user behaviour | **Only copy/legibility fixes; no domain tuning** |

The dry run is intentionally separated from the external round. It cannot
satisfy the M4-02 acceptance criterion “at least 3 testers complete 3 simulated
days” and it does not claim to.

## 2. Method

- Fresh browser profile and empty `lifespire:mvp0`.
- The facilitator followed the session script in order: demo onboarding, day 1,
  reload check, dev advance, day 2 (boss skipped), day 3, compressed days 4–7,
  run close, new run, reset.
- The timer started at page load; the demo click and the day 1 summary were
  timestamped from the tool log. Times are rounded to the nearest second.
- The facilitator had already read the code and the acceptance document. That
  makes the timed section optimistic: a real new user has to read the screen,
  not recognise the flow.
- No audio/video recording, no external participants, no personal data. The demo
  profile (`Wren`) was used throughout.

## 3. Dry-run log

### 3.1 Onboarding and day 1

| Checkpoint | Observed | Time |
| --- | --- | --- |
| Welcome screen loaded | “A day is a path.” with demo/custom actions | 11:09:17 |
| **Begin with demo data** clicked | Profile `Wren`, two aims, five routines, run and day 1 map created atomically | 11:09:25 |
| Day 1 summary visible | Five nodes resolved, day sealed, +140 XP / +155 gold / 3 relics | 11:10:10 |

**Onboarding + day 1: about 53 seconds** from page load to the sealed day 1
summary (45 seconds from the demo click). The SPEC target is under 10 minutes.
This is a **mechanical pass only**: the facilitator knew exactly where to click.
It proves the flow is short, not that a new user understands it.

Day 1 path observed:

- Layer 0 offered three task nodes: light 10/10, medium 15/15, heavy 20/20.
- The facilitator chose the heavy task; rewards and weekly progress updated
  immediately and the toast read “Step kept · +20 XP · +20 gold · +1 weekly aim”.
- Layer 1 offered a medium task and a heavy elite. The elite was strictly better
  in resources and equal in weekly progress.
- Layer 2 offered a single heavy task; layer 3 offered a single treasure; the
  boss was a heavy task with the closing bonus.

The path had choices in the first two layers and then narrowed to one option per
layer. This is legal under SPEC §5 but weakened the “four decisions” promise in
the onboarding copy (see §5.1).

### 3.2 Persistence checks

| Check | Result |
| --- | --- |
| Reload after day 1 summary | **Pass** — same map id, path, reward events, XP 140, gold 155, level 2, three relics, aims 2/4 and 2/3 |
| Close tab and reopen the URL after four day-1 nodes | **Pass** — same map id, path length 4, XP 45, gold 60; no regeneration |
| Data loss observed | **0** in these two checks |

The reload check was done before any dev-clock advance, as required by the
protocol.

### 3.3 Day 2 and day 3

Day 2 (dev advance, day 1 kept, day 2 opened):

- Layer 0: two tasks (light 10/10, medium 15/15).
- Layer 1: treasure (+15 gold and a loot roll) vs. a task.
- Layer 2: rest (+5 XP) vs. a task.
- Layer 3: elite (heavy, 40/40 and a loot roll).
- Boss: completed path around it, then **skipped**.

Day 2 summary: **+55 XP, +65 gold, 2 relics**, closing bonus **Forfeited**,
boss marked skipped. Craft reached 3/3; Wayfarer reached 3/4. The day summary
made the forfeited bonus explicit. No ambiguity in the numbers.

Day 3:

- Layer 0 offered three Wayfarer tasks. The light task was completed to reach
  Wayfarer 4/4; the remaining nodes and the boss were skipped.
- Wayfarer 4/4 and Craft 3/3 were both met by the end of day 3.

This satisfied the “three simulated days” rehearsal for one facilitator. It does
not satisfy the external 3-of-5 criterion.

### 3.4 Compressed week and run close

Days 4–6 were resolved by skipping every node, including the boss. Day 7 skipped
four nodes and completed the boss. The run then closed.

Run summary observed:

| Field | Value |
| --- | --- |
| Days | 7 of 7 played, 0 missed |
| Steps | 35 total: 11 kept, 24 skipped |
| Totals | +465 XP, +535 gold, 6 relics |
| Aims | Wayfarer 4/4, Craft 3/3; 2 of 2 kept |
| Per-aim bonus | +50 XP, +50 gold and 1 loot roll each |
| All-aims bonus | +100 XP, +100 gold and one guaranteed rare |
| Weekly bonus total | +200 XP, +245 gold (includes 45 gold from duplicates) |
| Guaranteed rare | Duplicated an owned relic, converted to gold; explained in the summary |
| Profile after close | Level 5, 465 XP, 535 gold, 6 relics |

The close read well: the summary made clear that the bonus was granted once, that
the totals were already in the profile, and that the guaranteed rare had become
gold. The “0 relics found at the close” with a locked “Not yet found” card was the
only jarring note; it looked like a missing reward even though the duplicate gold
was explained.

### 3.5 New run and reset

- **Begin a new run** showed the kept profile (level 5, 465 XP, 535 gold, 6
  relics) and the editable weekly targets. Confirming reset the run to day 1
  today, days 2–7 locked, and kept the profile exactly.
- The run label still read “Run I” after the new run. The save schema has no run
  counter, so this is a cosmetic follow-up, not a data bug.
- Reset with the exact `RESET` phrase returned to onboarding. The reset dialog
  kept the button disabled until the phrase matched.

### 3.6 Dev-clock reload hazard

After the new run, the facilitator advanced one day without opening day 1. The
domain correctly marked day 1 as `missed` and made day 2 available. Reloading
then reset the dev clock offset to zero (by design, it is not persisted), so the
run showed day 1 `missed` and day 2 `locked`, with the camp heading “The next day
is still sealed.”

This is **not a production persistence bug**: a real user's day advances by the
calendar, not by a volatile offset. It is a real facilitator hazard. The protocol
now requires persistence checks on real day 1 and forbids reloading between
simulated days. A dev-panel warning or a session-scoped offset would make the
rehearsal safer; both are follow-ups, not MVP-0 release blockers.

## 4. Metrics (facilitator only)

| Metric | Result | Interpretation |
| --- | --- | --- |
| `T_onboard_day1` | **53 s** | Mechanically far below 10 min; not a new-user measurement |
| Days closed in the 3-day block | **3 / 3** | One facilitator, not 3–5 testers |
| Path comprehension | Facilitator rubric 2 | Self-assessment; not independent |
| Reward comprehension | Facilitator rubric 2 | Self-assessment; not independent |
| Return intent | **Not measured** | No external tester; do not invent a score |
| Data loss after reload | **0** | One browser, one save |
| Data loss after tab close | **0** | One browser, one save |
| S1 friction | **0** | No blocker in the exercised flow |
| S2 friction | **4** (copy/legibility) | Fixed or documented below |
| S3 friction | **3** | Documented below |
| Release-blocking bugs | **0** | The release pass still re-runs the full matrix |

## 5. Frictions, ambiguities and decisions

### 5.1 “Four choices” overpromised the map — fixed

The welcome screen said “Each day draws a path of four choices and a boss.” In
the dry run, day 1 narrowed to a single available node in two later layers, and
other days also reached single-option layers. The player still has four layers
and a boss, but not always four real decisions.

**Decision:** change the bullet to “four layers and a boss.” This is accurate to
SPEC §5 and does not change the map. Commit `2d8c080`.

### 5.2 Singular rail copy contradicted itself — fixed

With one available node, the rail said “1 path reaches the gate; the trade-offs
differ.” There is no trade-off with one option. The same sentence appeared on
camp.

**Decision:** use “One path reaches the gate; this layer offers no trade-off.”
when there is a single option, and keep the plural sentence only for two or more.
Commit `2d8c080`.

### 5.3 Effort was hidden until the node was opened — fixed

The rail showed node type, XP, gold, loot and weekly progress, but not effort. To
understand why one task gave 20/20 and another 10/10, the facilitator had to open
each node. SPEC §5 requires visible trade-offs.

**Decision:** add the effort label to the rail's choice line, for example
`Task · Heavy effort · +20 XP · +20 gold · +1 weekly aim`. No values changed.
Commit `2d8c080`.

### 5.4 “Not yet found” after a closed week — fixed

When every weekly loot roll became a duplicate, the run summary showed a locked
card labelled “Not yet found” under “Relics found at the close.” At that point
the week is over; the label suggested a missing reward rather than a conversion.

**Decision:** use “No new relic this week” in the run-summary empty state. The
catalog's undiscovered slots keep “Not yet found” because they are genuinely
still undiscovered. Commit `2d8c080`.

### 5.5 Progress can exceed the weekly target — no change

Completing a Craft task after Craft was already 3/3 produced “Before 3 / 3 →
after 4 / 3 · target met” in the day summary. It is mathematically honest, and
the target-met label disambiguates it. The shared `AimRow` already caps the pips
at the target. Hiding the extra completion would make the day look like it
produced nothing.

**Decision:** leave the text as is. Record it as an accepted readability quirk;
if external testers consistently read “4 / 3” as a bug, clamp the displayed
count in a follow-up.

### 5.6 First layer often offers only tasks — no change in MVP-0

In all three opened days, layer 0 offered only task nodes. The choice was
therefore effort/reward, not “progress vs. immediate reward.” That is legal
(SPEC §5 requires at least one task per layer and allows 1–2 elites per map; it
does not require a non-task in layer 0), but it weakens the first impression of a
trade-off.

**Decision:** do not change the generator during the release. It would alter the
seeded maps and the tested invariants for a hypothesis-level issue. Follow-up:
consider guaranteeing one non-task option in layer 0, or explaining in the
onboarding that early layers may be all tasks, in the next content pass.

### 5.7 Dev clock offset is not persisted — protocol rule and follow-up

Described in §3.6. No production change. The protocol now keeps persistence
checks on real day 1. Follow-up: persist the offset in `sessionStorage` (still
never in the save/export) or show a warning before advancing an unfinished day.

### 5.8 Run label stays “Run I” after a new run — follow-up

The new run is a new run but the shell still labels it “Run I”. The schema has no
run count. This is cosmetic and outside the accepted data model; add a run
counter only if the product keeps a run history.

### 5.9 No shop for gold — expected, not a bug

The facilitator noticed that gold has no sink. SPEC §6 explicitly says gold is a
progress score and there is no shop in the POC. This is a known limitation for
the external debrief, not a defect.

## 6. What the SPEC §2 criteria can and cannot claim

| SPEC §2 criterion | Dry-run status | Why |
| --- | --- | --- |
| New user completes onboarding + day 1 in < 10 min | **Mechanically pass; not validated** | 53 s for a facilitator who knew the flow; no new user |
| Can explain chosen node, why, and what was earned | **Facilitator can; not validated** | Self-assessment, no independent tester |
| At least 3 of 5 complete 3 simulated days and would return | **Not validated** | One facilitator; no return-intent score |
| Zero data loss after reload or browser close | **Pass in this environment** | Two checks passed; external and more devices pending |
| Rewards feel causal, not random | **Facilitator assessment only** | Needs independent testers |
| Day/week close feels satisfying | **Facilitator assessment only** | Needs independent testers |
| Simple enough to use daily | **Not validated** | Requires real days, not a simulated hour |

The release can say the loop is mechanically complete and the copy survived a
facilitator pass. It cannot say the hypothesis is validated. The external round
is still the gate for that claim.

## 7. Follow-ups (not opened as remote issues)

These are listed here so the next milestone can pick them up. They are outside
the MVP-0 release commit.

1. Run 3–5 external sessions with the protocol and replace §4 with real metrics.
2. Persist the dev clock offset in `sessionStorage`, or warn before advancing an
   unfinished day, so the facilitator cannot strand a simulated run.
3. Consider guaranteeing a non-task option in layer 0 so the first choice shows a
   progress-vs-reward trade-off, not only effort.
4. Decide whether to clamp “4 / 3” progress in the day summary after external
   testers react to it.
5. Add a run counter if runs are ever listed or compared; today “Run I” repeats.
6. Revisit the absence of a gold sink only after MVP-0; it is intentionally out
   of scope now.
7. Test native install on a phone over HTTPS when a deployment exists; local
   `localhost` validates the manifest and service worker, not the phone install.

## 8. Verdict

- The session script is repeatable and covers onboarding, map choice, node
  resolution (complete and skip), day close, run close, new run and reset.
- The mechanics held: no data loss in the two persistence checks, no blocker, no
  release-blocking bug.
- Four copy/legibility issues were fixed in `2d8c080`; the rest are documented
  decisions or follow-ups.
- **The playtest hypothesis is not validated.** External testers are pending.
  The release should describe MVP-0 as a mechanically complete local demo with a
  facilitator dry run, not as a validated product loop.
