# MVP-0 acceptance — M3-07

> Historical record: this acceptance pass describes the original four-layer map
> (1–3 goals always produced four decision layers). The current generator makes
> depth follow the active goals (3–5 layers); see [`SPEC.md`](../SPEC.md) §5.

QA pass over the complete MVP-0 flow on branch `mvp-0`, against
[`SPEC.md`](../SPEC.md) §10 and issue #21. Date: 2026-10-21.

Environment: Chromium via Playwright, Linux. Production build served with
`pnpm preview --port 4173`; development build served with
`pnpm dev --port 5180`. Viewports: 360×800, 768×900, 1280×900, plus a 320×700
spot check. Screenshots and console logs referenced below live in
`.playwright-mcp/`, which is intentionally git-ignored; they are local evidence,
not committed artifacts.

## Acceptance matrix

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Open from scratch, complete demo onboarding, start a run | **Pass** | Fresh storage → onboarding. "Begin with demo data" created profile `Wren`, two aims, five routines, run with day 1 `in_progress`, map drawn and persisted atomically. Screenshots `01-onboarding-desktop.png`, `11-onboarding-dev.png`; `beginJourney` covered by `content/onboarding.test.ts` and `state/store.test.ts`. |
| 2 | Map: 4 layers + boss, 2–3 nodes/layer, ≥2 paths, all reachable | **Pass** | Inspected the persisted map and DOM for the demo run: layers `[2,2,2,2]`, boss, 9 nodes, 8 start→boss paths, every node reachable from the start and able to reach the boss, one task per layer, 2 elites, boss with no outgoing connection. Screenshot `02-map-desktop.png`; generator invariants in `domain/generator.test.ts` (including 1,000-map sweeps). |
| 3 | Complete a task and see XP, gold and weekly progress | **Pass** | "Climb the old stair" (heavy task) → profile XP 0→20, gold 0→20, objective 0→1, path length 1, reward event 20/20/+1. Toast: "Step kept · +20 XP · +20 gold · +1 weekly aim". Screenshot `04-after-task-complete.png`; `domain/lifecycle.test.ts`. |
| 4 | Reload preserves map, path and rewards | **Pass** | Reload after the completion kept the same `map.id`, path entry, reward event, XP and gold; no regeneration. `lifecycle.test.ts` also covers reload between resolutions. |
| 5 | Skip advances without a reward | **Pass** | Skipped a task: path advanced to 2, reward event recorded with `xp:0, gold:0, progress:0, action:'skip'`; profile and objectives unchanged. Toast: "Step skipped · no XP, gold, loot or weekly progress." `lifecycle.test.ts`. |
| 6 | Complete boss → day summary with bonus; another day skip boss → no bonus | **Pass** | Day 1 completed through the boss: summary +135 XP/+135 gold, `closingBonusXp:20`, `closingBonusGold:20`, `bossCompleted:true` (`06-day1-summary-desktop.png`). Day 2 completed four nodes and skipped the boss: `closingBonusXp:0`, `closingBonusGold:0`, `bossCompleted:false`, summary 20/20 (`15-day2-boss-skipped-summary.png`). `lifecycle.test.ts`, `daySummary.test.ts`. |
| 7 | Advance a day with the dev panel; previous day unavailable and a new map appears | **Pass** | Day 1 completed before advancing. After "Advance one day": day 1 stayed `completed`, day 2 became `available` (days 3–7 `locked`); opening day 2 generated `…:map:1` with an empty path, distinct from `…:map:0`. A day left unresolved is reconciled as `missed`, never replayed. Screenshots `13-after-dev-advance.png`, `14-day2-new-map.png`; `lifecycle.test.ts` midnight/absence cases. |
| 8 | Seven simulated days → run summary with objectives, bonus and loot | **Pass** | 7 completed days: run `closed`, summary persisted. Totals +995 XP, +1100 gold, 9 relics, 31 steps kept, 4 skipped, 7 days played, 0 missed. Objectives Wayfarer 4/4 and Craft 3/3; weekly bonus +200 XP/+200 gold; three new relics (Ink-Stained Ribbon, Moonlit Atlas, Feather of the High Pass). Screenshots `16-day7-summary.png`, `17-run-summary.png`; `runClose.test.ts`. |
| 9 | New run keeps profile, XP, gold and collection | **Pass** | New run kept the same profile id, name, XP 995, gold 1100, level 10, 9 relics and `createdAt`; changed run id/seed, reset objectives and totals, removed maps, day 1 `available`, days 2–7 `locked`. Screenshots `18-new-run-dialog.png`, `19-new-run-camp.png`; `runClose.test.ts`, `newRun.test.ts`. |
| 10 | 360 px and desktop; PWA install and offline reload | **Pass with accepted limitation** | No horizontal scroll at 360, 768 or 1280; 320 spot check also clean. Map nodes are 54×54; tab bar does not cover the bottom action after scrolling. Manifest, 192/512/maskable icons, active service worker and offline reload verified on the production build (screenshots `20-map-360.png`, `21-map-768.png`, `21-map-1280.png`, `44-offline-new-build.png`). Native install prompt/phone installation is not verifiable in this headless environment — accepted limitation below. |
| 11 | Export and import restore the state | **Pass** | Export produced `lifespire-2026-10-21.json`, schema v1, 17,060 bytes, payload identical to `localStorage`, with no dev clock/transient keys. Reset → onboarding → import showed the preview (profile, level, gold, run/day, relics, schema) and restored the exact profile, run, path and collection. Screenshots `08-reset-dialog.png`, `09-import-preview.png`, `10-import-restored.png`; invalid and future-version files were rejected without touching the save (`43-import-future-error.png`); `ui/lib/importSave.test.ts`, `state/persistence.test.ts`. |
| 12 | Generation, rewards and weekly-close tests are green | **Pass** | `pnpm test`: 24 files, 285 tests passed, including `generator.test.ts` (20), `rewards.test.ts` (35), `runClose.test.ts` (15), `lifecycle.test.ts` (38) and `schema.test.ts` (15). |

## Responsive sweep

- **360×800**: onboarding, custom onboarding wizard, camp, map, node detail,
  day summary, aims, reliquary and settings have no document-level horizontal
  overflow (`scrollWidth === innerWidth`). Map rail stacks below the map; map
  node labels stay inside the frame. The fixed tab bar leaves the final
  interactive element above it after scrolling to the bottom.
- **768×900**: single-column shell with tab bar; map, day summary and settings
  fit the viewport width; no horizontal overflow. Tab bar remains clear of
  actions.
- **1280×900**: sidebar layout with map rail; no horizontal overflow; map
  renders at 484 px and the rail stays visible.
- **320×700** spot check: no horizontal overflow. The top bar's `Lv N`
  resource wraps onto two lines at this width; 320 px is outside the required
  360 px target and is recorded as a cosmetic follow-up.
- Touch targets: map nodes 54×54, primary buttons ≥44, small buttons 44, icon
  buttons 44, tab items 63, inputs 44, segmented controls 44. Inline text links
  keep a 44 px-tall hit area; their width follows the label.

## Keyboard and accessibility

- Skip link is present, off-screen until focused, and `#main-content` is a
  focusable main landmark. View changes move focus to `main` with
  `preventScroll`.
- Focus is visible: the global `:focus-visible` ring computes to a 2 px accent
  outline. Keyboard `Tab` reached an available map node and `Enter` selected
  it and opened node detail. Locked nodes are disabled and skipped in the tab
  order; their `aria-label` states the type and "locked".
- Dialogs: opening "Add an aim" moved focus into the dialog, `Tab` from the
  last control wrapped to the close button, `Esc` closed it, and focus
  returned to the "Add aim" trigger. The import and reset dialogs share the
  same implementation.
- Form fields have associated labels; validation errors are `role="alert"`
  summaries plus `aria-invalid` and `aria-describedby` on the affected fields
  (verified in onboarding and the aim dialog).
- Non-colour signals: node status uses shape/icon/disabled state and an
  `aria-label`; day and weekly pips are paired with numeric text; progress bars
  expose `role="progressbar"` with `aria-valuemin/max/now`; destructive actions
  use the danger style plus explicit text ("Reset local data", "Archive",
  "Reset everything") and a typed confirmation for reset.
- Contrast: sampled visible text on settings and map in both light and dark
  themes; no sample fell below WCAG AA 4.5:1 (large text threshold not needed
  for any failing sample). Screenshot `31-settings-360-dark.png`.
- Reduced motion: with `prefers-reduced-motion: reduce`, the toast animation
  and transition computed to `1e-06s`; the global token rule disables all
  non-essential motion.
- Console: zero errors and zero warnings in the production build and in the
  exercised development flows.

## Persistence, recovery and duplicate safety

- Reload during the run kept map/path/rewards; reload after onboarding kept the
  draft step and data.
- Double-clicking "Mark complete" resolved the node once: path and reward
  arrays grew by one and XP/gold were credited once. The existing
  `lifecycle.test.ts` case "rejects a second resolution without duplicating
  rewards" covers the domain guard. A follow-up cosmetic issue is noted below
  because the second click can land on the next map node after navigation.
- Corrupt storage (`{not valid json`) opened the recovery screen, kept the raw
  value untouched and offered a controlled reset (`32-corrupt-recovery.png`).
- A future schema (`schemaVersion: 2`) opened the "newer LifeSpire" recovery
  screen and did not overwrite the raw value (`33-future-version-recovery.png`).
- Confirming recovery reset returned to onboarding and wrote a valid empty
  document (`34-recovery-reset-dialog.png`).
- Reset from Settings requires typing `RESET`; cancel leaves the save intact.

## PWA and production build

- `manifest.webmanifest`: name, short name, description, `lang`, theme/background
  colours, `display: standalone`, scope/start URL, 192/512 and maskable icons.
- All icon URLs and `sw.js` returned 200. Service worker registered and
  activated at `/`; production has no `Dev` trigger and no dev panel text.
- Offline reload on the rebuilt production bundle loaded the app shell and the
  persisted profile/run (`44-offline-new-build.png`).
- Service worker update is `autoUpdate`; dev options are disabled, and the
  exported document contains no dev clock or transient state.

## Bugs found and fixed

1. **View changes did not reset the scroll position.** `App.tsx` kept a
   `viewportRef` that was never attached to the scrolling element, so switching
   tabs kept the previous `scrollTop` (for example 769 px on Aims). The focus
   move to `main` still happened, leaving keyboard users mid-page. Fixed by
   resetting `mainRef.current.scrollTop` when the view key changes; manually
   re-verified that Map → Camp now lands at scroll 0.
2. **Small controls below the 44 px touch target.** The port already raised
   icon buttons and small buttons to 44 px, but `.input` was 42 px, segmented
   buttons were 30 px and the topbar brand button was 21 px tall. Fixed in
   `src/styles/ui.css` (44 px inputs/segments, 44 px brand button). Visual
   direction is unchanged; verified on 360 px and 768 px.

No automated DOM test was added for these two UI fixes because the current
Vitest suite runs in a Node environment without a DOM renderer; the changes were
verified in the browser and the existing 285-test suite remains green.

## Accepted limitations and follow-ups

- **Native PWA installation and phone testing.** The manifest, icons, service
  worker and offline reload were verified on `localhost`; the browser install
  prompt and installation on a physical phone (HTTPS requirement) were not
  exercised in this headless pass.
- **Human playtest.** SPEC §2's 3-of-5 tester validation and the "under 10
  minutes" observation require people; this QA pass covers the manual flow and
  automated evidence only. M4 remains the playtest milestone.
- **Export file save dialog.** Playwright's download capture closed the page in
  this harness. The export button was exercised with `URL.createObjectURL`
  stubbed to capture the generated Blob; its contents, filename and schema were
  verified byte-for-byte against storage. The resulting payload was imported
  back through the real UI.
- **Cosmetic, non-blocking follow-ups:** at 320 px the topbar level resource
  wraps to two lines; "Recent finds" titles ellipsize at 360 px; after a
  double-click that resolves a node, the second click can select a node under
  the pointer on the next screen (rewards are not duplicated); the import
  preview describes the next locked day as "Active · day N"; the dev clock
  offset is not persisted, so starting a run under a future dev date and
  reloading makes its days locked (development-only); the dev trigger is hidden
  on the welcome screen at desktop widths.

## Gates

Run after the fixes on `mvp-0`:

```text
pnpm lint       ✓ oxlint
pnpm typecheck  ✓ tsc -b
pnpm test       ✓ 24 files, 285 tests
pnpm build      ✓ Vite production build + PWA service worker
```
