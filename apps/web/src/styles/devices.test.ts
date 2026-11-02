import { describe, expect, it } from 'vitest'
import devicesPanel from '../ui/components/DevicesPanel?raw'
import uiCss from './ui.css?raw'

/**
 * v0.3.0 shipped the device list with `device-*` classes in the JSX but no
 * matching rules in any stylesheet, so the panel rendered as an unstyled list.
 * These tests keep the Bluetooth-style panel styled and guard the layout bugs
 * that made errors and the pairing link look broken.
 */

/** Reads the body of the first rule whose selector is exactly `selector`. */
function readRule(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(?:^|\\n)${escaped} \\{`).exec(source)
  if (!match) throw new Error(`Rule not found: ${selector}`)
  const open = source.indexOf('{', match.index)
  const end = source.indexOf('}', open)
  return source.slice(open + 1, end)
}

describe('nearby devices styles', () => {
  it('styles every device class rendered by the panel', () => {
    const used = new Set(
      Array.from(devicesPanel.matchAll(/\bdevice-[a-z0-9_-]+/g), (match) => match[0]),
    )
    expect(used.size).toBeGreaterThan(0)
    for (const className of used) {
      const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      expect(uiCss).toMatch(new RegExp(`\\.${escaped}(?![\\w-])`))
    }
  })

  it('lets a device error wrap onto its own line', () => {
    expect(readRule(uiCss, '.device-row')).toContain('flex-wrap: wrap')
    const errorStart = uiCss.indexOf('.device-row__error')
    const errorBlock = uiCss.slice(errorStart, uiCss.indexOf('}', errorStart))
    expect(errorBlock).toContain('flex-basis: 100%')
  })

  it('gives the pairing link textarea room for several lines', () => {
    const body = readRule(uiCss, '.pair-link')
    expect(body).toMatch(/height:\s*auto/)
    expect(body).toMatch(/min-height:\s*\d+px/)
  })
})
