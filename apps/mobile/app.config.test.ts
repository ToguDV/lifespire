import type { ConfigContext } from 'expo/config'
import config, { versionCodeFor } from './app.config'
import manifest from './package.json'

describe('app config version', () => {
  it('takes the version from the mobile manifest', () => {
    const resolved = config({ config: {} } as ConfigContext)
    expect(resolved.version).toBe(manifest.version)
    expect(resolved.android?.versionCode).toBe(versionCodeFor(manifest.version))
  })

  it('keeps versionCode monotonic across semantic versions', () => {
    expect(versionCodeFor('0.1.0')).toBe(1000)
    expect(versionCodeFor('0.1.1')).toBe(1001)
    expect(versionCodeFor('0.2.0')).toBe(2000)
    expect(versionCodeFor('1.0.0')).toBe(1_000_000)
    expect(versionCodeFor('1.0.0')).toBeGreaterThan(versionCodeFor('0.9.9'))
  })

  it('falls back to the base version for malformed input', () => {
    expect(versionCodeFor('nightly')).toBe(1000)
    expect(versionCodeFor('1.0')).toBe(1000)
    expect(versionCodeFor('1.0.0.0')).toBe(1000)
    expect(versionCodeFor('1.1000.0')).toBe(1000)
    expect(versionCodeFor('v0.2.0')).toBe(1000)
  })
})
