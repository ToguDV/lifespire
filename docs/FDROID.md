# F-Droid repository and Android updates

LifeSpire ships Android builds through a **self-hosted F-Droid repository**
served from GitHub Pages. Every `v*` tag builds the signed APK, attaches it to
the GitHub release and refreshes the repository. The app checks the repository
index and offers the update; F-Droid installs it.

Stable URLs:

| Purpose | URL |
|---|---|
| Repository (add this in F-Droid) | `https://togudv.github.io/lifespire/fdroid/repo/` |
| Index | `https://togudv.github.io/lifespire/fdroid/repo/index-v2.json` |
| Landing page | `https://togudv.github.io/lifespire/` |
| Release fallback manifest | `https://github.com/ToguDV/lifespire/releases/latest/download/version.json` |

## 1. One-time setup

### 1.1 Two different keys

They must never be confused:

| Key | Purpose | Where it lives |
|---|---|---|
| **EAS app signing key** | Signs every APK; Android uses it to accept updates over an installed build | EAS-managed; back it up offline, never put it in GitHub |
| **F-Droid repo key** | Signs `index-v2.json` / `index-v1.jar` | A new keystore in GitHub Actions secrets |

The keys are intentionally separate. Rotating or losing the repo key only forces
users to remove and re-add the F-Droid repository. Rotating the **app** key makes
Android reject every update, and the only recovery is export the save, uninstall
and reinstall. CI pins the app certificate fingerprint so that never happens by
accident.

### 1.2 Back up the EAS app key

Even though CI does not use it, download and store the EAS-managed keystore
offline. Losing it means every installed user is stuck on the current version.

```bash
cd apps/mobile
npx eas-cli credentials --platform android
# Keystore → Download existing keystore
```

Store the keystore and its passwords offline. The current release certificate
SHA-256 fingerprint is:

```text
209d9fd8e940df5a8bcdcc6f04ace0332ada901050559ef8e5b4bab5703e4c22
```

Verify it against the published APK (or the next EAS build) with:

```bash
apksigner verify --print-certs LifeSpire-0.3.1.apk | grep SHA-256
```

If that command prints a different digest, update `ANDROID_APP_CERT_SHA256` and
the `AllowedAPKSigningKeys` entry only when the change is intentional; otherwise
stop, because installed apps cannot accept the update.

### 1.3 Create the repository key

```bash
keytool -genkeypair -alias lifespire-repo -keyalg RSA -keysize 4096 -validity 10950 \
  -storetype PKCS12 -keystore lifespire-repo.keystore
```

PKCS12 uses one password for the store and the key. Back the keystore and its
password up offline. Add the repository secrets:

```bash
base64 -w0 lifespire-repo.keystore | gh secret set FDROID_KEYSTORE_BASE64 -R ToguDV/lifespire
gh secret set FDROID_KEYSTORE_PASSWORD -R ToguDV/lifespire
gh secret set FDROID_KEY_ALIAS -R ToguDV/lifespire --body lifespire-repo
gh secret set FDROID_KEY_PASSWORD -R ToguDV/lifespire
gh secret set ANDROID_APP_CERT_SHA256 -R ToguDV/lifespire \
  --body 209d9fd8e940df5a8bcdcc6f04ace0332ada901050559ef8e5b4bab5703e4c22
```

| Secret | Content |
|---|---|
| `FDROID_KEYSTORE_BASE64` | `base64 -w0 lifespire-repo.keystore` |
| `FDROID_KEYSTORE_PASSWORD` | Repository keystore password |
| `FDROID_KEY_ALIAS` | `lifespire-repo` (or the alias you chose) |
| `FDROID_KEY_PASSWORD` | Key password (same as the store password for PKCS12) |
| `ANDROID_APP_CERT_SHA256` | EAS APK certificate SHA-256, no colons, lowercase |

`ANDROID_APP_CERT_SHA256` is checked by
[`scripts/verify-android-apk.sh`](../scripts/verify-android-apk.sh) on every
release and by the manual repair workflow. If it changes, the release fails
before anything is published.

The repository fingerprint shown by F-Droid when adding the repo is the
SHA-256 of the repo key:

```bash
keytool -list -v -keystore lifespire-repo.keystore -alias lifespire-repo | grep SHA256
```

### 1.4 Enable GitHub Pages

The `fdroid` branch is created by the first release. After that first run,
enable Pages once (UI: **Settings → Pages → Deploy from a branch → `fdroid` /
`/ (root)`**), or:

```bash
gh api -X POST repos/ToguDV/lifespire/pages \
  --input - <<'JSON'
{"source":{"branch":"fdroid","path":"/"}}
JSON
```

Until Pages is enabled the index returns 404; the app falls back to
`version.json`, and the landing page is not available. Verify with:

```bash
curl -fsSL https://togudv.github.io/lifespire/fdroid/repo/index-v2.json | head
```

### 1.5 Add the repository in F-Droid

On the phone: **F-Droid → Settings → Repositories → +**, enter
`https://togudv.github.io/lifespire/fdroid/repo/`, and compare the fingerprint
shown by F-Droid with the one from `keytool`. Then search for **LifeSpire** and
install it. Enable **Automatically install updates** in F-Droid if you want the
store to update it without a tap.

The release and repair workflows pin `fdroidserver==2.4.5` because the
index-v2 schema has changed between releases; bump it deliberately and run a
repair against a test tag first.

## 2. Cutting a release

1. Bump `version` in the root, `apps/desktop` and `apps/mobile` manifests.
2. Commit and tag a final `vX.Y.Z` (`v0.4.0`, not a prerelease).
3. `git push origin main vX.Y.Z`.

The release workflow:

1. `verify` checks the tag against the three manifests.
2. `quality` runs lint, typecheck, E2E typecheck, tests and build.
3. `android` builds the `preview` APK on EAS. The profile sets
   `LIFESPIRE_RELEASE_ABIS=1`, so `expo-build-properties` writes
   `reactNativeArchitectures=arm64-v8a,armeabi-v7a`; the job verifies the
   version, versionCode, size, ABIs and certificate before exposing the version
   to `publish`.
4. `desktop` packages the installers and the `electron-updater` channel files.
5. `publish` creates the GitHub release with the APK, desktop assets,
   `version.json` and `SHA256SUMS.txt`, then runs
   [`scripts/fdroid-repo.sh`](../scripts/fdroid-repo.sh) to refresh the `fdroid`
   branch and sign the index with the repository key.

The APK is attached as `LifeSpire-<version>.apk`; inside the repository it is
`com.lifespire.app_<versionCode>.apk`.

The `fdroid` branch is **generated as a single commit** and force-pushed on each
release. It keeps the landing page, metadata, index and only the newest
`FDROID_KEEP_APKS` (default 3) APKs. Rewriting the generated branch prevents
50+ MB APK blobs from accumulating in every clone forever. Never put source
code or secrets in that branch.

## 3. VersionCode and APK contract

`apps/mobile/app.config.ts` derives `versionCode` from the semantic version:

```text
major × 1_000_000 + minor × 1_000 + patch
0.4.0 → 4000
```

It must increase between releases; a same-tag repair may reuse its code, but it
can never go lower. F-Droid and Android both refuse downgrades. `scripts/verify-android-apk.sh` checks the APK's actual code against
the tag, and `scripts/fdroid-repo.sh` refuses a code lower than the published
index.

The release APK must stay under 100 MB (GitHub's per-file limit) and must not
contain `x86`/`x86_64` libraries. The release profile sets
`LIFESPIRE_RELEASE_ABIS=1`, so `expo-build-properties` writes
`reactNativeArchitectures=arm64-v8a,armeabi-v7a` into the generated
`android/gradle.properties`; local/dev builds keep all four ABIs and still run
on x86 emulators. The F-Droid metadata pins the EAS signer through
`AllowedAPKSigningKeys`; an APK with another certificate is left out of the
index, and the script fails if the new versionCode is missing from it.

## 4. Repairing the repository

The release is already published when `publish` reaches F-Droid. If that step
fails, **never move the tag**. Re-run the same script against the existing
release:

```bash
gh workflow run fdroid.yml -R ToguDV/lifespire -f tag=v0.4.0
gh run watch -R ToguDV/lifespire
```

The manual workflow downloads `LifeSpire-<version>.apk`, verifies its signature,
rebuilds the index and force-pushes `fdroid`.

The repair workflow applies to tags created after the F-Droid setup landed (they
contain `deploy/fdroid/` and `scripts/fdroid-repo.sh`). Older tags have no
templates; do not move them.

## 5. Client behavior and privacy

- The app reads the F-Droid index first, compares `versionCode` (then semver),
  and falls back to the GitHub `version.json` only when the index is
  unreachable. A reachable index with no newer package is "current": a stale
  manifest cannot create a phantom notice.
- Checks run on start, on foreground (throttled), every 6 hours and on demand in
  **Settings → About**. A banner under the top bar appears only when a newer
  build exists.
- The normal action is **Open F-Droid**: an explicit
  `market://details?id=com.lifespire.app` intent through `expo-intent-launcher`,
  falling back to the landing page. When the notice came from the `version.json`
  fallback (Pages unreachable), the action opens the GitHub release/APK instead,
  so a broken Pages deployment does not hide the update. The app never installs
  an APK itself, requests no `REQUEST_INSTALL_PACKAGES` and does not use
  `expo-updates`.
- The check sends no device data. It fetches a public index/manifest over HTTPS;
  the installed version is compared locally.
- The save stays on the device. F-Droid installs an APK update, not a data wipe;
  SQLite KV, peer bases and the native identity vault are preserved.

## 6. Troubleshooting

- **Index 404:** Pages is not enabled, or the first deployment is still running.
  Check Settings → Pages and `gh run list --branch fdroid`.
- **`fdroid update` complains about `repo_url`:** the config URL must end with
  `/repo` (no trailing slash); the script writes `https://togudv.github.io/lifespire/fdroid/repo`.
- **F-Droid says the repository signature changed:** the repo key was rotated or
  the wrong keystore was used. Remove and re-add the repository. The app APK is
  unrelated and keeps updating.
- **APK too large:** confirm the Gradle command/ABIs; `unzip -Z1 app.apk | grep
  '^lib/'` must show only `arm64-v8a` and `armeabi-v7a`.
- **versionCode lower than published:** bump the app version and tag a new
  release; do not reuse or move a published tag.
- **Certificate mismatch:** the EAS signing key changed, or
  `ANDROID_APP_CERT_SHA256` is stale. Do not publish an update that cannot
  install; restore the EAS keystore or coordinate a save export + reinstall.
- **Banner never appears:** check that the installed `versionCode` is lower than
  the index value. In Expo Go the check uses the embedded version and reports no
  native code; use an installed release APK. If Pages is down, the manifest
  fallback should still work.
- **Banner appears but F-Droid has no update:** the repository step failed after
  the GitHub release was created; the index is stale while the manifest is new.
  Run the manual `fdroid.yml` repair workflow for the tag. The release run is
  red in this case.
- **`FDROID_KEYSTORE_BASE64` is missing:** the first release still creates the
  GitHub release and desktop assets, but the F-Droid branch is not refreshed.
  Add the five secrets from §1.3 and run `fdroid.yml`; no tag move is needed.
- **Open F-Droid opens a browser:** F-Droid is not installed (or the intent was
  rejected); the landing page explains how to add the repository and download
  the APK.

## 7. Key rotation and rollback

- **Repo key:** generate a new keystore, replace the secrets and refresh the
  repository. Users must remove/re-add the repo; the app and its data are
  untouched.
- **App key:** treat as immutable. If it is lost, export the save from every
  affected device before uninstalling; Android cannot install an APK signed by a
  different key over the old one.
- **Broken release:** publish a new, higher version. F-Droid does not downgrade;
  the previous APKs are kept only for emergency manual installs. Do not move a
  published tag.

## 8. Out of scope

- Submitting to the official F-Droid.org repository (this is a self-hosted repo).
- In-app APK download/installation.
- iOS, `expo-updates`/OTA and server-side update checks.
