import { describe, expect, it } from 'vitest'
import tokensCss from './tokens.css?raw'
import appCss from './app.css?raw'
import uiCss from './ui.css?raw'

/**
 * The completed node medallion used to be filled with `--ink`. That works in
 * Day, where ink is near black, but in Night `--ink` is the text colour — a
 * warm off-white — so a finished node became a glaring white disc on the
 * night canvas. These tests lock the token contract that prevents it.
 */

/** Reads the declarations of the first block that starts with `header`. */
function readBlock(source: string, header: string): Record<string, string> {
  const start = source.indexOf(header)
  if (start === -1) throw new Error(`Block not found: ${header}`)
  const open = source.indexOf('{', start)
  let depth = 0
  let end = open
  for (; end < source.length; end += 1) {
    if (source[end] === '{') depth += 1
    else if (source[end] === '}') {
      depth -= 1
      if (depth === 0) break
    }
  }
  const vars: Record<string, string> = {}
  for (const match of source.slice(open + 1, end).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    vars[match[1]] = match[2].trim()
  }
  return vars
}

/** Reads the body of the first rule whose selector is exactly `selector`. */
function readRule(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`Rule not found: ${selector}`)
  const open = source.indexOf('{', start)
  const end = source.indexOf('}', open)
  return source.slice(open + 1, end)
}

function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '')
  const channels = [0, 2, 4].map((offset) => {
    const raw = parseInt(value.slice(offset, offset + 2), 16) / 255
    return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrast(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background))
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

const day = readBlock(tokensCss, ':root')
const night = readBlock(tokensCss, 'html[data-theme="dark"]')
const autoNight = readBlock(tokensCss, 'html:not([data-theme])')

describe('completed node tokens', () => {
  it('defines the done tokens in every theme', () => {
    for (const vars of [day, night, autoNight]) {
      expect(vars['--done-fill']).toMatch(/^#[0-9a-f]{6}$/)
      expect(vars['--done-rim']).toMatch(/^#[0-9a-f]{6}$/)
      expect(vars['--done-ink']).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('never paints a completed node with the text ink', () => {
    expect(night['--done-fill']).not.toBe(night['--ink'])
    expect(night['--done-rim']).not.toBe(night['--ink'])
  })

  it('keeps the night completed node darker than the night text ink', () => {
    expect(relativeLuminance(night['--done-fill'])).toBeLessThan(
      relativeLuminance(night['--ink']),
    )
  })

  it('keeps the day completed node exactly as it was', () => {
    expect(day['--done-fill']).toBe(day['--ink'])
    expect(day['--done-rim']).toBe(day['--ink'])
    expect(day['--done-ink']).toBe(day['--canvas'])
  })

  it('resolves the same night values when the system asks for dark', () => {
    expect(autoNight['--done-fill']).toBe(night['--done-fill'])
    expect(autoNight['--done-rim']).toBe(night['--done-rim'])
    expect(autoNight['--done-ink']).toBe(night['--done-ink'])
  })

  it('keeps the completed glyph readable on the completed fill', () => {
    expect(contrast(night['--done-ink'], night['--done-fill'])).toBeGreaterThanOrEqual(4.5)
    expect(contrast(day['--done-ink'], day['--done-fill'])).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the night completed node visible against the night canvas', () => {
    expect(contrast(night['--done-rim'], night['--canvas'])).toBeGreaterThan(1.5)
  })
})

describe('completed node consumers', () => {
  const rules: Array<[source: string, selector: string]> = [
    [appCss, '.node--done .medallion'],
    [appCss, '.path-row__medallion.is-done'],
    [appCss, '.welcome-art .art-node--done'],
    [uiCss, '.node--boss.node--done .boss-frame polygon'],
    [uiCss, '.node--boss.node--done .medallion'],
  ]

  it.each(rules.map(([source, selector]) => ({ source, selector })))(
    '$selector uses the done tokens',
    ({ source, selector }) => {
      const body = readRule(source, selector)
      expect(body).not.toContain('var(--ink)')
      expect(body).not.toContain('var(--canvas)')
    },
  )

  it('fills the map medallion with the done fill', () => {
    expect(readRule(appCss, '.node--done .medallion')).toContain('var(--done-fill)')
  })
})
