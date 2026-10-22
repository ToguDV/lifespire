# MVP-0 playtest protocol — M4-01

Status: **protocol ready; external tester sessions pending**.
Owner: M4-01 (#22). Execution and findings: [`playtest-results.md`](./playtest-results.md).
Product source of truth: [`SPEC.md`](../SPEC.md) §2, §10 and §12.
Date: 2026-10-21.

This document is the repeatable script for a facilitated session. It exists so a
second facilitator can run the same session without improvising and so two
sessions can be compared. It is deliberately smaller than a research study: the
goal is a product decision, not statistical significance.

## 1. What the playtest is for

**Hypothesis (SPEC §2):** choosing a path with clear trade-offs and receiving
visible rewards for real actions makes a person more likely to follow through on
their routines and return the next day.

MVP-0 can validate four things:

1. A new person understands the map and can explain why they chose a path.
2. Rewards feel like a consequence of the action, not randomness.
3. Closing the day and the week feels satisfying.
4. The loop is simple enough to imagine using daily.

MVP-0 **cannot** validate real retention, habit change, or long-term motivation.
Those need several real weeks. A simulated week via the development panel is a
stand-in for convenience, not evidence of retention. Do not report simulated
days as real usage.

### Product decisions this session must support

| Decision | Evidence needed |
| --- | --- |
| Keep or change the onboarding copy | Time to day 1 + where testers hesitate |
| Keep or change the map trade-offs | Can testers explain effort, progress and reward before choosing? |
| Keep or change the day/run close | Can testers explain what they earned and whether the bonus was kept? |
| Keep or change the current node count | Do four to six nodes per day feel long, repetitive or trivial? |
| Whether the SPEC §12 defaults hold | Observed confusion about skips, missed days, elite progress or midnight |

## 2. Participants

### Target profile

Recruit **3–5 adults (18+)** who are plausible users of a habit or goal app:

- at least one person who already tracks routines (paper, app or spreadsheet);
- at least one person who has tried and abandoned a habit app;
- at least one person who plays games but does not use habit apps;
- at least one session on a phone-sized viewport, if the tester is comfortable;
- mix of desktop and mobile, but every session uses the same build.

Do not recruit project contributors, people who have seen this repository, or
people who helped design the map. They cannot act as new users.

### Recruitment

Use a short, neutral message. Do not describe the hypothesis or the expected
result. Suggested text:

> I am testing a small local web app that turns routines into a seven-day path.
> It takes about an hour, it is not a sales pitch, and I am testing the app, not
> you. You will use demo data, so you do not need to share real goals. Would you
> be willing to try it and think aloud?

Channels: personal network, a local community group, a university notice board or
a small Discord/WhatsApp group. Avoid recruiting several people from the same
team if they will compare notes.

No payment is required. If a small thank-you is offered (coffee, snack), it must
not depend on a positive review.

### Practical constraint

MVP-0 has no public deployment. Run sessions on a machine with the repository
(`pnpm dev`) or on the facilitator's laptop in person. A remote session needs a
trusted HTTPS tunnel or a local certificate; do not present a tunnel as a
production deployment. If a tester cannot run the build, use an in-person
session rather than asking them to install Node.

### Scheduling

Book **60–75 minutes**. The scripted flow usually takes 45–60 minutes; leave 15
minutes for consent, questions and notes. Do not run two testers at once.

## 3. Consent and privacy

Read this aloud before the session and record only the consent checkbox, not the
tester's identity.

### Consent script

> Thank you for helping. I am testing LifeSpire, a local web app. I did not make
> you, and I am not testing your ability. There are no right answers. Please say
> aloud what you are thinking, especially when something is confusing.
>
> The app stores its data only in this browser. For this session we will use demo
> data, so you do not need to enter real goals, health information or anything
> private. If you choose to create your own aims, use fictional examples. The app
> has no account, no analytics and no cloud sync.
>
> I will take anonymised notes (T1, T2, …). I will not record audio or video
> unless you explicitly agree. I will not publish your name, face, employer or
> real goals. You can stop at any time, skip any question, or ask me to delete
> your notes. Your participation is voluntary.
>
> Do you agree to take part, and do you agree to anonymised notes? Do you also
> agree to an audio recording? (Recording is optional.)

Record: `consent: yes/no`, `notes consent: yes/no`, `recording: yes/no`.

### Privacy rules

- Use the **demo profile** (`Wren`) for every timed section. The demo creates two
  aims and five routines; it contains no personal data.
- If the tester insists on custom data, ask them to use fictional aims and
  routines. Do not ask about health, medication, religion, politics, sexuality,
  income or employment.
- The facilitator does not open DevTools to inspect `localStorage` during the
  session. The UI is the only source of observation.
- Do not export a save that contains a tester's own content. If a demo export is
  needed to test import, use the demo profile only and delete the file afterwards.
- Raw notes use session codes (`T1`…`T5`), never names. Store raw notes locally,
  outside the repository, and delete them after the synthesis is committed.
- `playtest-results.md` contains aggregates and short anonymised quotes only. No
  quotes that could identify a person, employer or private goal.
- Reset the browser profile or clear the app's storage after the session. The
  app's Settings → Reset local data does this through the UI.

## 4. Materials and setup

### Build under test

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm dev --port 5180
```

Use one commit for all sessions. Record the commit hash in the session form. Do
not change code between testers; if a fix is needed, finish the current round,
document it, and start a new round with a new build hash.

### Before the tester arrives

- [ ] Fresh browser profile or clear `lifespire:mvp0`; the welcome screen is
      visible.
- [ ] Dev server running; no console errors in the browser console.
- [ ] Viewport set to the agreed device (desktop 1280×900 or phone 360×800).
- [ ] Stopwatch or phone timer ready; start it when the tester first interacts
      with the welcome screen.
- [ ] Printed or local copy of the notes form (§8).
- [ ] Consent text visible to the facilitator.
- [ ] The facilitator has read §6 and can run the dev panel without hunting for
      buttons.
- [ ] No notifications, no personal browser tabs, no other app windows.

The dev panel is a facilitator tool. Tell the tester: “This is a development
tool for simulating days. It is not part of the product and will not ship.”

## 5. Session script

Times are guidance, not a hard stop. Mark the actual time at each checkpoint.

### 0–5 min — Welcome and consent

- Read the consent script. Answer questions without explaining the map.
- Ask the tester to think aloud. Explain that silence is fine.
- Start the timer when the tester first interacts with the welcome screen.

### 5–15 min — Onboarding with demo data

Ask the tester to read the welcome screen and start with demo data.

- Do not point at the button. If they ask where to start, answer: “Where would
  you start?”
- Let them type a name or leave it blank.
- Observe: do they read the three bullet points? Do they hesitate at “demo” vs
  “create my own”? Do they understand that data stays local?
- Click **Begin with demo data** (or let them click) and continue to camp.

**Checkpoint A:** record `T_onboard_day1` from the first interaction to the day 1
summary. The target is under 10 minutes. The facilitator may answer only
navigation questions (“what does this button do?”) in the first 10 minutes; do
not explain the trade-offs.

### 15–30 min — Day 1: map, choose, resolve, close

1. Open today's path.
2. Ask the tester to describe the map before choosing:
   - “What do you think this screen is asking you to do?”
   - “What do these node types mean?”
   - “Which step are you choosing, and why?”
3. Let them open a node. Before they press **Mark complete**, ask:
   - “What do you expect to get from this step?”
   - “What would you give up by choosing it instead of the other option?”
4. Let them complete it. After the toast, ask:
   - “What did you just earn?”
   - “Why do you think you got that amount?”
5. Continue to the next layer. Ask them to choose again. Let them **skip** one
   node at some point and explain what happened.
6. Reach the boss. Ask whether they expect a closing bonus; let them complete or
   skip it. Use **complete** for the first session and **skip** for at least one
   other session so both paths are observed.
7. Read the day summary together. Ask:
   - “What did you earn today?”
   - “What changed in your weekly aims?”
   - “Was the closing bonus clear? What happened to it?”

**Persistence check A (on day 1, before any dev clock change):** ask the tester
to reload the page. Confirm that the map, path, rewards, XP, gold and aim
progress are still there. Then close the tab, reopen the same URL, and confirm
again. This is the only safe point for the close/reopen check because the dev
clock offset is not persisted (see §9).

### 30–45 min — Day 2 with the dev panel

- Open the dev panel and advance one day in front of the tester. Say that this
  simulates midnight.
- Confirm with the tester that day 1 is no longer playable and day 2 is open.
- Open day 2. Ask them to pick a path. If a rest, treasure or elite is available,
  ask them to compare it with a task:
  - “Which is better for your week? Which is better right now?”
  - “What does the app say you will get?”
- Resolve one node as **complete** and one as **skip**. Reach the boss; complete
  or skip it (opposite of day 1 if possible).
- Read the day summary. Ask:
  - “What is different from yesterday?”
  - “What does the bonus line mean this time?”

### 45–55 min — Day 3 and return intent

- Advance one day, open the path and resolve enough nodes to close the day.
  Complete at least one task; skipping the rest is acceptable for time.
- Before the closing summary, ask:
  - “Would you come back tomorrow to do this again? Why or why not?”
  - “What would make you come back? What would make you stop?”
- Read the summary. Ask them to explain the weekly aim progress without help.

**Checkpoint B:** count completed simulated days (the target is three). Record
return intent on a 1–5 scale and the verbatim reason.

### 55–70 min — Close the week and read the run summary

Use the dev panel one day at a time. For each remaining day, open the path and
resolve it (complete at least the boss, skip the rest if time is short). Do not
reload between dev advances.

When the run closes:

- Ask the tester to read the run summary and explain:
  - “Which aims were kept?”
  - “What was the weekly bonus? Why?”
  - “What did the guaranteed rare mean here?”
  - “Did the close feel earned, or like a slot machine?”
- Ask whether they would start another run and what they would change.
- Optional: start a new run and confirm that the profile, level, gold and
  collection remain.

### 70–75 min — Debrief and cleanup

- Ask the three open questions:
  1. “What was the most confusing moment?”
  2. “What did you expect the app to do that it did not do?”
  3. “If you could change one thing, what would it be?”
- Complete the notes form immediately, while memory is fresh.
- Thank the tester. Clear the local save through Settings → Reset local data.
- Do not discuss other testers' results with this tester.

## 6. Observation prompts

Use neutral prompts. Do not teach the model or supply the answer.

### Path and trade-offs

- “What do you think each option gives you?”
- “Why did you choose this node?”
- “What did you give up by not choosing the other one?”
- “Is this a real choice, or does one option always win?”
- “What does ‘weekly aim’ mean to you here?”

### Rewards

- “What did you just earn?”
- “Why did this step give that amount?”
- “Did the reward feel connected to what you did, or random?”
- “What is the difference between XP, gold and a relic?”
- “What would you spend gold on?” (Listen for the absence of a shop; that is
  expected in MVP-0.)

### Day and run close

- “What does the closing bonus mean?”
- “What happened because you skipped the boss?”
- “What would you expect to see after seven days?”
- “Did the weekly bonus feel worth the week?”
- “Was anything shown twice, or missing?”

### Return intent

- “Would you come back tomorrow? Why?”
- “Would you still use it in a week? In a month?”
- “What would make you stop?”
- “Who would you recommend it to, if anyone?”

### Friction and trust

- “What was the most confusing moment?”
- “Did you ever worry that your progress was lost?”
- “Did you trust the app to keep your data? Why?”
- “Was any text misleading?”

## 7. Metrics and rubrics

Record raw observations first; score afterwards. Use the session code, not a
name.

| Metric | How to measure | Target / interpretation |
| --- | --- | --- |
| `T_onboard_day1` | Stopwatch from first interaction to day 1 summary | **< 10 min** for a new user |
| `days_3` | Did the tester close day 1, 2 and 3? | **≥ 3 of 5** testers |
| Path comprehension | 0–2 rubric below, unprompted | **5 of 5 at 2**, or documented gap |
| Reward comprehension | 0–2 rubric below, unprompted | **5 of 5 at 2**, or documented gap |
| Return intent | 1–5 + verbatim reason | **≥ 3 of 5 at 4–5** |
| Data loss | Reload + tab close on day 1 | **0 cases** |
| Friction | Count by severity | No S1; S2 documented with a decision |
| Bugs | Reproducible steps + expected/actual | No release-blocking bug |

### Path comprehension rubric

- **0 — Cannot explain:** names a node but cannot say why, or describes the map
  as decorative.
- **1 — Partial:** names the chosen node and one reward, but cannot explain the
  trade-off or the alternative.
- **2 — Clear:** names the chosen node, the alternative, what was gained and what
  was given up, in their own words.

### Reward comprehension rubric

- **0 — Random:** describes rewards as arbitrary or cannot connect them to the
  action.
- **1 — Partial:** knows XP/gold/progress increased but cannot say why the amount
  differed or what the weekly aim does.
- **2 — Causal:** connects effort/type to the amount; distinguishes XP, gold,
  loot and weekly progress; knows the boss bonus is separate and conditional.

### Return-intent scale

1. Definitely would not return.
2. Probably would not.
3. Unsure.
4. Probably would.
5. Definitely would.

Always record the reason. A “5” with no reason is weaker evidence than a “4”
with a concrete reason.

### Friction severity

- **S1 — Blocker:** the tester cannot continue, loses data, or reaches a wrong
  state.
- **S2 — Major:** the tester completes the task but misunderstands a core rule
  (path, reward, bonus, skip).
- **S3 — Minor:** cosmetic, wording or layout issue that does not change the
  decision.

## 8. Notes template

Copy this block per session into a local notes file. Do not commit raw notes.

```text
Session: T_
Date/time:
Facilitator:
Build commit:
Device / browser / viewport:
Consent: yes/no   Notes: yes/no   Recording: yes/no
Started from: fresh storage / existing save

T_onboard_day1: __ min __ s
Day 1: choices seen: __ | completed: __ | skipped: __ | boss: complete/skip
Day 2: choices seen: __ | completed: __ | skipped: __ | boss: complete/skip
Day 3: choices seen: __ | completed: __ | skipped: __ | boss: complete/skip
Days closed: __ / 3
Path comprehension: 0 / 1 / 2
Reward comprehension: 0 / 1 / 2
Return intent: 1 / 2 / 3 / 4 / 5
Would return tomorrow: yes / no / unsure — why:
Data loss after reload: yes/no
Data loss after tab close: yes/no

Quotes (anonymised, max 2–3):
- “...”

Friction log:
- time | screen | severity S1/S2/S3 | what happened | quote

Bugs:
- steps | expected | actual | screenshot reference

Facilitator notes:
- what needed prompting
- what the tester ignored
- what felt good
```

## 9. Success and failure criteria

### Green — MVP-0 hypothesis supported for this round

- At least 3 of 5 testers close three simulated days.
- At least 3 of 5 give return intent 4–5 with a concrete reason.
- Every tester can explain their path and reward at rubric level 2 without
  prompting (or the single gap is documented and understood).
- Zero data loss after reload and tab close.
- No S1 friction and no release-blocking bug.

### Amber — direction plausible, fix before the next round

- 3 of 5 close three days, but one or two testers cannot explain a core rule.
- Return intent is mixed (3 of 5 at 3 or below) but the reasons point to copy or
  onboarding rather than the loop.
- An S2 friction appears in two or more sessions.
- Action: make a small copy/onboarding/legibility change within SPEC, re-run the
  acceptance checklist, and test the change with at least one new person.

### Red — do not treat MVP-0 as validated

- Fewer than 3 testers close three days.
- Any reproducible data loss.
- Testers consistently describe rewards as random or the map as decorative.
- An S1 blocker prevents the loop.
- Action: fix the blocker, document the decision, and run a new round. Do not
  tag the release as validated on the basis of the failed round.

### Decision rules

- Change node count or reward values only if the same friction appears in at
  least two sessions and has a concrete behavioural cost. Preference alone is not
  enough.
- Prefer copy and onboarding changes before domain changes.
- Any change to the SPEC defaults in §12 needs a written rationale in
  `playtest-results.md` and a re-check of the acceptance matrix.
- No new dependency, backend, account, analytics or visual direction is allowed
  as a playtest fix.

## 10. Internal dry run (facilitator)

The protocol must be dry-run before external sessions. This is a rehearsal, not
evidence about users.

### Checklist

- [ ] Fresh storage; welcome screen visible.
- [ ] Run the timed onboarding + day 1 block exactly as written.
- [ ] Complete one node, skip one node, complete the boss; read the summary.
- [ ] Reload on day 1 and confirm persistence.
- [ ] Close the tab, reopen, confirm persistence.
- [ ] Advance with the dev panel; confirm day 1 locks and day 2 opens.
- [ ] Complete day 2, skipping the boss; confirm no closing bonus.
- [ ] Complete day 3 and close the day.
- [ ] Advance through day 7, resolving each day; confirm the run summary.
- [ ] Start a new run; confirm profile, XP, gold and collection survive.
- [ ] Reset local data with the exact `RESET` phrase.
- [ ] Record actual times, friction and any ambiguity in
      `playtest-results.md`.

### Commands

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm dev --port 5180
# open http://localhost:5180 in a clean browser profile
```

For the production/PWA pass:

```bash
pnpm build
pnpm preview --port 4173
# open http://localhost:4173, reload once, then test offline
```

### Known dev-tool limitation

The development clock offset is intentionally **not persisted**. If the
facilitator reloads after advancing a simulated day, the clock returns to the
real date. Days that were already advanced can be marked missed, and the run can
show “The next day is still sealed.” This is a development-only limitation, not
a production persistence bug.

Protocol rule: do the reload and tab-close checks on **real day 1**, before
advancing the dev clock. Do not reload between simulated days. If it happens,
record it as a facilitator error and restart the demo run rather than interpreting
the stuck state as a product failure.

## 11. What this round will not prove

- Real retention over days or weeks.
- Long-term habit change.
- That the rewards are motivating outside a one-hour session.
- That a phone install works on a public origin; installation needs HTTPS and is
  outside MVP-0.
- Statistical significance. Three to five people can reveal comprehension and
  friction, not population-level preference.

These limits belong in the results document and in the release notes.
