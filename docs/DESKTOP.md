# LifeSpire desktop (Electron)

> Status: packaged desktop shell for Linux and Windows. Unsigned installers,
> manual updates, no desktop notifications.
>
> Scope: the same local-first daily loop as web and Android. The shell reuses the
> web build unchanged; it adds no desktop-only screens. See [`SPEC.md`](../SPEC.md).

## 1. Layout and shared code

```text
apps/desktop/
  src/main.ts             app lifecycle, window, custom protocol, downloads, guards
  src/preload.ts          read-only contextBridge (`window.lifespireDesktop`)
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
- `registerSW.js` and `sw.js` are answered with an empty script: the service
  worker is a browser-only concern and the shell already serves assets from disk.
- Development loads `http://localhost:5173` (override with `LIFESPIRE_DEV_URL`).
  `pnpm dev` (web) and `pnpm dev:desktop` (shell) run side by side.

## 3. Security

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`; the
  renderer never sees Node or Electron APIs.
- The preload exposes only `{ isDesktop: true, platform }`.
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
- **Sync is not wired for desktop yet.** The renderer origin is
  `lifespire-app://app`, which the API's CORS list and cookie handling do not
  cover; the desktop app is guest/local in this release. Settings replaces the
  sync/server panels with a note and points at export/import, which is how a
  save moves between desktop and the other clients.

## 5. Commands

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
## 6. CI release

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

## 7. Verification

- `pnpm --filter @lifespire/desktop test` covers URL resolution, path-traversal
  rejection, the navigation allow-list and the external-link policy.
- Packaging smoke check (Linux, run locally because CI has no display):
  `pnpm --filter @lifespire/desktop exec electron-builder --dir`, launch
  `release/linux-unpacked/lifespire`, confirm the welcome screen, self-hosted
  fonts, `localStorage` writes and the preload bridge
  (`window.lifespireDesktop`), with no console errors.

## 8. Known follow-ups

- Code signing for Windows and a signed apt repository for Linux.
- `electron-updater` once releases need silent updates.
- Desktop sync: add the custom origin to the API CORS policy and decide how the
  refresh cookie behaves outside `http(s)`.
- Desktop notifications and deep links (`lifespire://`) mirroring Android.
- macOS (`dmg`/`zip`) builds and an Apple Developer ID, once there is a Mac
  runner budget.
