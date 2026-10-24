import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FEEDBACK_PREFS_KEY,
  getFeedbackPrefs,
  HAPTIC_PATTERNS,
  playFeedback,
  resetFeedbackPrefs,
  setFeedbackPrefs,
  type FeedbackKind,
} from './feedback'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
    clear: () => values.clear(),
  }
}

function stubWindow(options: { matchMobile: boolean; vibrate?: () => boolean }) {
  const storage = memoryStorage()
  const win = {
    localStorage: storage,
    matchMedia: vi.fn(() => ({ matches: options.matchMobile })),
    navigator: options.vibrate ? { vibrate: options.vibrate } : {},
  } as unknown as Window & typeof globalThis
  vi.stubGlobal('window', win)
  vi.stubGlobal('navigator', win.navigator)
  vi.stubGlobal('matchMedia', win.matchMedia)
  return { storage, win }
}

describe('feedback prefs', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    stubWindow({ matchMobile: false })
    resetFeedbackPrefs()
  })

  it('defaults to sound and haptics on', () => {
    expect(getFeedbackPrefs()).toEqual({ sound: true, haptics: true })
  })

  it('persists toggles to localStorage', () => {
    const { storage } = stubWindow({ matchMobile: false })
    resetFeedbackPrefs()
    setFeedbackPrefs({ sound: false })
    expect(getFeedbackPrefs().sound).toBe(false)
    expect(storage.getItem(FEEDBACK_PREFS_KEY)).toContain('"sound":false')
    setFeedbackPrefs({ haptics: false })
    expect(getFeedbackPrefs()).toEqual({ sound: false, haptics: false })
  })

  it('tolerates corrupt prefs and falls back to defaults', () => {
    const { storage } = stubWindow({ matchMobile: false })
    storage.setItem(FEEDBACK_PREFS_KEY, 'not-json{')
    resetFeedbackPrefs()
    expect(getFeedbackPrefs()).toEqual({ sound: true, haptics: true })
  })
})

describe('haptic patterns', () => {
  it('defines a pattern for every feedback kind, silent for skip', () => {
    const kinds: FeedbackKind[] = [
      'select',
      'complete',
      'elite',
      'treasure',
      'rest',
      'skip',
      'wheelTick',
      'wheelReveal',
      'lootCommon',
      'lootRare',
      'lootEpic',
      'levelUp',
      'seal',
      'bossUnlock',
    ]
    for (const kind of kinds) {
      expect(kind in HAPTIC_PATTERNS).toBe(true)
    }
    expect(HAPTIC_PATTERNS.skip).toEqual([])
    expect(HAPTIC_PATTERNS.wheelTick).toEqual([])
  })
})

describe('playFeedback', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not throw when audio is unavailable', () => {
    stubWindow({ matchMobile: false })
    resetFeedbackPrefs()
    expect(() => playFeedback('complete')).not.toThrow()
    expect(() => playFeedback('levelUp')).not.toThrow()
  })

  it('vibrates on mobile when haptics are enabled', () => {
    const vibrate = vi.fn(() => true)
    stubWindow({ matchMobile: true, vibrate })
    resetFeedbackPrefs()
    playFeedback('complete')
    expect(vibrate).toHaveBeenCalled()
  })

  it('never vibrates when haptics are disabled, even on mobile', () => {
    const vibrate = vi.fn(() => true)
    stubWindow({ matchMobile: true, vibrate })
    resetFeedbackPrefs()
    setFeedbackPrefs({ haptics: false })
    playFeedback('elite')
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('never vibrates on desktop viewports', () => {
    const vibrate = vi.fn(() => true)
    stubWindow({ matchMobile: false, vibrate })
    resetFeedbackPrefs()
    setFeedbackPrefs({ haptics: true })
    playFeedback('complete')
    expect(vibrate).not.toHaveBeenCalled()
  })
})
