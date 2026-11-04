import { Linking } from 'react-native'
import {
  checkMobileUpdate,
  compareSemver,
  FDROID_INDEX_URL,
  isNewerVersion,
  isSemver,
  LATEST_MANIFEST_URL,
  normalizeFdroidIndex,
  normalizeReleaseManifest,
  openMobileUpdate,
  openUpdateLink,
} from './update'

function response(value: unknown, ok = true): Response {
  return {
    ok,
    json: async () => value,
  } as unknown as Response
}

function fetchMap(entries: Record<string, unknown | Error>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input)
    const entry = entries[url]
    if (entry instanceof Error) throw entry
    if (entry === undefined) return response(null, false)
    return response(entry)
  }) as typeof fetch
}

const INSTALLED = { versionName: '0.3.1', versionCode: 3001 }

describe('semver helpers', () => {
  it('compares numerically, not lexicographically', () => {
    expect(compareSemver('0.10.0', '0.9.0')).toBe(1)
    expect(compareSemver('0.9.0', '0.10.0')).toBe(-1)
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0)
    expect(isNewerVersion('0.3.1', '0.3.2')).toBe(true)
    expect(isNewerVersion('0.3.1', '0.3.1')).toBe(false)
  })

  it('never reports an update for unparseable versions', () => {
    expect(compareSemver('nightly', '0.4.0')).toBe(0)
    expect(compareSemver('v0.3.1', '0.4.0')).toBe(0)
    expect(isNewerVersion('nightly', '0.4.0')).toBe(false)
    expect(isSemver('0.3.1')).toBe(true)
    expect(isSemver('0.3')).toBe(false)
    expect(isSemver('0.3.1-beta')).toBe(false)
  })
})

describe('normalizeFdroidIndex', () => {
  it('reads the index-v2 object shape and picks the highest versionCode', () => {
    const index = {
      packages: {
        'com.lifespire.app': {
          metadata: { name: 'LifeSpire' },
          versions: {
            aaa: { versionName: '0.3.1', versionCode: 3001 },
            bbb: { versionName: '0.4.0', versionCode: 4000 },
            ccc: { versionName: '0.3.9', versionCode: 3009 },
          },
        },
      },
    }
    expect(normalizeFdroidIndex(index)).toEqual({ version: '0.4.0', versionCode: 4000 })
  })

  it('reads the fdroidserver manifest shape', () => {
    const index = {
      packages: {
        'com.lifespire.app': {
          metadata: { name: 'LifeSpire' },
          versions: {
            aaa: {
              added: '2026-11-04',
              file: { name: '/com.lifespire.app_4000.apk', sha256: 'x', size: 1 },
              manifest: {
                versionCode: 4000,
                versionName: '0.4.0',
                packageName: 'com.lifespire.app',
              },
            },
            bbb: {
              manifest: { versionCode: 5000, versionName: '0.5.0' },
            },
          },
        },
      },
    }
    expect(normalizeFdroidIndex(index)).toEqual({ version: '0.5.0', versionCode: 5000 })
  })

  it('accepts the array fixture shape', () => {
    expect(
      normalizeFdroidIndex({
        packages: {
          'com.lifespire.app': [
            { versionName: '0.4.0', versionCode: 4000 },
            { versionName: '0.5.0', versionCode: 5000 },
          ],
        },
      }),
    ).toEqual({ version: '0.5.0', versionCode: 5000 })
  })

  it('ignores foreign packages, malformed versions and missing codes', () => {
    expect(normalizeFdroidIndex({ packages: {} })).toBeNull()
    expect(
      normalizeFdroidIndex({
        packages: {
          'com.lifespire.app': {
            versions: {
              a: { versionName: 'nightly', versionCode: 9999 },
              b: { versionName: '0.4.0' },
              b2: { versionName: '0.4.1', versionCode: '3.5' },
              b3: { versionName: '0.4.2', versionCode: '4000abc' },
              c: { versionName: '0.5.0', versionCode: 5000 },
            },
          },
          'com.other.app': { versions: [{ versionName: '9.0.0', versionCode: 9000 }] },
        },
      }),
    ).toEqual({ version: '0.5.0', versionCode: 5000 })
  })
})

describe('normalizeReleaseManifest', () => {
  it('keeps a valid version and Android asset', () => {
    expect(
      normalizeReleaseManifest({
        version: '0.4.0',
        tag: 'v0.4.0',
        android: { versionCode: 4000, apk: 'LifeSpire-0.4.0.apk' },
      }),
    ).toEqual({
      version: '0.4.0',
      android: { versionCode: 4000, apk: 'LifeSpire-0.4.0.apk' },
    })
  })

  it('rejects unsafe APK names and bad versions', () => {
    expect(
      normalizeReleaseManifest({
        version: '0.4.0',
        android: { versionCode: 4000, apk: '../../evil.apk' },
      })?.android,
    ).toEqual({ versionCode: 4000, apk: null })
    expect(
      normalizeReleaseManifest({
        version: '0.4.0',
        android: { versionCode: 4000, apk: 'https://evil.example/app.apk' },
      })?.android,
    ).toEqual({ versionCode: 4000, apk: null })
    expect(normalizeReleaseManifest({ version: 'nightly' })).toBeNull()
    expect(normalizeReleaseManifest(null)).toBeNull()
  })
})

describe('checkMobileUpdate', () => {
  it('uses a newer F-Droid entry as the primary source', async () => {
    const check = await checkMobileUpdate({
      installed: INSTALLED,
      fetchImpl: fetchMap({
        [FDROID_INDEX_URL]: {
          packages: {
            'com.lifespire.app': {
              versions: { a: { versionName: '0.4.0', versionCode: 4000 } },
            },
          },
        },
      }),
    })
    expect(check).toEqual({
      status: 'available',
      update: {
        source: 'fdroid',
        version: '0.4.0',
        versionCode: 4000,
        releaseUrl: 'https://github.com/ToguDV/lifespire/releases/tag/v0.4.0',
        apkUrl: null,
      },
    })
  })

  it('stays current when the index is reachable but has no newer version', async () => {
    const fetchImpl = jest.fn(
      fetchMap({
        [FDROID_INDEX_URL]: {
          packages: {
            'com.lifespire.app': {
              versions: { a: { versionName: '0.3.1', versionCode: 3001 } },
            },
          },
        },
      }),
    ) as unknown as typeof fetch
    const check = await checkMobileUpdate({ installed: INSTALLED, fetchImpl })
    expect(check).toEqual({ status: 'current' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('does not fall back to the manifest when the index responds without the package', async () => {
    const fetchImpl = jest.fn(
      fetchMap({
        [FDROID_INDEX_URL]: { packages: {} },
        [LATEST_MANIFEST_URL]: {
          version: '0.9.0',
          android: { versionCode: 9000, apk: 'LifeSpire-0.9.0.apk' },
        },
      }),
    ) as unknown as typeof fetch
    const check = await checkMobileUpdate({ installed: INSTALLED, fetchImpl })
    expect(check).toEqual({ status: 'current' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('falls back to the release manifest when the index is unreachable', async () => {
    const check = await checkMobileUpdate({
      installed: INSTALLED,
      fetchImpl: fetchMap({
        [FDROID_INDEX_URL]: new Error('pages down'),
        [LATEST_MANIFEST_URL]: {
          version: '0.4.0',
          android: { versionCode: 4000, apk: 'LifeSpire-0.4.0.apk' },
        },
      }),
    })
    expect(check).toEqual({
      status: 'available',
      update: {
        source: 'manifest',
        version: '0.4.0',
        versionCode: 4000,
        releaseUrl: 'https://github.com/ToguDV/lifespire/releases/tag/v0.4.0',
        apkUrl:
          'https://github.com/ToguDV/lifespire/releases/download/v0.4.0/LifeSpire-0.4.0.apk',
      },
    })
  })

  it('reports an error only when both sources fail', async () => {
    const check = await checkMobileUpdate({
      installed: INSTALLED,
      fetchImpl: fetchMap({
        [FDROID_INDEX_URL]: new Error('offline'),
        [LATEST_MANIFEST_URL]: new Error('offline'),
      }),
    })
    expect(check).toEqual({ status: 'error' })
  })

  it('ignores a manifest without Android distribution data', async () => {
    const check = await checkMobileUpdate({
      installed: INSTALLED,
      fetchImpl: fetchMap({
        [FDROID_INDEX_URL]: new Error('offline'),
        [LATEST_MANIFEST_URL]: { version: '0.4.0', android: null },
      }),
    })
    expect(check).toEqual({ status: 'current' })
  })

  it('compares semver when the installed build has no meaningful code', async () => {
    const check = await checkMobileUpdate({
      installed: { versionName: '0.3.1', versionCode: 0 },
      fetchImpl: fetchMap({
        [FDROID_INDEX_URL]: {
          packages: {
            'com.lifespire.app': {
              versions: { a: { versionName: '0.4.0', versionCode: 4000 } },
            },
          },
        },
      }),
    })
    expect(check.status).toBe('available')
  })

  it('treats a lower versionCode as current even if the name is newer', async () => {
    const check = await checkMobileUpdate({
      installed: { versionName: '0.4.0', versionCode: 4000 },
      fetchImpl: fetchMap({
        [FDROID_INDEX_URL]: {
          packages: {
            'com.lifespire.app': {
              versions: { a: { versionName: '0.5.0', versionCode: 3999 } },
            },
          },
        },
      }),
    })
    expect(check).toEqual({ status: 'current' })
  })

  it('treats an equal versionCode as current: Android will not install it', async () => {
    const check = await checkMobileUpdate({
      installed: { versionName: '0.4.0', versionCode: 4000 },
      fetchImpl: fetchMap({
        [FDROID_INDEX_URL]: {
          packages: {
            'com.lifespire.app': {
              versions: { a: { versionName: '0.5.0', versionCode: 4000 } },
            },
          },
        },
      }),
    })
    expect(check).toEqual({ status: 'current' })
  })
})

describe('openUpdateLink', () => {
  it('prefers F-Droid when the intent works', async () => {
    const openWebsite = jest.fn(async () => undefined)
    const openFdroid = jest.fn(async () => undefined)
    await expect(openUpdateLink({ openFdroid, openWebsite })).resolves.toBe('fdroid')
    expect(openWebsite).not.toHaveBeenCalled()
  })

  it('opens the landing page when F-Droid is not installed', async () => {
    const openWebsite = jest.fn(async () => undefined)
    const openFdroid = jest.fn(async () => {
      throw new Error('no activity')
    })
    await expect(openUpdateLink({ openFdroid, openWebsite })).resolves.toBe('website')
    expect(openWebsite).toHaveBeenCalledTimes(1)
  })
})

describe('openMobileUpdate', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('opens the direct APK for a manifest fallback', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockImplementation(async () => undefined)
    await openMobileUpdate({
      source: 'manifest',
      version: '0.4.0',
      versionCode: 4000,
      releaseUrl: 'https://github.com/ToguDV/lifespire/releases/tag/v0.4.0',
      apkUrl: 'https://github.com/ToguDV/lifespire/releases/download/v0.4.0/LifeSpire-0.4.0.apk',
    })
    expect(openURL).toHaveBeenCalledWith(
      'https://github.com/ToguDV/lifespire/releases/download/v0.4.0/LifeSpire-0.4.0.apk',
    )
  })

  it('falls back to the release page when the manifest carries no APK name', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockImplementation(async () => undefined)
    await openMobileUpdate({
      source: 'manifest',
      version: '0.4.0',
      versionCode: 4000,
      releaseUrl: 'https://github.com/ToguDV/lifespire/releases/tag/v0.4.0',
      apkUrl: null,
    })
    expect(openURL).toHaveBeenCalledWith(
      'https://github.com/ToguDV/lifespire/releases/tag/v0.4.0',
    )
  })
})
