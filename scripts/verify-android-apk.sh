#!/usr/bin/env bash
#
# Verify the APK that will be attached to the GitHub release and copied into the
# F-Droid repository. Fails before publishing when the tag, versionCode, ABI
# set, size or signing certificate drift from the expected release identity.
#
# Usage: scripts/verify-android-apk.sh <apk> <tag>
# Required: ANDROID_APP_CERT_SHA256 (the EAS-managed app certificate fingerprint)
# Optional: APK_MAX_BYTES (default 100000000, below GitHub's 100 MiB limit)
set -euo pipefail

APK="${1:?usage: verify-android-apk.sh <apk> <tag>}"
TAG="${2:?tag is required}"
EXPECTED_VERSION="${TAG#v}"
EXPECTED_CERT="${ANDROID_APP_CERT_SHA256:?ANDROID_APP_CERT_SHA256 is required}"
MAX_BYTES="${APK_MAX_BYTES:-100000000}"
PACKAGE="com.lifespire.app"

[ -f "$APK" ] || {
  echo "APK not found: $APK" >&2
  exit 1
}
command -v aapt >/dev/null || {
  echo "aapt is required (install Android build-tools)" >&2
  exit 1
}
command -v apksigner >/dev/null || {
  echo "apksigner is required (install Android build-tools)" >&2
  exit 1
}
command -v unzip >/dev/null || {
  echo "unzip is required" >&2
  exit 1
}

badging="$(aapt dump badging "$APK")"
actual_package="$(printf '%s\n' "$badging" | sed -n "s/^package: name='\([^']*\)'.*/\1/p" | head -1)"
version_code="$(printf '%s\n' "$badging" | sed -n "s/.* versionCode='\([0-9][0-9]*\)'.*/\1/p" | head -1)"
version_name="$(printf '%s\n' "$badging" | sed -n "s/.* versionName='\([^']*\)'.*/\1/p" | head -1)"

[ "$actual_package" = "$PACKAGE" ] || {
  echo "package mismatch: expected $PACKAGE, got '${actual_package}'" >&2
  exit 1
}
[ "$version_name" = "$EXPECTED_VERSION" ] || {
  echo "versionName mismatch: expected $EXPECTED_VERSION, got '${version_name}'" >&2
  exit 1
}

IFS=. read -r major minor patch <<< "$EXPECTED_VERSION"
if ! [[ "$major" =~ ^[0-9]+$ && "$minor" =~ ^[0-9]+$ && "$patch" =~ ^[0-9]+$ ]]; then
  echo "tag $TAG does not carry a numeric major.minor.patch version" >&2
  exit 1
fi
expected_code=$((10#$major * 1000000 + 10#$minor * 1000 + 10#$patch))
[ "$version_code" -eq "$expected_code" ] || {
  echo "versionCode mismatch: expected $expected_code from $TAG, got $version_code" >&2
  exit 1
}

size="$(wc -c < "$APK" | tr -d '[:space:]')"
if [ "$size" -ge "$MAX_BYTES" ]; then
  echo "APK is $size bytes; the release limit is $MAX_BYTES (GitHub rejects files over 100 MiB)" >&2
  exit 1
fi

listing="$(unzip -Z1 "$APK")"
if grep -qE '^lib/(x86|x86_64)/' <<< "$listing"; then
  echo "APK contains x86/x86_64 libraries; release builds must be arm64-v8a/armeabi-v7a only" >&2
  exit 1
fi
if ! grep -q '^lib/arm64-v8a/' <<< "$listing"; then
  echo "APK is missing arm64-v8a libraries" >&2
  exit 1
fi

cert_line="$(apksigner verify --print-certs "$APK" | grep -m1 'SHA-256 digest:' || true)"
actual_cert="$(printf '%s' "$cert_line" | sed -n 's/.*SHA-256 digest: //p' | tr -d ':' | tr 'A-Z' 'a-z')"
expected_cert="$(printf '%s' "$EXPECTED_CERT" | tr -d ':' | tr 'A-Z' 'a-z')"
if [ -z "$actual_cert" ] || [ "$actual_cert" != "$expected_cert" ]; then
  echo "APK signing certificate mismatch: expected $expected_cert, got '${actual_cert:-unsigned}'" >&2
  echo "If the EAS keystore changed, existing installs cannot update; stop and review the signing lineage." >&2
  exit 1
fi

echo "APK verified: $PACKAGE $version_name ($version_code), ${size} bytes, cert $actual_cert"

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  {
    echo "version-code=$version_code"
    echo "version-name=$version_name"
    echo "apk-size=$size"
    echo "apk-cert-sha256=$actual_cert"
  } >> "$GITHUB_OUTPUT"
fi
