# LifeSpire mobile (Android)

> Status: first Android release candidate. Expo SDK 58, React Native 0.88,
> local-first with the same versioned `GameDocument` as web.
>
> Scope: full daily-loop parity, the local LAN sync node and **local**
> notifications. Push notifications, an iOS release and any cloud/account
> feature are out of scope. See [`SPEC.md`](../SPEC.md) and
> [`adr/0007-local-lan-sync.md`](./adr/0007-local-lan-sync.md).

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
    sync/              LAN transport adapter and local-engine setup
    state/             app store singleton and haptics feedback
  modules/lifespire-lan/
    android/           Kotlin Expo module: UDP, HTTPS, pinning, identity, peers, inbox
    index.ts           requireNativeModule + event emitter
packages/app-core/     store, persistence, LAN engine/protocol, pure UI helpers
packages/core/         pure domain (unchanged, shared with web and desktop)
```

Web keeps thin re-export shims (`apps/web/src/state/*`, `sync/*`, `ui/lib/*`)
so both apps execute the same store, sync engine and UI calculations. The
mobile shell only reimplements rendering and platform adapters.

## 2. Setup

Requirements: Node 24 (`.nvmrc`), pnpm 11, and Android Studio/SDK for a native
build. Expo Go is enough for UI work and local notifications, but **it does not
include the LAN Kotlin module**: use a development build
(`pnpm --filter @lifespire/mobile android:native`) or EAS for pairing, discovery
and sync.

```bash
pnpm install --frozen-lockfile
pnpm dev:mobile
```

There is no server URL to configure. The app starts the LAN node only when the
platform build includes it; Settings → Nearby devices shows the device, QR,
paired peers and the Nearby sync switch.

## 3. Persistence and compatibility

The app store hydrates **synchronously** from `expo-sqlite/kv-store`
(`getItemSync`/`setItemSync`), behind the same `DocumentStorageController`
contract used by web. Keys match the web scheme:

- `lifespire:mvp0` is the single canonical save (a legacy account save is
  promoted into it on first launch; the old keys stay as backups);
- `lifespire:mvp0:backup` and `:local-sync-migrated` for recovery and the
  one-time promotion marker;
- `lifespire:peer:<id>:base|meta` hold the per-peer merge base (outside
  `GameDocument`);
- `lifespire:device-name`, `lifespire:discoverable`,
  `lifespire:feedback-prefs`, `lifespire:notifications` are device-local
  preferences; peer tokens and the certificate password live in the Kotlin
  vault, never in SQLite KV.

Export uses `serializeDocument` and the Android share sheet
(`lifespire-<date>.json`). Import uses the document picker, a 2 MB gate,
`readSaveFile` validation and the same preview dialog as web. The schema is
unchanged (`schemaVersion 3`), so a web export opens on Android and vice versa.

## 4. Local LAN sync

The Android app is a peer, not a client of a server. The node lives in
`modules/lifespire-lan/` (Kotlin):

- **Identity:** an RSA key pair and a self-signed X.509 certificate generated
  with OkHttp `HeldCertificate`; the PKCS#12 and its password live in
  app-private storage/`EncryptedSharedPreferences`. The fingerprint is the
  SHA-256 of the certificate DER (base64url). A reinstall changes it, so peers
  must re-pair.
- **Discovery:** UDP on `47823`, broadcast plus multicast fallback, with a
  `WifiManager.MulticastLock`. The node probes on start, announces every 10 s
  and expires peers after 30 s. It runs only while the app is in the foreground;
  `AppState` pauses the node on background and `src/sync/setup.ts` resumes it.
- **Transport:** `LanServer` is a NanoHTTPD HTTPS server with the self-signed
  certificate; `PinnedClient` uses OkHttp with a custom trust manager that
  checks the expected fingerprint before the request is sent. Peers exchange a
  per-direction 32-byte bearer token; tokens and private keys never cross into
  JavaScript.
- **Pairing:** the host shows a QR (payload with device id, fingerprint, host,
  port, one-time secret and expiry) and an 8-character code. The joining app
  scans with `expo-camera` or enters the code; the host validates the secret in
  `POST /v1/pair`, stores the client token/fingerprint and returns its own.
  The QR path is the MITM-resistant one; the code is a documented fallback.
- **Documents:** the JS layer owns the `GameDocument`. It sends a mirror
  (`documentJson` + checksum) to the node; incoming documents are written to a
  durable inbox before the server answers `202`, then validated with
  `parseDocument`, applied and acked. A crash between both steps re-delivers on
  the next start.
- **Engine:** `packages/app-core/src/sync/localEngine.ts` coordinates discovery,
  pairing, the per-peer `peerEngine` (pull/push, CAS, `tryAutoMerge`, conflict)
  and the shared keep-mine/keep-peer dialog. Auto-sync is ON after pairing and
  can be disabled per device; the global Nearby sync switch stops advertising
  and syncing.
- **Constraints:** no background service, no remote wipe, and no cloud backup.
  Both apps must be open on the same Wi-Fi; guest Wi-Fi/AP isolation, VPNs and
  firewalls can block discovery, so the manual link/code pairing is the
  fallback. A reset/import is a document change and propagates; the reset dialog
  offers "reset this device only" by forgetting paired devices first.

### 4.1 Compatibility

The Android app keeps reading the same `GameDocument` and export/import format
as web and desktop. On first launch after the server removal,
`migrateLegacySave` promotes the active legacy account save to `lifespire:mvp0`
and keeps the old keys as backups. There is no account, password, invite or
server URL to configure.

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
- Home is one hero: kicker, one phase chip, `h1`, one state line and one
  primary CTA. The seven-day strip and the weekly-goal rows sit in their own
  panels; the traveller/stat panel, generic week note and duplicate phase chip
  are retired, while the dynamic missed-days warning stays. The CTA and copy
  follow the web state table, including the goals-not-ready branch.
- Onboarding keeps the web welcome copy and art: the copy comes first, followed
  by the stroke-only `welcome-art` plate (spire, halo, dotted path, four nodes,
  pines and crescent) and the lock privacy line. The welcome no longer asks for
  a name, lists mechanic bullets or explains the demo size; the demo uses
  `Wayfarer` and the custom flow asks for an optional name in step 1. The
  wizard keeps the four steps, visual stepper, review summary and trial-based
  target suggestions, but the kicker is just `Create your path`, the step
  bodies are one line, and the review/map explanation hints are gone. Editing a
  goal or trial inside the wizard opens a touch dialog instead of the web
  inline fieldsets; the domain draft and validation stay shared. There is no
  account row: the local profile is the only identity.
- The map mirrors the web state machine: the screen resolves the active day,
  prefers today's completed or missed day, and derives sealed/locked/hasMap/
  canOpen so the head title, line and chip all speak the same state. Sealed,
  locked and unopened days render the empty map frame (day meta, decorative
  contours, medallion, compass) with the single contextual action; the frame no
  longer repeats the head title or explanation.
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
- The rail is stacked, not docked: Next step, a one-line weekly-goals summary
  and a compact `Node key` disclosure follow the frame in the single screen
  scroll at every Android width. The old floating dock is retired. Next step
  holds only the choice rows when choices exist; otherwise it shows one
  no-choice line. There is no lede or foot paragraph. `Node key` is a local
  `Pressable` disclosure with the six short reward lines, and the goals summary
  links to `All goals` only when the run has objectives.
- Node detail keeps the type kicker, one goal/type chip, the Effort / Reward / Goal
  facts and one flavour line. The duplicate tag row, `NodeNotes`, the closing
  bonus box and `All weekly goals` are retired; the boss skip warning is the
  only visible skip note and other skip buttons expose it through
  `accessibilityHint`. The reward recap is a single `Outcome` fact plus `Done`,
  with its confirmation note moved to the button hint.
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
  dividers, not a stack of panels. The report header is the only screen
  heading: the day reads `Day N of 7 · Sealed`, `The day is sealed.`, its date
  and boss chips, and the seal; the week reads `The week · Sealed`, `The week is
  sealed.` and the seal. The day keeps one path list, one short closing-bonus
  line, the XP / Gold / Relics totals, one progress meta per goal (`Target met`
  or `N to go`), `No relics today.` for empty loot and the level-up strip only
  when a level was reached. The weekly close keeps the record strip, the totals
  with one `Weekly bonus included` line, the goal rows, the loot grid and the
  Reliquary link; the old bonus explainer block, guaranteed-rare copy, profile
  line, retire note and visible wait notes are retired. The open week is the
  header, the day pips, the goal rows and `Return to camp`. The new-run dialog
  uses `initialWeeklyTargets` / `validateNewRunSetup`, keeps the short
  retirement warning and one 1–7 range hint, and surfaces `startNewRun` errors
  locally.
- Profile is titled **The Reliquary** (`Profile` kicker) and never uses the
  player name as the title; the header chip shows owned relics against
  `collection.length`. The profile strip is one panel with the 62 dp level
  badge, name, `Wayfarer of the quiet path`, the experience bar and the Gold /
  Relics / Days kept totals. The collection has no `Found so far` or
  `Showing …` duplicates: the shared `SegmentedControl` filters carry their
  found counts and the two-column `LootCard` grid uses the catalogue length for
  every total. The extra XP-to-next-level note is gone. Duplicate history is
  rendered only when conversions exist, with one `Duplicates become gold.`
  line.
- Settings orders the three primary sections (Appearance, Nearby devices, Data), then
  the Android-only Reminders and the dev-only Development panel. Theme options
  are Day, Night and System; Appearance also holds the vibration switch.
  Nearby devices shows the local device with its platform icon, the Pair a device
  entry point, paired and nearby lists, per-peer sync/forget actions and
  auto-sync switches, and the conflict entry point. Fingerprints are never
  shown: the QR path carries the pinned certificate and the code is the
  fallback. There is no login, invite, password reset or server form. Data
  has one
  `Your save stays on this device.` line, export/import/reset actions and a
  `Save details` disclosure for the storage key and schema. About and the long
  theme/feedback/data notes are retired. Reset is one warning plus the typed
  confirmation.
- Recovery starts with the brand row and theme switch, a `Local save`
  `ScreenHead` with one paragraph, and one panel with import, original-save
  export and reset actions. The warning/duplicate notes are retired; export
  still uses the Android share sheet as “Export original save”, and the reset
  dialog keeps one line plus the typed confirmation.
- Data safety matches web. The import preview names the chosen JSON file on a
  valid save and warns that replacing overwrites the keys under
  `lifespire:mvp0`; a rejected file reports the reason without the name. A sync
  conflict shows both copies (profile, progress, run and saved time), lists up
  to five merge reasons and can share this device and the peer copy as two
  separate `lifespire-this-device-<date>.json` / `lifespire-<peer>-<date>.json`
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

The shared web suite continues to exercise the extracted store and UI helpers;
`packages/app-core` covers the LAN engine, migration and protocol. Mobile Jest
covers the notification planner, save files, draft helpers, map layout/state,
the dev logger and the LAN transport adapter. The Kotlin module is compiled by
the `mobile-native` CI job. The CI quality job runs lint, typecheck, tests and
build for every workspace, including the Android JS bundle.

Manual Android checklist before a release:

1. Fresh install → demo onboarding → open day 1 → resolve a task, a wheel and
   the boss → read day and run summaries.
2. Pair Android with the desktop app (scan the QR or enter the code) and with
   another Android device; confirm both sides show the peer with the right
   platform icon, auto-sync works and "Forget device" stops it.
3. Force-stop during a day, reopen, confirm the map, path and rewards survive.
4. Export on web, import on Android; export on Android, import on web.
5. Play one day on Android and one on the paired desktop/Android while the
   other app is closed; sync and verify the merge and the keep-mine/keep-peer
   conflict dialog (including airplane mode).
6. Enable notifications, grant permission, verify the test notification, set a
   near-future time and confirm tap-to-map. Disable and confirm cancellation.
7. Light/dark/system themes, 360 dp width, TalkBack and large font scale.

### 8.1 Development diagnostics

`apps/mobile/src/lib/devLogger.ts` installs one global development logger from
the app entry point. It is a no-op when `__DEV__` is false:

- unhandled JS errors are printed with their stack and forwarded to the
  previous React Native handler (so LogBox still works);
- `unhandledrejection` events are printed when the runtime exposes the event;
- `devError(scope, message, error?, context?)` and `devWarn(...)` prefix
  messages with `[LifeSpire][scope]`;
- context keys matching token/password/secret/authorization/cookie/document/save
  become `[redacted]`, and long strings are truncated. Saves, peer tokens and
  the certificate password are never printed;
- best-effort catches (sync, notifications, SecureStore, file export/import,
  haptics) now log once instead of failing silently. The UI
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
pnpm package:android            # EAS preview APK -> apps/mobile/release/, no release cut
pnpm try:android                 # dev build straight onto a USB-connected device, no APK file
cd apps/mobile
npx eas-cli build --platform android --profile preview   # installable APK
npx eas-cli build --platform android --profile production # AAB
```

`pnpm try:android` runs `expo run:android`: it compiles the dev client
locally (needs the Android SDK) and installs/launches it on the connected
device or emulator. Expo Go is not enough for sync testing: it does not
bundle the `lifespire-lan` native module, so Nearby sync stays unavailable
there.

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
- Android App Links for reset/invite (`https://…` links currently open the
  browser; manual paste is the supported path, see §4.1).
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
- Background sync via a foreground service (currently foreground-only).
- A remote wipe/backup path for a lost device (there is no cloud copy).

## 11. Troubleshooting

- **No nearby devices**: confirm both apps are open on the same Wi-Fi, Nearby
  sync is on and the network is not a guest/isolated SSID; a VPN or firewall can
  also block UDP. Use the QR/link or the 8-character code as the fallback.
- **Pairing rejected or a peer stays away**: the code expires in 5 minutes; a
  reinstall changes the certificate fingerprint, so forget and pair again.
- **Sync fails with 401/409**: the peer token was rotated by a re-pair, or the
  other device changed while you were sending. Forget/re-pair; a 409 is retried
  automatically up to 3 times before the conflict dialog.
- **Notifications never fire**: confirm the channel exists, the permission is
  granted, reminders are enabled and the run has an unsealed day. The test
  notification bypasses the planner.
- **Metro cannot resolve `.js`**: use `--clear` once after changing the
  resolver; never add `.js` file copies to the TS packages.
- **Duplicate native module**: `pnpm why react-native`, remove stale
  `node_modules`, and use the hoisted linker if needed.
