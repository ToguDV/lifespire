# LifeSpire mobile (Android)

> Status: first Android release candidate. Expo SDK 58, React Native 0.88,
> local-first with the same versioned `GameDocument` as web.
>
> Scope: full daily-loop and account parity, plus **local** notifications.
> Push notifications, an iOS release and an in-app admin panel are out of
> scope. See [`SPEC.md`](../SPEC.md).

## 1. Layout and shared code

```text
apps/mobile/
  App.tsx              fonts, splash, safe area, sync bootstrap
  app.config.ts        Expo config (scheme, Android package, plugins)
  metro.config.js      monorepo + `.js`→`.ts` fallback resolver
  src/
    AppShell.tsx       topbar, tabbar, view guards, toasts, deep links
    theme/             tokens mirrored from design/DESIGN.md, motion
    components/        RN design system (Button, Panel, Dialog, MapCanvas...)
    screens/           one screen per web view
    notifications/     prefs, pure planner, expo-notifications adapter
    platform/          SQLite KV storage and JSON file import/export
    sync/              native auth, SecureStore token, sync engine wiring
    state/             app store singleton and haptics feedback
packages/app-core/     store, persistence, sync factory, pure UI helpers
packages/core/         pure domain (unchanged, shared with web and API)
packages/api-client/   typed client (cookie web / native token mode)
```

Web keeps thin re-export shims (`apps/web/src/state/*`, `sync/*`, `ui/lib/*`)
so both apps execute the same store, sync engine and UI calculations. The
mobile shell only reimplements rendering and platform adapters.

## 2. Setup

Requirements: Node 24 (`.nvmrc`), pnpm 11, and Android Studio/SDK for a native
build. Expo Go is enough for UI work and local notifications; use a development
build (`pnpm --filter @lifespire/mobile android:native`) for release checks.

```bash
pnpm install --frozen-lockfile
EXPO_PUBLIC_SYNC_BASE_URL=https://sync.example.com pnpm dev:mobile
```

The sync URL is baked into `extra.syncBaseUrl` at bundle time and can be
overridden per device from **Settings → Sync → Server**. The override is stored
in the SQLite KV store; changing it signs the device out and rebuilds the API
client without a reload.

## 3. Persistence and compatibility

The app store hydrates **synchronously** from `expo-sqlite/kv-store`
(`getItemSync`/`setItemSync`), behind the same `DocumentStorageController`
contract used by web. Keys match the web scheme:

- `lifespire:mvp0` guest save, `lifespire:mvp0:u:<userId>` per account;
- `:backup`, `:meta`, `:base` companions for recovery, versions and auto-merge;
- `lifespire:mvp0:session` stores only id/email/role, never tokens;
- `lifespire:sync-base-url`, `lifespire:feedback-prefs`,
  `lifespire:notifications` are device-local preferences.

Export uses `serializeDocument` and the Android share sheet
(`lifespire-<date>.json`). Import uses the document picker, a 2 MB gate,
`readSaveFile` validation and the same preview dialog as web. The schema is
unchanged (`schemaVersion 3`), so a web export opens on Android and vice versa.

## 4. Native auth and sync

The web refresh token is an HttpOnly cookie. React Native cannot rely on a
persistent browser cookie jar, so native clients use an explicit grant:

- the API returns `refreshToken` only when the request carries
  `X-Client-Platform: android|ios` **and** has no browser `Origin` /
  `Sec-Fetch-Site` headers (see
  [`adr/0005-native-auth.md`](./adr/0005-native-auth.md));
- the app stores that token in `expo-secure-store` and sends it in the body of
  `POST /v1/auth/refresh`;
- rotation, reuse detection, device revocation and password-reset revocation
  are unchanged;
- the access token stays in memory; the session marker in SQLite only restores
  the account identity.

Sync uses the same engine: initial pull, debounced push, 60-second poll while
foreground, immediate pull when the app becomes active, and NetInfo to flip
between offline and online. The conservative 3-way merge and the keep-mine /
keep-cloud dialog are shared with web. Guest saves are adopted by a fresh
account exactly like on web.

## 5. Local notifications

Three optional reminders, stored per device (not in `GameDocument`, so they are
never synced):

| Reminder | Default | Rule |
|---|---|---|
| Today’s map is ready | 09:00 | The run is active and the day is available (or a future day). |
| Evening nudge | 20:00 | Today’s day is not completed or missed; future days get the “map ready” copy. |
| Week-end reminder | 20:00 | Last day of the run, when it is still unplayed. |

Implementation:

- `notifications/planner.ts` is pure and takes `{document, prefs, now,
  permission}`; it returns stable ids, trigger dates and
  `lifespire://map` deep-link data. Tested in `planner.test.ts`.
- `notifications/scheduler.ts` creates the `daily-path` Android channel,
  requests permission only when the user enables reminders (Android 13 needs
  the channel first), cancels app-owned notifications and reschedules them on
  document/pref changes and when the app returns to the foreground.
- The schedule is canceled when there is no active run, when the day is
  sealed, or when reminders are disabled.
- Tapping a notification opens the map; the response listener also handles a
  cold start. No push service, APNs, FCM token or server registration is used.
- Exact alarms are deliberately **not** requested. Android may deliver a
  reminder a few minutes late to protect battery.

Permission denied is non-blocking: Settings links to the system settings and
the rest of the app remains fully usable.

## 6. UI notes

- Tokens, palettes and type scale derive from the same web clamps in
  `design/DESIGN.md` and `apps/web/src/styles/tokens.css`, sampled at the
  320–480 px phone range: display 44/36/27, heading-lg 22.5, a 16 px horizontal
  gutter and 18/21 tabular numerals. Alegreya/Alegreya Sans are self-loaded
  through `@expo-google-fonts` (OFL), the eight used weights including italics.
- There are no extra semantic colours on mobile: currency and gems use
  `accentDeep`, destructive actions and warnings use stone (`surfaceSunken`,
  `hairlineStrong`, `inkStrong`). `gold` remains a wheel-sector label, not a
  palette token; `danger` is not a token.
- Onboarding keeps the web welcome copy and art: the copy comes first, followed
  by the stroke-only `welcome-art` plate (spire, halo, dotted path, four nodes,
  pines and crescent) and the lock privacy line. The wizard keeps the four
  steps, the review summary and the routine-based target suggestions. Editing a
  goal or routine inside the wizard opens a touch dialog instead of the web
  inline fieldsets; the domain draft and validation stay shared. The screen
  keeps a single Back in the footer, and the step chips are the compact
  adaptation of the web step list.
- The map mirrors the web state machine: the screen resolves the active day,
  prefers today's completed or missed day, and derives sealed/locked/hasMap/
  canOpen so the head chip, empty copy and Next step panel all speak the same
  state. Sealed, locked and unopened days render the empty map frame (frame
  meta, decorative contours, `EmptyState`, compass), never a generic panel.
- The map uses `react-native-svg` plus absolutely positioned `Pressable`
  nodes, reusing `packages/app-core/src/ui/mapLayout.ts`. Every normal node is a
  54×54 dp target centred on its coordinate, whatever the visible medallion
  (45/50; 40/44 on five-node layers). Labels cap at 78 dp (64 dp on layers of
  three or more nodes)
  and the boss label keeps 124 dp. Labels stay hidden at rest, including the
  current node: the first tap reveals the title, the second opens the node.
  Only available/current nodes reveal and open; the rest are `disabled`. The
  accessible name comes from `nodeAriaLabel` and the frame announces the group
  as “Camp at the bottom, N layers above, and the boss at the top.” The current
  node uses its ring as the only marker: the desktop-only HERE micro label is
  not rendered on Android. Selecting a node plays the select haptic; the boss
  opening plays `bossUnlock`.
- The rail is stacked, not docked: three panels (Next step, Weekly targets,
  Legend) follow the frame in the single screen scroll at every Android width.
  The old floating dock is retired. Next step holds the choice rows or the
  sealed/locked/veiled copy and the foot note; the empty map frame carries the
  contextual action (read the day/week, return to camp, open the path). Weekly
  targets uses `AimRow` with the goal crest and pips; the richer legend stays.
- The wheel shares the web spin physics (`packages/app-core/src/ui/wheel.ts`) and mirrors the
  canonical geometry in `components/wheelGeometry.ts`: 200×200 disc, ten 36°
  sectors, 16px icons at radius 62, a fixed 52px hub, a 6px hairline-strong
  ring, a 9.1s four-turn easeOutQuart `Animated` rotation, a throttled haptic
  tick every two sector crossings and a 1.8s reveal before the recap. The wheel
  sits after the node tags and before the facts so the primary action stays near
  the first viewport on a 390×844 screen; the recap mirrors the web
  `node-spread`. No sound is bundled: wheel feedback is haptic only, and the
  haptics toggle already gates it.
- Shared primitives mirror the published web CSS: `EmptyState` puts a 64 px
  accent medallion inside a 76 px wash ring and accepts an optional kicker;
  `StatStrip` is three equal cells split by hairlines (value first, label
  below); `LootCard` is a vertical 164 px card with a 52×62 niche and the
  Relics grid is two columns; `Toast`/`RewardToast` invert the palette (ink
  background, canvas text) and the plain toast adds a 44 dp Dismiss;
  `IconPicker` tiles are 54 dp with a visible label and a check badge.
- Day and run summaries are one framed card with 24 dp sections and hairline
  dividers, not a stack of panels: a 70 dp seal, the narrative header, one
  path list with 35 dp medallions, the three XP / Gold / Relics totals and the
  dashed level-up strip. The weekly close adds `StatStrip` bars (0..1
  `progress`), the per-goal bonus block plus the all-goals block, two-column
  `LootCard`s and the Reliquary link; the profile line reads `xpIntoLevel` /
  `xpToNextLevel`, never total XP as “XP”. The open run reuses the same card
  with its record strip and `Open the map`, and the new-run dialog keeps the
  retirement warning and surfaces a local error when `startNewRun` fails.
- Profile is titled **The Reliquary** (`Profile · The Reliquary` kicker) and
  never uses the player name as the title; the header chip shows owned relics
  against `collection.length`. The profile strip is one panel with the 62 dp
  level badge, name, `Wayfarer of the quiet path`, the experience bar and the
  Gold / Relics / Days kept totals. The collection lives outside that panel
  under `Found so far`: the shared `SegmentedControl` filters carry their
  found counts, a polite live region announces `Showing X relics · Y found`
  and the two-column `LootCard` grid uses the catalogue length for every
  total. Duplicate history uses a quiet gold chip and separates the “no run”
  and “no conversions yet” copies.
- Settings orders Sync, Appearance, Feedback, Data, Notifications, Local data
  and About so sync and the save are not buried; notifications stay after
  Data because they are Android-only. Theme options are Day, Night and
  System. Sync keeps the 12-character password guidance, field hints and
  success/error tones, and reset is a single `Local data` dialog with the
  typed confirmation.
- Recovery starts with the brand row and theme switch, a `Local save`
  `ScreenHead`, and one neutral panel holding the warning note,
  import/export/reset actions and the reset note. The second “Start over”
  panel is retired; export still uses the Android share sheet as “Export
  original save”.
- Data safety matches web. The import preview names the chosen JSON file on a
  valid save and warns that replacing overwrites the keys under
  `lifespire:mvp0`; a rejected file reports the reason without the name. A sync
  conflict shows both copies (profile, progress, run and saved time), lists up
  to five merge reasons and can share this device and the cloud copy as two
  separate `lifespire-this-device-<date>.json` / `lifespire-cloud-<date>.json`
  files. A local backup is written before keeping either side, and “Export
  both” also keeps the conflict open until the player decides.
- Navigation reuses the store's transient `view`/`history` (no router);
  Android's hardware back button maps to `back()` and is blocked on the wheel
  recap. Tabbar: Map, Camp, Goals, Relics; Settings lives in the topbar.
- The mobile topbar is the 56 dp shell header: 21 px spire mark plus wordmark on
  the left, gold (16 px coin), `Lv N`, the theme switch and Settings on the
  right. It does not show the day pips or `Day N of 7`; Home carries the week
  strip and Map carries the day in its kicker, while the other screens rely on
  the topbar-free context. The topbar uses a 14 px gutter and a hairline
  bottom border on the canvas background; the tab labels use the 10/13
  uppercase `tab` variant (0.6 tracking), active in `ink` and inactive in
  `inkSoft`. The theme switch and Settings are 44 dp targets, and the brand
  truncates before the fixed resource cluster on narrow screens.
- The splash screen has a night variant (`#131511`) next to the light canvas
  (`#F1F0EA`), and the root view repaints the Android system background with
  the resolved theme.
- Haptics follow the web feedback vocabulary through `expo-haptics`; the
  haptics toggle is the device feedback preference.
- Every screen uses safe areas, 48 dp touch targets, TalkBack labels/state and
  reduced-motion handling for the wheel, counters and seals.

## 7. Metro and the monorepo

Expo automatic monorepo detection handles workspaces. `packages/core` and
`packages/app-core` use TypeScript's `.js` import specifiers (needed by the CJS
API build and Vite). Metro does not rewrite those to `.ts`, so
`apps/mobile/metro.config.js` first runs the default resolver and only retries
a relative `.js` request without the extension when the default fails. Real
`.js` files in dependencies are never affected.

SDK 58 supports pnpm isolated dependencies; `pnpm why react-native` must show
one version. If a native module is duplicated, switch `nodeLinker: hoisted` in
`pnpm-workspace.yaml` and reinstall.

## 8. Tests and verification

```bash
pnpm --filter @lifespire/mobile typecheck
pnpm --filter @lifespire/mobile lint
pnpm --filter @lifespire/mobile test      # Jest + jest-expo
pnpm --filter @lifespire/mobile build     # Metro Android bundle
```

The shared web suite (238 tests) continues to exercise the extracted store,
sync engine and UI helpers. Mobile Jest covers the notification planner. The
CI quality job runs lint, typecheck, tests and build for every workspace,
including the Android JS bundle.

Manual Android checklist before a release:

1. Fresh install → demo onboarding → open day 1 → resolve a task, a wheel and
   the boss → read day and run summaries.
2. Force-stop during a day, reopen, confirm the map, path and rewards survive.
3. Export on web, import on Android; export on Android, import on web.
4. Sign in, play one day on Android and one on web, verify sync and the
   conflict dialog with airplane mode.
5. Enable notifications, grant permission, verify the test notification, set a
   near-future time and confirm tap-to-map. Disable and confirm cancellation.
6. Light/dark/system themes, 360 dp width, TalkBack and large font scale.

### 8.1 Development diagnostics

`apps/mobile/src/lib/devLogger.ts` installs one global development logger from
the app entry point. It is a no-op when `__DEV__` is false:

- unhandled JS errors are printed with their stack and forwarded to the
  previous React Native handler (so LogBox still works);
- `unhandledrejection` events are printed when the runtime exposes the event;
- `devError(scope, message, error?, context?)` and `devWarn(...)` prefix
  messages with `[LifeSpire][scope]`;
- context keys matching token/password/secret/authorization/cookie/document/save
  become `[redacted]`, and long strings are truncated. Saves and refresh
  tokens are never printed;
- best-effort catches (sync, auth restore, notifications, SecureStore, file
  export/import, haptics) now log once instead of failing silently. The UI
  still shows its normal toast/panel error.

Where to read the output:

```bash
# terminal running expo start: bundling + console output
pnpm dev:mobile

# React Native DevTools: press j in the Expo terminal
# or shake the device → Open React Native DevTools

# native crashes / modules before JS is up
adb logcat -s ReactNativeJS:V
adb logcat -b crash
```

The console output is a development aid only. Release builds do not print
these messages and never include the redacted context.

## 9. Internal builds (EAS)

```bash
cd apps/mobile
npx eas-cli build --platform android --profile preview   # installable APK
npx eas-cli build --platform android --profile production # AAB
```

The EAS project id and signing credentials are account-owned, so they are not
committed. `eas.json` keeps the internal APK and production AAB profiles. The
first build must be linked with `eas init` under the team account. Local
verification can use `pnpm --filter @lifespire/mobile android:native` with an
Android SDK and a connected device/emulator.

The release workflow builds the `preview` APK on EAS cloud; `EXPO_TOKEN` must be
a repository secret and the project must be linked once with `eas init` so
`extra.eas.projectId` is committed. `apps/mobile/package.json` is the version
source: `app.config.ts` reads it and derives `android.versionCode` as
`major × 1_000_000 + minor × 1_000 + patch`, so the code only grows across
releases. Bump that manifest together with the root and desktop ones before
tagging; the release workflow verifies all three.

## 10. Known follow-ups

- Physical-device verification and screenshots (this repository's CI has no
  Android emulator).
- iOS build and APNs grant verification (the code path exists but is untested).
- Push notifications, if a server-side reason appears; local reminders cover
  the product need today.
- **Remove the `expo-notifications` patch when upstream fixes it.** Expo Go 58
  does not register `ExpoTopicSubscriptionModule`, while
  `expo-notifications@58.1.6` imported it with `requireNativeModule` at module
  scope, so any import crashed the bundle with `Cannot find native module
  'ExpoTopicSubscriptionModule'` before the app rendered. The pnpm patch
  (`patches/expo-notifications@58.1.6.patch`, declared in
  `pnpm-workspace.yaml`) switches the source and build files to
  `requireOptionalNativeModule` and makes the topic helpers null-safe, keeping
  Expo Go bootable while development builds retain the native module. Track
  [expo/expo#52175](https://github.com/expo/expo/issues/52175) (fix
  [expo/expo#52182](https://github.com/expo/expo/pull/52182)); drop the patch and
  its `patchedDependencies` entry once a released `expo-notifications` uses
  `requireOptionalNativeModule`.
- Optional sound pack for feedback parity with web.
- API e2e flow for the native refresh grant (unit + client coverage exists
  today; the flow needs Postgres).

## 11. Troubleshooting

- **Cleartext HTTP blocked**: Android rejects plain HTTP outside localhost.
  Use HTTPS or a debug build with cleartext enabled for a LAN API.
- **No token after login**: the API only returns a native refresh token when
  the browser `Origin`/`Sec-Fetch-Site` headers are absent. Check the app is
  using the Shared/Expo fetch, not a browser WebView.
- **Notifications never fire**: confirm the channel exists, the permission is
  granted, reminders are enabled and the run has an unsealed day. The test
  notification bypasses the planner.
- **Metro cannot resolve `.js`**: use `--clear` once after changing the
  resolver; never add `.js` file copies to the TS packages.
- **Duplicate native module**: `pnpm why react-native`, remove stale
  `node_modules`, and use the hoisted linker if needed.
