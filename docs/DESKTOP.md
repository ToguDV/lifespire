# LifeSpire desktop (Electron)

> Status: packaged desktop shell for Linux and Windows. Unsigned installers,
> manual updates, no desktop notifications.
>
> Scope: the same local-first daily loop as web and Android. The shell reuses the
> web build unchanged; it adds no desktop-only screens. See [`SPEC.md`](../SPEC.md).

## 1. Layout and shared code

```text
apps/desktop/
  src/main.ts             app lifecycle, window, custom protocol, downloads, guards,
                          IPC registration and safeStorage wiring
  src/preload.ts          narrow contextBridge (`window.lifespireDesktop`)
  src/apiProxy.ts         Electron-free API proxy: path/origin/header policy,
                          refresh-token capture/rotation and the token vault
  src/apiProxy.test.ts    Vitest coverage for the proxy, vault and IPC sender gate
  src/menu.ts             desktop menu (clipboard roles; devtools only in dev)
  src/protocol.ts         pure URL ↔ file mapping and navigation policy
  src/protocol.test.ts    Vitest coverage for the resolve/navigation rules
  electron-builder.yml    Linux `.deb`/AppImage/`tar.gz`, Windows NSIS/zip
  build/icon.png          installer icon, derived from the web 512 px icon
```

The renderer is `apps/web/dist`: no fork, no second design system, no duplicated
domain logic. `packages/core` and `packages/app-core` reach the desktop exactly as
they reach the browser.

## 2. How the shell serves the app

- A packaged build registers the privileged scheme `lifespire-app` (`standard`,
  `secure`, `supportFetchAPI`, `corsEnabled`, `codeCache`) and loads
  `lifespire-app://app/index.html`.
- `protocol.handle` maps each request to a file under the packaged `web` folder
  (`extraResources` → `resources/web`). Dot segments are normalized and any path
  that escapes that folder is rejected; there is no SPA fallback because the app
  has no router.
- The stable origin means `localStorage` keeps working with the same keys and the
  same versioned `GameDocument` as the browser build. A rename of the scheme or
  the host would orphan existing saves, so both are treated as a contract.
- `/theme.js` is served like any other packaged asset: the web `index.html`
  keeps its external, render-blocking `<script src="/theme.js">`, so the
  CSP-compatible theme bootstrap is preserved under `lifespire-app://app`. The
  shell adds no CSP of its own (see §9).
- `registerSW.js` and `sw.js` are answered with an empty script: the service
  worker is a browser-only concern and the shell already serves assets from disk.
- Development loads `http://localhost:5173` (override with `LIFESPIRE_DEV_URL`).
  `pnpm dev` (web) and `pnpm dev:desktop` (shell) run side by side.

## 3. Security

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`; the
  renderer never sees Node or Electron APIs.
- The preload exposes `{ isDesktop: true, platform }` plus the minimum sync
  surface: `api.request`, `sync.setServer`, `auth.sessionState` and
  `auth.signOut`. There is no token getter; the refresh token never crosses the
  bridge.
- Every IPC handler validates `event.senderFrame.url` against the packaged
  `lifespire-app://app` origin, or `LIFESPIRE_DEV_URL` while unpackaged, and
  throws for any other frame.
- The API proxy is the only path to the network: `/v1/...` and `/health/live`
  only (no absolute URLs, protocol-relative paths, dot segments or encoded
  separators), allowlisted methods and headers, a 1 MB body cap (matching the
  API), a 10 s timeout and `redirect: 'error'`. Authorization, content type, conditional
  request headers and `Idempotency-Key` are the only headers forwarded.
- `window.open` is denied, external `http(s)` links open in the system browser,
  and both `will-navigate` and `will-redirect` only allow in-app navigations.
- Every Chromium permission request and permission check is denied; the app
  needs none.
- Failed loads and crashed renderer processes surface a native error dialog
  instead of an invisible window.
- `<webview>` attachment is blocked, the dev menu with reload/devtools is only
  installed in unpackaged builds, and a second launch focuses the existing
  window instead of opening another one.

## 4. Data

- Same save contract as web and Android: `lifespire:mvp0` holds the compact
  `GameDocument` (`schemaVersion 3`), plus the backup/meta keys used by recovery
  and sync. Migrations are shared; the shell stores no state of its own.
- Export keeps the Settings download, but `will-download` opens a native save
  dialog defaulting to the Downloads folder instead of writing silently.
- Import still uses the web file input, the 2 MB gate and `readSaveFile`.
- The multi-tab policy collapses to the single-instance lock. Native
  notifications are out of scope, so there is no permission prompt.

## 5. Sync

The renderer origin stays `lifespire-app://app`; no CORS entry or cookie
change is needed. The Electron **main process** is the API client:

- The renderer calls `window.lifespireDesktop.api.request({ path, method,
  headers, body })`. Main joins it with the configured server origin and calls
  `ses.fetch` from a **dedicated in-memory session** (`lifespire-api`), with a
  10 s timeout for API calls and 6 s for health. The long-poll change feed
  (`GET /v1/sync/watch`) gets a 35 s timeout because the server may hold it up
  to 30 s; it is still a normal request/response through the same proxy, so no
  streaming IPC is involved. The web renderer stops the feed while the window is
  hidden. The default session (and the renderer) never sees these requests.
- The proxy allowlist covers the whole `/v1` namespace, so the account flows
  need no desktop-specific path: the Settings/welcome dialog posts
  `/v1/auth/login`, `/v1/auth/accept-invite` and `/v1/auth/reset-password`
  through it. Reset returns no session; invite acceptance receives the native
  grant token in main, stores it and strips it before the renderer builds its
  `Response`.
- Reset and invite links are ordinary web URLs
  (`https://…/reset-password#token=…` and `https://…/accept-invite#token=…`).
  The external-link policy (§3) opens them in the system browser, never inside
  the shell. To finish in the app, paste the full link or its 43-character token
  into **Settings → Sync** or the welcome **Already have an account? Sign in**
  dialog; both use the shared `extractAuthToken` / `isAuthToken` and
  `newPasswordProblem` helpers, so the desktop behaves like web and Android.
- Chromium stamps `Sec-Fetch-Site: none` (and potentially `Origin`/`Referer`)
  on session fetches, which would fail the native gate. A
  `webRequest.onBeforeSendHeaders` listener in that dedicated session removes
  the three headers before sending. Because no renderer traffic can enter the
  partition, this cannot weaken the web gate; the smoke check below verifies
  the wire headers.
- Link-local and cloud-metadata IP literals (`169.254.0.0/16`,
  `::ffff:169.254.0.0/16`, `fe80::/10`, `fd00:ec2::254`) are always rejected.
  Private LAN ranges stay allowed because self-hosting a server on the local
  network is a supported use case. DNS aliases (`metadata.google.internal`,
  `*.nip.io`) are **not** resolved or blocked; only literal addresses are
  covered.
- API responses are capped at 5 MB (declared `Content-Length` and streamed
  body); an oversized response cancels the transfer and fails with
  `RESPONSE_TOO_LARGE`. Every request, including `/health/live`, uses
  `redirect: 'error'`; a redirect during the health probe surfaces
  "No LifeSpire server at that address: it redirects elsewhere — use the
  final https:// address." instead of being followed.
- `/v1/auth/login`, `/v1/auth/accept-invite` and `/v1/auth/refresh` are sent
  with `X-Client-Platform: desktop`. With no `Origin`/`Sec-Fetch-Site`, the API
  accepts the native grant (ADR-0005) and returns the refresh token to main.
  Main stores the rotated token and **strips it from the response** before the
  renderer builds its `Response`.
- On refresh, main injects the stored token into the JSON body; the renderer
  never needs to know it. The access token stays in renderer memory exactly as
  on web. Web/mobile/desktop serialize concurrent 401s into a single refresh,
  and a sign-out or server switch aborts any in-flight proxy request via a
  generation counter, so a late rotation can never revive a closed session or
  land under another origin.
- If a 2xx login/refresh does not include a `refreshToken`, the proxy fails
  with a clear "update the sync server" error instead of showing a session
  that could never be renewed.
- `GET /health/live` is the only request that may name another origin: the
  Settings panel probes a candidate server *before* saving it, authenticated
  paths always require the configured origin.
- The configured origin is pushed by the renderer on boot and after every
  server switch (`sync.setServer`). Settings validates the candidate with main
  **before** persisting the URL or repointing the client, so a rejected origin
  leaves the UI and main on the same server. An empty base URL means "sync not
  configured" with a clear error; the desktop never falls back to same-origin.

Persistence:

- The token is written to `userData/sync-session.json` as
  `{ version, origin, token }`, with `token` encrypted by Electron
  `safeStorage` (OS keychain) and base64-encoded. It is keyed to the server
  origin, so a different server never reuses it.
- Every rotation writes the new token atomically (temp file + rename,
  `0600`). Successful `logout`/`logout-all`, local sign-out, a rejected
  refresh and a server change delete it; boot with no server or with another
  origin removes a stale credential. Write/delete failures surface instead of
  leaving a phantom session. Server-side, `logout` revokes the whole refresh
  family, so even an access token that predates the last rotation closes
  every sibling rotation.
- If `safeStorage.isEncryptionAvailable()` is false, or Linux selects the
  `basic_text` backend (no keyring), the token stays **in main-process memory
  only**. Sync works for the running session, Settings shows a "Not saved"
  notice, and restarting the app requires a new sign-in. Any pre-existing
  encrypted file is deleted on boot and on memory-only save, so a later
  keyring-enabled run cannot restore the previous account. If unlink fails,
  the file is atomically overwritten with a `{}` tombstone (and `load` rejects
  empty/tombstone files); only when both delete and tombstone fail does the
  error reach Settings, where sign-out also awaits the local result instead of
  pretending the session was cleared.
- The save itself is unchanged: the same `GameDocument` in `localStorage`, no
  token in renderer storage, no migration. Export/import remains the offline
  way to move a save.

## 6. Commands

```bash
pnpm dev            # terminal 1: Vite dev server
pnpm dev:desktop    # terminal 2: compile the shell and open it

pnpm build:desktop          # tsc only (part of `pnpm build`)
pnpm package:desktop        # build web + shell, then package for this OS
pnpm --filter @lifespire/desktop package:linux
pnpm --filter @lifespire/desktop package:win
```

`electron-builder` writes to `apps/desktop/release/` (gitignored). The web build
is a prerequisite: the packaging scripts run `@lifespire/web build` first and the
packaged app fails to load if `apps/web/dist` is missing.
## 7. CI release

[`release.yml`](../.github/workflows/release.yml) runs only on `v*` tags:

1. `verify` fails unless the tag matches `version` in the root, desktop and
   mobile `package.json` manifests.
2. `quality` repeats the gates from `ci.yml` (lint, typecheck, E2E typecheck,
   tests, build).
3. `desktop` packages on `ubuntu-latest` (`.deb`, `.AppImage`, `.tar.gz`) and
   `windows-latest` (NSIS `.exe`, portable `.zip`).
4. `android` builds the APK on EAS cloud with the `preview` profile. It needs the
   `EXPO_TOKEN` repository secret and a project that has been linked once with
   `eas init` (committed `extra.eas.projectId`) plus EAS-managed Android
   credentials. `app.config.ts` reads the version from
   `apps/mobile/package.json`, which travels to the builder; runner environment
   variables do not, so the tag never silently ships the wrong APK.
5. `publish` attaches every artifact plus `SHA256SUMS.txt` to the GitHub release.
   It waits for quality and the desktop builds but tolerates a failed `android`
   job: the run stays red, a warning is printed and the installers are still
   published. The release notes list whatever files ended up attached.

Release checklist: bump `version` in the root, desktop and mobile `package.json`,
commit, then `git tag vX.Y.Z && git push origin vX.Y.Z`.

Installers are unsigned. Linux `.deb` installs without warnings; Windows shows the
SmartScreen "unknown publisher" prompt. Adding code signing later only needs the
`WINDOWS_CERT_PFX_BASE64`/`WINDOWS_CERT_PASSWORD` secrets and an
`electron-builder` `win.signtoolOptions` block. There is no auto-update: users
download the next release manually.

## 8. Verification

`pnpm --filter @lifespire/desktop test` covers URL resolution, path-traversal
rejection, the navigation allow-list, the external-link policy, the API proxy
(path/header/body/origin allowlists, sender validation, token stripping,
rotation, logout/server-switch cleanup and the memory-only fallback).

CI has no display and does not open the Electron window, so sync still needs a
manual pass on a desktop session:

1. `pnpm build`, then
   `pnpm --filter @lifespire/desktop exec electron-builder --dir`; launch
   `apps/desktop/release/linux-unpacked/lifespire` (or `pnpm dev` +
   `pnpm dev:desktop`). Confirm the welcome screen, self-hosted fonts,
   `localStorage` writes and `window.lifespireDesktop`, with no console errors.
2. Settings → Sync server: enter the API origin (`http://localhost:3000` for
   the local stack), confirm the health check passes and save it.
3. Sign in (with TOTP if enabled), confirm the sync panel shows the user and
   cloud version, and make an edit that pushes.
4. With the desktop window open, edit the same save on web or Android and
   confirm the desktop applies the change **without a reload** and shows the
   "Updated from another device." notice. Repeat in the other direction.
5. In DevTools, check that `window.lifespireDesktop` has no token getter and
   that neither `localStorage` nor `sessionStorage` contains a refresh token.
   `await window.lifespireDesktop.auth.sessionState()` reports
   `persistence: "encrypted"` and `signedIn: true`. The API log for the login
   shows `X-Client-Platform: desktop` with no `Origin`/`Sec-Fetch-Site`.
6. Restart the app: the session restores without a new login. Sign out and
   confirm `userData/sync-session.json` is gone and the next launch starts as a
   guest.
7. Change the server: the old credential is cleared, the panel stays on screen
   and signing in uses the new origin.
8. Keychain fallback: on Linux, start with an unavailable keyring (for example
   `--password-store=basic` or a headless session). Settings shows the
   "Not saved" notice, sync works for that run and a restart requires signing
   in again.
9. Negative checks: with no server saved, signing in fails with the
   "choose a sync server" message; DevTools cannot fetch `/v1` or any other
   URL through `api.request` (paths outside `/v1`/`/health/live`, absolute URLs
   and bodies over 1 MB are rejected).

Account-link checks: generate a reset link with
`node apps/api/dist/cli/admin-reset-link.js --email …` on the throwaway stack,
paste the full link into Settings → Sync (or the welcome dialog), confirm the
local success notice and sign in with the new password; confirm
`userData/sync-session.json` exists and that neither `localStorage` nor
`sessionStorage` contains a refresh token. The same link opened from the shell
must go to the system browser, not replace `lifespire-app://app`. Accepting an
invite should switch the dialog to the signed-in account and leave sync running
without a reload.

## 9. Known follow-ups

- A CSP for the custom origin (the shell relies on the existing web build and
  renderer hardening in this PR).
- Code signing for Windows and a signed apt repository for Linux.
- `electron-updater` once releases need silent updates.
- Desktop notifications and deep links (`lifespire://`) mirroring Android.
- macOS (`dmg`/`zip`) builds and an Apple Developer ID, once there is a Mac
  runner budget.
