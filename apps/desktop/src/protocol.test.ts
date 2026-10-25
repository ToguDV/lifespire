import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  APP_HOST,
  APP_ORIGIN,
  APP_SCHEME,
  buildAppUrl,
  isExternalWebUrl,
  isInternalNavigation,
  PWA_SCRIPT_PATHS,
  resolveAssetPath,
} from './protocol'

const ROOT = path.resolve('/opt/lifespire/resources/web')
const DEV_URL = 'http://localhost:5173'

describe('resolveAssetPath', () => {
  it('serves index.html for the bare origin', () => {
    expect(resolveAssetPath(ROOT, `${APP_ORIGIN}/`)).toBe(path.join(ROOT, 'index.html'))
    expect(resolveAssetPath(ROOT, APP_ORIGIN)).toBe(path.join(ROOT, 'index.html'))
  })

  it('maps nested build files under the web root', () => {
    expect(resolveAssetPath(ROOT, `${APP_ORIGIN}/assets/index-abc.js`)).toBe(
      path.join(ROOT, 'assets', 'index-abc.js'),
    )
    expect(resolveAssetPath(ROOT, `${APP_ORIGIN}/fonts/alegreya.woff2`)).toBe(
      path.join(ROOT, 'fonts', 'alegreya.woff2'),
    )
  })

  it('ignores query strings and fragments', () => {
    expect(resolveAssetPath(ROOT, `${APP_ORIGIN}/index.html?theme=dark#top`)).toBe(
      path.join(ROOT, 'index.html'),
    )
  })

  it('decodes percent-encoded file names', () => {
    expect(resolveAssetPath(ROOT, `${APP_ORIGIN}/fonts/alegreya%20sans.woff2`)).toBe(
      path.join(ROOT, 'fonts', 'alegreya sans.woff2'),
    )
  })

  it('normalizes dot segments inside the root', () => {
    expect(resolveAssetPath(ROOT, `${APP_ORIGIN}/assets/../icons/icon-512.png`)).toBe(
      path.join(ROOT, 'icons', 'icon-512.png'),
    )
  })

  it('rejects paths that escape the web root', () => {
    expect(resolveAssetPath(ROOT, `${APP_ORIGIN}/..%2F..%2Fetc/passwd`)).toBeNull()
    expect(resolveAssetPath(ROOT, `${APP_ORIGIN}/..%2Fsecrets.json`)).toBeNull()
  })

  it('rejects other origins and malformed URLs', () => {
    expect(resolveAssetPath(ROOT, 'https://example.com/index.html')).toBeNull()
    expect(resolveAssetPath(ROOT, `${APP_SCHEME}://other/index.html`)).toBeNull()
    expect(resolveAssetPath(ROOT, 'not a url')).toBeNull()
  })

  it('trims a trailing separator from the configured root', () => {
    expect(resolveAssetPath(`${ROOT}${path.sep}`, `${APP_ORIGIN}/index.html`)).toBe(
      path.join(ROOT, 'index.html'),
    )
  })
})

describe('buildAppUrl', () => {
  it('builds absolute URLs on the packaged origin', () => {
    expect(buildAppUrl()).toBe(`${APP_ORIGIN}/index.html`)
    expect(buildAppUrl('index.html')).toBe(`${APP_ORIGIN}/index.html`)
    expect(buildAppUrl('/icons/icon-512.png')).toBe(`${APP_ORIGIN}/icons/icon-512.png`)
  })
})

describe('isInternalNavigation', () => {
  const packaged = { isPackaged: true, devUrl: DEV_URL }
  const development = { isPackaged: false, devUrl: DEV_URL }

  it('allows the app protocol only in packaged builds', () => {
    expect(isInternalNavigation(buildAppUrl(), packaged)).toBe(true)
    expect(isInternalNavigation(`${APP_SCHEME}://elsewhere/index.html`, packaged)).toBe(false)
  })

  it('allows the dev server origin while developing', () => {
    expect(isInternalNavigation(`${DEV_URL}/map`, development)).toBe(true)
    expect(isInternalNavigation('http://localhost:6006/map', development)).toBe(false)
    expect(isInternalNavigation(`${DEV_URL}/map`, packaged)).toBe(false)
  })

  it('always rejects non-web schemes', () => {
    expect(isInternalNavigation('javascript:alert(1)', development)).toBe(false)
    expect(isInternalNavigation('javascript:alert(1)', packaged)).toBe(false)
    expect(isInternalNavigation('nonsense', packaged)).toBe(false)
  })
})

describe('isExternalWebUrl', () => {
  it('accepts http(s) links only', () => {
    expect(isExternalWebUrl('https://github.com/ToguDV/lifespire')).toBe(true)
    expect(isExternalWebUrl('http://localhost:5173')).toBe(true)
    expect(isExternalWebUrl('file:///etc/passwd')).toBe(false)
    expect(isExternalWebUrl('mailto:hello@lifespire.app')).toBe(false)
    expect(isExternalWebUrl('nonsense')).toBe(false)
  })
})

describe('PWA_SCRIPT_PATHS', () => {
  it('covers the generated service worker entry points', () => {
    expect(PWA_SCRIPT_PATHS.has('/registerSW.js')).toBe(true)
    expect(PWA_SCRIPT_PATHS.has('/sw.js')).toBe(true)
  })

  it('does not shadow real assets', () => {
    expect(PWA_SCRIPT_PATHS.has('/index.html')).toBe(false)
    expect(PWA_SCRIPT_PATHS.has('/icons/icon-512.png')).toBe(false)
    expect(APP_HOST).toBe('app')
  })
})
