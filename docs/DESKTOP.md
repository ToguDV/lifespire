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
  src/preload.ts          narrow contextBridge (`window.lifespireDesktop.localSync`)
  src/localNode/          identity/certificate, UDP discovery, HTTPS server,
                          pinned client, durable inbox, peer registry and IPC
  src/localNode/*.test.ts Vitest coverage for the node, TLS, pairing and inbox
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
- The preload exposes `{ isDesktop: true, platform, localSync }` and nothing
  else. There is no token, key or certificate getter; they never cross the
  bridge. `localSync` is a narrow set of high-level operations (`start`,
  `stop`, `pair`, `listPeers`, `request`, ...), not a raw socket or fetch.
- Every IPC handler validates `event.senderFrame.url` against the packaged
  `lifespire-app://app` origin, or `LIFESPIRE_DEV_URL` while unpackaged, and
  throws for any other frame.
- The LAN node is the only path to the network: it accepts only private source
  addresses, requires the peer bearer token, caps the document at 512 KB and the
  request at 2 MB, and validates that `documentJson` is JSON before queueing it.
  The pinned client checks the peer certificate fingerprint before writing any
  header, token or document.
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

## 5. Local LAN sync

The renderer origin stays `lifespire-app://app`; no CORS entry or cookie change
is needed. The Electron **main process** owns the node:

- **Identity:** `localNode/identity.ts` generates a self-signed certificate with
  `selfsigned` (RSA 2048, CN = deviceId, 10 years) and persists the PEM key/cert
  in `userData/identity.json`, encrypted with `safeStorage` when available. If
  the keychain is unavailable (or Linux uses `basic_text`), the file is written
  with `0600` and Settings shows the plaintext warning. The fingerprint is the
  SHA-256 of the DER (base64url).
- **Discovery:** `localNode/discovery.ts` uses `dgram` on UDP `47823`; it probes
  on start, announces every 10 s, expires peers after 30 s and broadcasts to
  every IPv4 interface plus `255.255.255.255`/loopback, with a multicast
  fallback. It runs only while the app is running and Nearby sync is on.
- **Server:** `localNode/server.ts` is an `https` server with the identity
  certificate. Routes are `/health`, `/v1/pair`, `/v1/info`, `/v1/document`
  (GET/POST) and `/v1/unpair`; `/v1/pair` is the only unauthenticated write and
  is guarded by the one-time secret/code plus a per-IP rate limit. Private
  source addresses only.
- **Client:** `localNode/client.ts` is a minimal HTTP/1.1 client over
  `tls.connect`; it verifies the expected certificate fingerprint on
  `secureConnect`, **before** writing anything, then sends the bearer token.
  The pairing request uses the fingerprint from the QR; normal requests use the
  stored peer fingerprint.
- **Peers and tokens:** `localNode/peerStore.ts` stores name, fingerprint,
  certificate, bearer token, auto-sync policy and last address. The whole file
  is encrypted with `safeStorage` when available. Tokens are never exposed to
  the renderer.
- **Documents:** the renderer sends `documentJson` + checksum through IPC and
  main keeps a mirror for peer pulls. An incoming POST is written to a durable
  inbox (`inbox/`) and answered `202`; the renderer applies/validates it and
  calls `ack`, which updates the mirror. A crash between both steps
  re-delivers on the next start.
- **IPC:** `localNode/ipc.ts` validates the sender and forwards only the typed
  operations. Events (`peers`, `paired`, `incoming`, `error`) go to the main
  window's `webContents`; the preload exposes them as unsubscribe functions.
- **Save:** unchanged. The same `GameDocument` in `localStorage`, one canonical
  key `lifespire:mvp0`; the migration promotes a legacy account save before the
  store hydrates. Export/import remains the offline path.

## 6. Commands

```bash
pnpm dev            # terminal 1: Vite dev server
pnpm dev:desktop    # terminal 2: compile the shell and open it
pnpm try:desktop    # or both in one terminal (Ctrl+C stops both)

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
rejection, the navigation allow-list, the external-link policy, and the local
node (identity/fingerprint, peer registry, inbox, discovery packet/broadcast,
pairing QR/code, HTTPS, CAS, wrong token and wrong certificate pin).

CI has no display and does not open the Electron window, so sync still needs a
manual pass on a desktop session:

1. `pnpm build`, then
   `pnpm --filter @lifespire/desktop exec electron-builder --dir`; launch
   `apps/desktop/release/linux-unpacked/lifespire` (or `pnpm dev` +
   `pnpm dev:desktop`). Confirm the welcome screen, self-hosted fonts,
   `localStorage` writes and `window.lifespireDesktop.localSync`, with no
   console errors.
2. Pair with an Android device on the same Wi-Fi: Settings → Nearby devices →
   Show my code, scan the QR (or enter the 8-character code), confirm both
   sides show the peer and the fingerprint.
3. Make an edit on Android and on desktop while the other app is closed; open
   both, sync, and confirm the conservative merge and the keep-mine/keep-peer
   dialog.
4. In DevTools, check that `window.lifespireDesktop` exposes no token/key/cert
   getter and that neither `localStorage` nor `sessionStorage` contains a peer
   token or a private key. `await
   window.lifespireDesktop.localSync.persistence()` reports `encrypted` (or
   `plaintext` with the warning).
5. Restart the app: the pairing survives and auto-sync resumes when the peer is
   nearby. "Forget" removes it on both sides after the next connection.
6. Negative checks: a wrong token returns 401, a wrong certificate pin is
   rejected before the request, a wrong pairing code is rejected, and a
   document over 512 KB is rejected. The server is unreachable from a public
   address (private-source check).
7. Keychain fallback: on Linux, start with an unavailable keyring (for example
   `--password-store=basic`). Settings shows the plaintext warning; pairing still
   works and the tokens stay in the `0600` file.

## 9. Known follow-ups

- A CSP for the custom origin (the shell relies on the existing web build and
  renderer hardening in this PR).
- Code signing for Windows and a signed apt repository for Linux.
- `electron-updater` once releases need silent updates.
- Desktop notifications and deep links (`lifespire://`) mirroring Android.
- macOS (`dmg`/`zip`) builds and an Apple Developer ID, once there is a Mac
  runner budget.
