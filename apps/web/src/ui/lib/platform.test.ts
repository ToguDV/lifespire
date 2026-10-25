import { describe, expect, it } from 'vitest'
import { isDesktopShell } from './platform'

describe('isDesktopShell', () => {
  it('is true when the Electron bridge marks the renderer as desktop', () => {
    expect(isDesktopShell({ lifespireDesktop: { isDesktop: true } })).toBe(true)
  })

  it('is false in a browser, with a partial bridge or without a scope', () => {
    expect(isDesktopShell({})).toBe(false)
    expect(isDesktopShell({ lifespireDesktop: {} })).toBe(false)
    expect(isDesktopShell({ lifespireDesktop: { isDesktop: false } })).toBe(false)
    expect(isDesktopShell(null)).toBe(false)
    expect(isDesktopShell(undefined)).toBe(false)
  })
})
