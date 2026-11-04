#!/usr/bin/env bash
#
# Regression test for scripts/verify-android-apk.sh. `bash -n` cannot catch the
# ABI/pipefail bug this test was added for, so exercise the real script with a
# synthetic APK and fake aapt/apksigner commands.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/lifespire-verify-apk.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/bin"
cat > "$WORK/bin/aapt" <<'EOF'
#!/usr/bin/env bash
echo "package: name='com.lifespire.app' versionCode='4000' versionName='${FAKE_VERSION:-0.4.0}'"
EOF
cat > "$WORK/bin/apksigner" <<'EOF'
#!/usr/bin/env bash
echo "Signer #1 certificate SHA-256 digest: 209d9fd8e940df5a8bcdcc6f04ace0332ada901050559ef8e5b4bab5703e4c22"
EOF
chmod +x "$WORK/bin/"*

python3 - "$WORK/arm.apk" "$WORK/x86.apk" <<'PY'
import sys
import zipfile

arm, x86 = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(arm, "w") as archive:
    archive.writestr("lib/arm64-v8a/libfoo.so", b"x")
    # A long listing is what used to trigger the unzip|grep -q SIGPIPE under
    # pipefail; a two-entry fixture would not reproduce it.
    for index in range(3000):
        archive.writestr(f"assets/padding-{index}.txt", b"x")
with zipfile.ZipFile(x86, "w") as archive:
    archive.writestr("lib/arm64-v8a/libfoo.so", b"x")
    archive.writestr("lib/x86/libfoo.so", b"x")
PY

CERT=209d9fd8e940df5a8bcdcc6f04ace0332ada901050559ef8e5b4bab5703e4c22
run_verify() {
  PATH="$WORK/bin:$PATH" ANDROID_APP_CERT_SHA256="$CERT" \
    bash "$ROOT/scripts/verify-android-apk.sh" "$@"
}

run_verify "$WORK/arm.apk" v0.4.0 >/dev/null
echo "verify-android-apk: ARM APK accepted"

if run_verify "$WORK/x86.apk" v0.4.0 >/dev/null 2>&1; then
  echo "verify-android-apk: x86 APK was accepted" >&2
  exit 1
fi
echo "verify-android-apk: x86 APK rejected"

if FAKE_VERSION=0.4.1 run_verify "$WORK/arm.apk" v0.4.0 >/dev/null 2>&1; then
  echo "verify-android-apk: wrong versionName was accepted" >&2
  exit 1
fi
echo "verify-android-apk: wrong versionName rejected"
