import { Linking } from 'react-native'

/**
 * Android update channel: a self-hosted F-Droid repository served from GitHub
 * Pages. The app only compares versions and deep-links into F-Droid; it never
 * downloads or installs an APK itself (no `REQUEST_INSTALL_PACKAGES`).
 */
export const FDROID_PACKAGE = 'com.lifespire.app'
/** F-Droid client package that receives the market:// listing intent. */
export const FDROID_CLIENT_PACKAGE = 'org.fdroid.fdroid'
export const FDROID_REPO_URL = 'https://togudv.github.io/lifespire/fdroid/repo/'
export const FDROID_INDEX_URL = `${FDROID_REPO_URL}index-v2.json`
export const FDROID_WEBSITE_URL = 'https://togudv.github.io/lifespire/'
export const FDROID_MARKET_URL = `market://details?id=${FDROID_PACKAGE}`
/** Fallback when GitHub Pages is unreachable: the release manifest. */
export const LATEST_MANIFEST_URL =
  'https://github.com/ToguDV/lifespire/releases/latest/download/version.json'
export const RELEASES_URL = 'https://github.com/ToguDV/lifespire/releases'

export interface InstalledVersion {
  versionName: string
  versionCode: number
}

export type UpdateSource = 'fdroid' | 'manifest'

export interface MobileUpdate {
  source: UpdateSource
  version: string
  versionCode: number | null
  /** GitHub release page; also the fallback when the manifest has no APK. */
  releaseUrl: string
  /** Direct APK asset from the release manifest (never set for F-Droid). */
  apkUrl: string | null
}

export type MobileUpdateCheck =
  | { status: 'available'; update: MobileUpdate }
  | { status: 'current' }
  | { status: 'error' }

const APK_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.apk$/

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function parseSemver(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim())
  if (!match) return null
  const parts = [match[1], match[2], match[3]].map((part) => Number.parseInt(part ?? '', 10))
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null
  return parts as [number, number, number]
}

/** True when the string is a plain `major.minor.patch` version. */
export function isSemver(version: string): boolean {
  return parseSemver(version) !== null
}

/**
 * Numeric comparison (`0.10.0` beats `0.9.0`). Unparseable input compares
 * equal so a malformed manifest can never create a phantom update.
 */
export function compareSemver(a: string, b: string): number {
  const left = parseSemver(a)
  const right = parseSemver(b)
  if (!left || !right) return 0
  for (let index = 0; index < 3; index += 1) {
    const current = left[index] ?? 0
    const next = right[index] ?? 0
    if (current !== next) return current < next ? -1 : 1
  }
  return 0
}

export function isNewerVersion(current: string, latest: string): boolean {
  return compareSemver(current, latest) < 0
}

function parseVersionCode(value: unknown): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : Number.NaN
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function safeApkName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.trim()
  if (name.length > 128 || name.includes('..') || !APK_NAME.test(name)) return null
  return name
}

export interface FdroidRelease {
  version: string
  versionCode: number
}

/**
 * Tolerant `index-v2.json` reader. Picks the highest versionCode for the
 * package. Anything without a usable entry is null (no notice), never an
 * error.
 */
export function normalizeFdroidIndex(value: unknown): FdroidRelease | null {
  const packageValue = asRecord(asRecord(value)?.packages)?.[FDROID_PACKAGE]
  // index-v2 real shape:
  // { packages: { <pkg>: { versions: { <hash>: { versionName, versionCode } } } } }.
  // Older fixtures use an array of versions; accept both.
  const versions = asRecord(packageValue)?.versions ?? packageValue
  const entries = Array.isArray(versions) ? versions : Object.values(asRecord(versions) ?? {})
  let best: FdroidRelease | null = null
  for (const entry of entries) {
    const record = asRecord(entry)
    // fdroidserver writes each version as
    // { added, file, manifest: { versionCode, versionName, ... } }; older
    // fixtures (and some third-party indexes) keep the fields at the top level.
    const manifest = asRecord(record?.manifest)
    const versionNameValue = manifest?.versionName ?? record?.versionName
    const versionCodeValue = manifest?.versionCode ?? record?.versionCode
    const versionName = typeof versionNameValue === 'string' ? versionNameValue.trim() : ''
    const versionCode = parseVersionCode(versionCodeValue)
    if (!isSemver(versionName) || versionCode === null) continue
    if (
      !best ||
      versionCode > best.versionCode ||
      (versionCode === best.versionCode && compareSemver(versionName, best.version) > 0)
    ) {
      best = { version: versionName, versionCode }
    }
  }
  return best
}

export interface ReleaseManifest {
  version: string
  android: { versionCode: number | null; apk: string | null } | null
}

/**
 * Tolerant `version.json` reader (the fallback when the Pages index is
 * unreachable). A version without Android distribution data is still returned,
 * but callers must not announce an update without it.
 */
export function normalizeReleaseManifest(value: unknown): ReleaseManifest | null {
  const record = asRecord(value)
  const version = record && typeof record.version === 'string' ? record.version.trim() : ''
  if (!isSemver(version)) return null

  const androidRecord = asRecord(record?.android)
  const android = androidRecord
    ? {
        versionCode: parseVersionCode(androidRecord.versionCode),
        apk: safeApkName(androidRecord.apk),
      }
    : null

  return { version, android }
}

type FetchResult = { ok: true; value: unknown } | { ok: false }

async function fetchJson(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<FetchResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return { ok: false }
    const value: unknown = await response.json()
    return { ok: true, value }
  } catch {
    return { ok: false }
  } finally {
    clearTimeout(timer)
  }
}

function isNewer(
  installed: InstalledVersion,
  version: string,
  versionCode: number | null,
): boolean {
  // versionCode is the F-Droid authority; semver is the fallback when the
  // installed build does not expose a meaningful code (Expo Go/dev baselines).
  // Equal codes are current: Android would not install another APK with the
  // same versionCode even if the version name is newer.
  if (installed.versionCode > 0 && versionCode !== null) {
    return versionCode > installed.versionCode
  }
  return isNewerVersion(installed.versionName, version)
}

function releaseUrlFor(version: string): string {
  return `${RELEASES_URL}/tag/v${version}`
}

function apkUrlFor(version: string, apk: string | null): string | null {
  return apk ? `${RELEASES_URL}/download/v${version}/${apk}` : null
}

export interface UpdateCheckOptions {
  installed: InstalledVersion
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

/**
 * F-Droid index first (the distribution channel), then the GitHub release
 * manifest when Pages is unreachable. A reachable index with no newer package
 * means "current": it must not be overridden by a manifest whose repo step has
 * not run yet.
 */
export async function checkMobileUpdate(options: UpdateCheckOptions): Promise<MobileUpdateCheck> {
  const { installed, fetchImpl = fetch, timeoutMs = 10_000 } = options

  const index = await fetchJson(FDROID_INDEX_URL, fetchImpl, timeoutMs)
  if (index.ok) {
    const release = normalizeFdroidIndex(index.value)
    if (!release) return { status: 'current' }
    if (!isNewer(installed, release.version, release.versionCode)) return { status: 'current' }
    return {
      status: 'available',
      update: {
        source: 'fdroid',
        version: release.version,
        versionCode: release.versionCode,
        releaseUrl: releaseUrlFor(release.version),
        apkUrl: null,
      },
    }
  }

  const manifest = await fetchJson(LATEST_MANIFEST_URL, fetchImpl, timeoutMs)
  if (!manifest.ok) return { status: 'error' }

  const release = normalizeReleaseManifest(manifest.value)
  if (!release?.android) return { status: 'current' }
  if (release.android.versionCode === null && release.android.apk === null) {
    return { status: 'current' }
  }
  if (!isNewer(installed, release.version, release.android.versionCode)) {
    return { status: 'current' }
  }
  return {
    status: 'available',
    update: {
      source: 'manifest',
      version: release.version,
      versionCode: release.android.versionCode,
      releaseUrl: releaseUrlFor(release.version),
      apkUrl: apkUrlFor(release.version, release.android.apk),
    },
  }
}

export interface UpdateLinkActions {
  openFdroid(): Promise<unknown>
  openWebsite(): Promise<unknown>
}

/**
 * Prefers the F-Droid listing and falls back to the repo landing page when the
 * client is not installed (or the intent cannot be resolved).
 */
export async function openUpdateLink(actions: UpdateLinkActions): Promise<'fdroid' | 'website'> {
  try {
    await actions.openFdroid()
    return 'fdroid'
  } catch {
    await actions.openWebsite()
    return 'website'
  }
}

/** Opens the app in F-Droid, or the landing page when F-Droid is absent. */
export async function openFdroidListing(): Promise<void> {
  await openUpdateLink({
    openFdroid: async () => {
      // Loaded on demand so an Expo Go runtime without the module degrades to
      // the landing page instead of failing while the bundle boots.
      const { startActivityAsync } = await import('expo-intent-launcher')
      await startActivityAsync('android.intent.action.VIEW', {
        data: FDROID_MARKET_URL,
        packageName: FDROID_CLIENT_PACKAGE,
      })
    },
    openWebsite: () => Linking.openURL(FDROID_WEBSITE_URL),
  })
}

/**
 * Chooses the action for an available update: F-Droid when the repository index
 * produced it, the GitHub release/APK when the manifest fallback did.
 */
export async function openMobileUpdate(update: MobileUpdate): Promise<void> {
  if (update.source === 'fdroid') {
    await openFdroidListing()
    return
  }
  await Linking.openURL(update.apkUrl ?? update.releaseUrl)
}

/** Landing page with the repository URL and add-repo instructions. */
export async function openFdroidWebsite(): Promise<void> {
  await Linking.openURL(FDROID_WEBSITE_URL)
}
