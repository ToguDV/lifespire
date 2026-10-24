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

- Tokens, palettes and type scale mirror `design/DESIGN.md` and
  `apps/web/src/styles/tokens.css`; Alegreya/Alegreya Sans are self-loaded
  through `@expo-google-fonts` (OFL), only the six used weights.
- The map uses `react-native-svg` plus absolutely positioned `Pressable`
  nodes, reusing `packages/app-core/src/ui/mapLayout.ts`. The wheel uses the
  same sector/payout math as web with an `Animated` rotation.
- Navigation reuses the store's transient `view`/`history` (no router);
  Android's hardware back button maps to `back()` and is blocked on the wheel
  recap. Tabbar: Map, Camp, Goals, Relics; Settings lives in the topbar.
- Haptics follow the web feedback vocabulary through `expo-haptics`. Sound is
  not bundled in this release; the haptics toggle is the device feedback
  preference.
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

## 9. Known follow-ups

- Physical-device verification and screenshots (this repository's CI has no
  Android emulator).
- iOS build and APNs grant verification (the code path exists but is untested).
- Push notifications, if a server-side reason appears; local reminders cover
  the product need today.
- Optional sound pack for feedback parity with web.
- API e2e flow for the native refresh grant (unit + client coverage exists
  today; the flow needs Postgres).

## 10. Troubleshooting

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
