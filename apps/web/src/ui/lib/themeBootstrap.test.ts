import { STORAGE_KEY } from '@lifespire/core'
import { describe, expect, it } from 'vitest'
import indexHtml from '../../../index.html?raw'
import themeScript from '../../../public/theme.js?raw'

describe('theme bootstrap', () => {
  it('loads an external script so the API CSP can stay script-src self', () => {
    expect(indexHtml).toContain('<script src="/theme.js"></script>')
    expect(indexHtml).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i)
  })

  it('runs before the app module', () => {
    expect(indexHtml.indexOf('/theme.js')).toBeLessThan(indexHtml.indexOf('/src/main.tsx'))
  })

  it('reads the same save key as the app', () => {
    expect(themeScript).toContain(STORAGE_KEY)
  })
})
