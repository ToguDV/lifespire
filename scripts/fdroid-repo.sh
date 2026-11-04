#!/usr/bin/env bash
#
# Rebuild the self-hosted F-Droid repository (the `fdroid` branch) from a
# published GitHub release. Used by the release workflow and by the manual
# `F-Droid repo` repair workflow.
#
# The branch is generated: each run creates a single fresh commit with the
# current index, metadata, landing page and the last FDROID_KEEP_APKS APKs, then
# force-pushes it to `fdroid`. Keeping one commit avoids storing every 50+ MB APK
# in the branch history forever.
#
# Requirements on PATH: git, node, aapt, apksigner, unzip, fdroid (fdroidserver),
# Java and the Android build-tools. The APK comes from APK_SOURCE or, when it is
# unset, from the GitHub release (gh).
set -euo pipefail

TAG="${TAG:?TAG is required}"
VERSION="${TAG#v}"
VERSION_CODE="${VERSION_CODE:?VERSION_CODE is required}"
APK_SOURCE="${APK_SOURCE:-}"
FDROID_PACKAGE="${FDROID_PACKAGE:-com.lifespire.app}"
FDROID_REPO_URL="${FDROID_REPO_URL:-https://togudv.github.io/lifespire/fdroid/repo}"
FDROID_KEEP_APKS="${FDROID_KEEP_APKS:-3}"

: "${FDROID_KEYSTORE_BASE64:?FDROID_KEYSTORE_BASE64 is required}"
: "${FDROID_KEYSTORE_PASSWORD:?FDROID_KEYSTORE_PASSWORD is required}"
: "${FDROID_KEY_ALIAS:?FDROID_KEY_ALIAS is required}"
: "${FDROID_KEY_PASSWORD:?FDROID_KEY_PASSWORD is required}"

if ! [[ "$VERSION_CODE" =~ ^[0-9]+$ ]] || [ "$VERSION_CODE" -le 0 ]; then
  echo "VERSION_CODE must be a positive integer, got '$VERSION_CODE'" >&2
  exit 1
fi
if ! [[ "$FDROID_KEEP_APKS" =~ ^[0-9]+$ ]] || [ "$FDROID_KEEP_APKS" -lt 1 ]; then
  echo "FDROID_KEEP_APKS must be a positive integer, got '$FDROID_KEEP_APKS'" >&2
  exit 1
fi

for command in git node aapt apksigner unzip fdroid; do
  command -v "$command" >/dev/null || {
    echo "$command is required; install fdroidserver, Java and Android build-tools" >&2
    exit 1
  }
done

ORIGIN_DIR="$(pwd)"
APK_PATH="$APK_SOURCE"
if [ -n "$APK_PATH" ] && [[ "$APK_PATH" != /* ]]; then
  APK_PATH="$ORIGIN_DIR/$APK_PATH"
fi
if [ -z "$APK_PATH" ]; then
  APK_PATH="$ORIGIN_DIR/LifeSpire-${VERSION}.apk"
  if ! gh release download "$TAG" --pattern "LifeSpire-${VERSION}.apk" --output "$APK_PATH"; then
    gh release download "$TAG" --pattern 'app-release.apk' --output "$APK_PATH"
  fi
fi
[ -f "$APK_PATH" ] || {
  echo "APK not found: $APK_PATH" >&2
  exit 1
}

actual_code="$(aapt dump badging "$APK_PATH" | sed -n "s/.* versionCode='\([0-9][0-9]*\)'.*/\1/p" | head -1)"
[ "$actual_code" = "$VERSION_CODE" ] || {
  echo "APK versionCode mismatch: expected $VERSION_CODE, got '${actual_code}'" >&2
  exit 1
}
apksigner verify "$APK_PATH" >/dev/null || {
  echo "APK is not correctly signed" >&2
  exit 1
}

WORK="$(mktemp -d "${RUNNER_TEMP:-/tmp}/lifespire-fdroid.XXXXXX")"
cleanup() {
  git -C "$ORIGIN_DIR" worktree remove --force "$WORK" >/dev/null 2>&1 || rm -rf "$WORK"
}
trap cleanup EXIT

git fetch --tags --force origin
remote_fdroid="$(git ls-remote --heads origin fdroid)" || {
  echo "Could not query origin for the fdroid branch" >&2
  exit 1
}
if [ -n "$remote_fdroid" ]; then
  git fetch --force origin fdroid:refs/remotes/origin/fdroid
  git worktree add --detach "$WORK" origin/fdroid >/dev/null
else
  git worktree add --detach "$WORK" "$TAG" >/dev/null
fi

# One-commit branch: keep the previous tree while regenerating, but start a
# fresh history so old APK blobs do not accumulate in every future clone.
git -C "$WORK" checkout --orphan "fdroid-release-$$" >/dev/null 2>&1
git -C "$WORK" rm -rf --cached . >/dev/null 2>&1 || true
mkdir -p "$WORK/fdroid/repo" "$WORK/fdroid/metadata"

previous_code=0
if [ -f "$WORK/fdroid/repo/index-v2.json" ]; then
  if ! previous_code="$(node "$ORIGIN_DIR/scripts/fdroid-index.mjs" highest \
    "$WORK/fdroid/repo/index-v2.json" "$FDROID_PACKAGE")"; then
    echo "Could not read the previous F-Droid index; refusing to guess its versionCode" >&2
    exit 1
  fi
  [[ "$previous_code" =~ ^[0-9]+$ ]] || previous_code=0
fi

if [ "$VERSION_CODE" -lt "$previous_code" ]; then
  echo "versionCode $VERSION_CODE is lower than the published $previous_code; F-Droid would refuse the update" >&2
  exit 1
fi

cp "$APK_PATH" "$WORK/fdroid/repo/${FDROID_PACKAGE}_${VERSION_CODE}.apk"
git show "$TAG:apps/mobile/assets/icon.png" > "$WORK/fdroid/icon.png"
git show "$TAG:deploy/fdroid/config.yml" > "$WORK/fdroid/config.yml"
git show "$TAG:deploy/fdroid/metadata/com.lifespire.app.yml" \
  > "$WORK/fdroid/metadata/${FDROID_PACKAGE}.yml"
git show "$TAG:deploy/fdroid/index.html" > "$WORK/index.html"
touch "$WORK/.nojekyll"

sed -i "s|^repo_url:.*|repo_url: \"$FDROID_REPO_URL\"|" "$WORK/fdroid/config.yml"
sed -i "s|^repo_keyalias:.*|repo_keyalias: \"$FDROID_KEY_ALIAS\"|" "$WORK/fdroid/config.yml"
grep -q '^keystore:' "$WORK/fdroid/config.yml" || echo 'keystore: "repo.keystore"' >> "$WORK/fdroid/config.yml"

# Keep the repository small enough for GitHub Pages: only the newest APKs.
# Sort by the versionCode embedded in the filename, not mtime: a fresh Git
# checkout gives every old APK the same current mtime.
mapfile -t apks < <(
  for file in "$WORK/fdroid/repo/${FDROID_PACKAGE}_"*.apk; do
    [ -e "$file" ] || continue
    code="${file##*_}"
    code="${code%.apk}"
    printf '%s %s\n' "$code" "$file"
  done | sort -nr | cut -d' ' -f2-
)
for ((index = FDROID_KEEP_APKS; index < ${#apks[@]}; index += 1)); do
  echo "Pruning old APK: ${apks[$index]}"
  rm -f "${apks[$index]}"
done

# fdroidserver reads the passwords from config.yml. Use a throwaway copy so the
# committed file (pushed to the public branch) never carries secrets.
cp "$WORK/fdroid/config.yml" "$WORK/fdroid/config.yml.keep"
chmod 600 "$WORK/fdroid/config.yml"
# JSON.stringify produces a YAML 1.2 double-quoted scalar, so passwords with
# quotes/backslashes/newlines cannot corrupt config.yml.
keystore_password_yaml="$(FDROID_PASSWORD="$FDROID_KEYSTORE_PASSWORD" node -e 'console.log(JSON.stringify(process.env.FDROID_PASSWORD ?? ""))')"
key_password_yaml="$(FDROID_PASSWORD="$FDROID_KEY_PASSWORD" node -e 'console.log(JSON.stringify(process.env.FDROID_PASSWORD ?? ""))')"
{
  printf 'keystorepass: %s\n' "$keystore_password_yaml"
  printf 'keypass: %s\n' "$key_password_yaml"
} >> "$WORK/fdroid/config.yml"
echo "$FDROID_KEYSTORE_BASE64" | base64 -d > "$WORK/fdroid/repo.keystore"
chmod 600 "$WORK/fdroid/repo.keystore"

(cd "$WORK/fdroid" && fdroid update -c)

if ! node "$ORIGIN_DIR/scripts/fdroid-index.mjs" has \
  "$WORK/fdroid/repo/index-v2.json" "$FDROID_PACKAGE" "$VERSION_CODE"; then
  echo "The generated index does not contain versionCode $VERSION_CODE" >&2
  exit 1
fi

mv "$WORK/fdroid/config.yml.keep" "$WORK/fdroid/config.yml"
rm -f "$WORK/fdroid/repo.keystore"
rm -rf "$WORK/fdroid/tmp" "$WORK/fdroid/repo/status"

[ -f "$WORK/fdroid/repo.keystore" ] && {
  echo "repo.keystore was not removed before commit" >&2
  exit 1
}
if grep -qE '^(keystorepass|keypass):' "$WORK/fdroid/config.yml"; then
  echo "config.yml still contains passwords" >&2
  exit 1
fi
[ -f "$WORK/fdroid/repo/index-v2.json" ] || {
  echo "fdroid update did not produce index-v2.json" >&2
  exit 1
}

git -C "$WORK" add -f index.html .nojekyll fdroid
git -C "$WORK" -c user.name="LifeSpire release" -c user.email="lifespire@localhost" \
  commit -m "F-Droid repo for $TAG (versionCode $VERSION_CODE)"
if [ -n "$remote_fdroid" ]; then
  old_sha="$(git rev-parse origin/fdroid)"
  # The branch is generated, but a concurrent release/repair must fail instead of
  # silently dropping the newer APK/index.
  git -C "$WORK" push --force-with-lease=refs/heads/fdroid:"$old_sha" origin HEAD:fdroid
else
  git -C "$WORK" push origin HEAD:fdroid
fi

echo "F-Droid repo updated for $TAG (versionCode $VERSION_CODE)"
echo "Repo: ${FDROID_REPO_URL%/}/"
echo "Index: ${FDROID_REPO_URL%/}/index-v2.json"
