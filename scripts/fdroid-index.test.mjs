import assert from 'node:assert/strict'
import test from 'node:test'
import { hasVersionCode, highestVersionCode, versionCodeOf, versionEntries } from './fdroid-index.mjs'

const PACKAGE = 'com.lifespire.app'

const REAL_INDEX = {
  packages: {
    [PACKAGE]: {
      metadata: { name: 'LifeSpire' },
      versions: {
        aaa: {
          added: '2026-11-04',
          file: { name: '/com.lifespire.app_4000.apk', sha256: 'x', size: 1 },
          manifest: { versionCode: 4000, versionName: '0.4.0' },
        },
        bbb: {
          manifest: { versionCode: 5000, versionName: '0.5.0' },
        },
      },
    },
  },
}

test('reads the fdroidserver manifest shape', () => {
  assert.equal(highestVersionCode(REAL_INDEX, PACKAGE), 5000)
  assert.equal(hasVersionCode(REAL_INDEX, PACKAGE, 4000), true)
  assert.equal(hasVersionCode(REAL_INDEX, PACKAGE, 3000), false)
  assert.equal(versionCodeOf(versionEntries(REAL_INDEX, PACKAGE)[0]), 4000)
})

test('accepts the legacy top-level shape', () => {
  const index = {
    packages: {
      [PACKAGE]: {
        versions: [
          { versionCode: 3001, versionName: '0.3.1' },
          { versionCode: 4000, versionName: '0.4.0' },
        ],
      },
    },
  }
  assert.equal(highestVersionCode(index, PACKAGE), 4000)
  assert.equal(hasVersionCode(index, PACKAGE, 4000), true)
})

test('degrades to zero for a missing package or malformed entries', () => {
  assert.equal(highestVersionCode({ packages: {} }, PACKAGE), 0)
  assert.equal(hasVersionCode({ packages: {} }, PACKAGE, 4000), false)
  assert.equal(versionCodeOf({ manifest: { versionCode: '3.5' } }), 0)
  assert.equal(highestVersionCode({ packages: { [PACKAGE]: { versions: {} } } }, PACKAGE), 0)
})
