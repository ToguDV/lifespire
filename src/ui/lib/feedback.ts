/**
 * Quiet feedback engine: one soft WebAudio synth plus mobile-only haptics.
 *
 * Sound and haptics default to ON and are toggleable in Settings. Prefs live
 * outside the versioned GameDocument (no schema migration) under a dedicated
 * localStorage key. Everything here is UI-only: the domain never imports it.
 */

import { useSyncExternalStore } from 'react'

export type FeedbackKind =
  | 'select'
  | 'complete'
  | 'elite'
  | 'treasure'
  | 'rest'
  | 'skip'
  | 'wheelTick'
  | 'wheelReveal'
  | 'lootCommon'
  | 'lootRare'
  | 'lootEpic'
  | 'levelUp'
  | 'seal'
  | 'bossUnlock'

export interface FeedbackPrefs {
  sound: boolean
  haptics: boolean
}

export const FEEDBACK_PREFS_KEY = 'lifespire:feedback-prefs'

const DEFAULT_PREFS: FeedbackPrefs = { sound: true, haptics: true }

/** Haptic patterns in milliseconds. Empty means silent (skip, wheel ticks). */
export const HAPTIC_PATTERNS: Record<FeedbackKind, number[]> = {
  select: [8],
  complete: [15],
  elite: [15, 40, 25],
  treasure: [12, 30, 12],
  rest: [20],
  skip: [],
  wheelTick: [],
  wheelReveal: [20, 30, 20],
  lootCommon: [12],
  lootRare: [12, 30, 18],
  lootEpic: [15, 40, 25, 40, 30],
  levelUp: [20, 50, 30, 50, 40],
  seal: [25, 40, 25],
  bossUnlock: [15, 40, 20],
}

type PrefsStore = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function prefsStorage(): PrefsStore | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
  } catch {
    return null
  }
  return null
}

let cached: FeedbackPrefs | null = null
const listeners = new Set<() => void>()

function readStored(): FeedbackPrefs {
  const storage = prefsStorage()
  if (!storage) return { ...DEFAULT_PREFS }
  try {
    const raw = storage.getItem(FEEDBACK_PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed = JSON.parse(raw) as Partial<FeedbackPrefs>
    return {
      sound: typeof parsed.sound === 'boolean' ? parsed.sound : DEFAULT_PREFS.sound,
      haptics: typeof parsed.haptics === 'boolean' ? parsed.haptics : DEFAULT_PREFS.haptics,
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

function emit(): void {
  for (const listener of listeners) listener()
}

export function getFeedbackPrefs(): FeedbackPrefs {
  return { ...snapshot() }
}

/** Test hook: forget the in-memory copy so the next read hits storage. */
export function resetFeedbackPrefs(): void {
  cached = null
  emit()
}

export function setFeedbackPrefs(patch: Partial<FeedbackPrefs>): FeedbackPrefs {
  const next = { ...getFeedbackPrefs(), ...patch }
  cached = next
  try {
    prefsStorage()?.setItem(FEEDBACK_PREFS_KEY, JSON.stringify(next))
  } catch {
    // Prefs are a nicety; a blocked write must never break the game.
  }
  emit()
  return { ...next }
}

function subscribeFeedbackPrefs(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Stable snapshot identity for useSyncExternalStore: same object until a change. */
function snapshot(): FeedbackPrefs {
  if (!cached) cached = readStored()
  return cached
}

export function useFeedbackPrefs(): [FeedbackPrefs, (patch: Partial<FeedbackPrefs>) => void] {
  const prefs = useSyncExternalStore(subscribeFeedbackPrefs, snapshot, snapshot)
  return [prefs, setFeedbackPrefs]
}

/** Haptics are mobile-only: coarse pointers without hover. Desktop never buzzes. */
export function isMobileViewport(): boolean {
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(hover: none)').matches
    }
    if (typeof matchMedia === 'function') {
      return matchMedia('(hover: none)').matches
    }
  } catch {
    return false
  }
  return false
}

function navigatorVibrate(): ((pattern: number[]) => boolean) | null {
  try {
    const nav =
      typeof navigator !== 'undefined'
        ? navigator
        : typeof window !== 'undefined'
          ? (window as unknown as { navigator?: Navigator }).navigator
          : undefined
    if (nav && 'vibrate' in nav && typeof nav.vibrate === 'function') {
      return nav.vibrate.bind(nav) as (pattern: number[]) => boolean
    }
  } catch {
    return null
  }
  return null
}

export function buzz(kind: FeedbackKind): boolean {
  if (!getFeedbackPrefs().haptics) return false
  const pattern = HAPTIC_PATTERNS[kind]
  if (!pattern || pattern.length === 0) return false
  if (!isMobileViewport()) return false
  const vibrate = navigatorVibrate()
  if (!vibrate) return false
  try {
    return vibrate(pattern) ?? false
  } catch {
    return false
  }
}

/* Soft synth ---------------------------------------------------- */

let context: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null
    const Constructor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Constructor) return null
    context ??= new Constructor()
    if (context.state === 'suspended') void context.resume()
    return context
  } catch {
    return null
  }
}

type Wave = OscillatorType

function blip(
  when: number,
  frequency: number,
  duration: number,
  volume: number,
  type: Wave = 'triangle',
): void {
  const ctx = audio()
  if (!ctx) return
  try {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = type
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.exponentialRampToValueAtTime(volume, when + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(when)
    oscillator.stop(when + duration + 0.02)
  } catch {
    // Sound is decorative; a blocked context must never break the game.
  }
}

function chord(
  notes: Array<{ freq: number; at: number; dur: number; vol: number; type?: Wave }>,
): void {
  const ctx = audio()
  if (!ctx) return
  const now = ctx.currentTime
  for (const note of notes) {
    blip(now + note.at, note.freq, note.dur, note.vol, note.type ?? 'triangle')
  }
}

/** One-shot tone per moment. All volumes stay subtle; nothing loops. */
function playTone(kind: FeedbackKind, intensity = 1): void {
  switch (kind) {
    case 'select':
      chord([{ freq: 700, at: 0, dur: 0.06, vol: 0.04 }])
      break
    case 'complete':
      chord([
        { freq: 660, at: 0, dur: 0.1, vol: 0.06 },
        { freq: 880, at: 0.09, dur: 0.14, vol: 0.06 },
      ])
      break
    case 'elite':
      chord([
        { freq: 660, at: 0, dur: 0.09, vol: 0.06 },
        { freq: 880, at: 0.08, dur: 0.1, vol: 0.06 },
        { freq: 1320, at: 0.16, dur: 0.16, vol: 0.05 },
      ])
      break
    case 'treasure':
      chord([
        { freq: 990, at: 0, dur: 0.07, vol: 0.05 },
        { freq: 1320, at: 0.07, dur: 0.12, vol: 0.05 },
      ])
      break
    case 'rest':
      chord([{ freq: 330, at: 0, dur: 0.2, vol: 0.05, type: 'sine' }])
      break
    case 'skip':
      chord([{ freq: 220, at: 0, dur: 0.09, vol: 0.03, type: 'sine' }])
      break
    case 'wheelTick': {
      const clamped = Math.min(1, Math.max(0, intensity))
      chord([{ freq: 900 + 900 * clamped, at: 0, dur: 0.06, vol: 0.05 }])
      break
    }
    case 'wheelReveal':
      chord([
        { freq: 660, at: 0, dur: 0.12, vol: 0.07 },
        { freq: 990, at: 0.11, dur: 0.16, vol: 0.07 },
      ])
      break
    case 'lootCommon':
      chord([{ freq: 660, at: 0, dur: 0.12, vol: 0.06 }])
      break
    case 'lootRare':
      chord([
        { freq: 660, at: 0, dur: 0.1, vol: 0.06 },
        { freq: 880, at: 0.09, dur: 0.15, vol: 0.06 },
      ])
      break
    case 'lootEpic':
      chord([
        { freq: 660, at: 0, dur: 0.09, vol: 0.06 },
        { freq: 880, at: 0.08, dur: 0.1, vol: 0.06 },
        { freq: 1320, at: 0.16, dur: 0.2, vol: 0.06 },
      ])
      break
    case 'levelUp':
      chord([
        { freq: 523, at: 0, dur: 0.12, vol: 0.06 },
        { freq: 659, at: 0.09, dur: 0.12, vol: 0.06 },
        { freq: 784, at: 0.18, dur: 0.12, vol: 0.06 },
        { freq: 1046, at: 0.27, dur: 0.22, vol: 0.07 },
      ])
      break
    case 'seal':
      chord([
        { freq: 196, at: 0, dur: 0.22, vol: 0.07, type: 'sine' },
        { freq: 659, at: 0.1, dur: 0.18, vol: 0.06 },
      ])
      break
    case 'bossUnlock':
      chord([
        { freq: 440, at: 0, dur: 0.14, vol: 0.06, type: 'sine' },
        { freq: 660, at: 0.12, dur: 0.2, vol: 0.06 },
      ])
      break
  }
}

/**
 * Single entry point for juicy moments: plays the tone when sound is on and
 * buzzes when haptics are on and the viewport is mobile. Never throws.
 */
export function playFeedback(kind: FeedbackKind, options: { intensity?: number } = {}): void {
  try {
    if (getFeedbackPrefs().sound) playTone(kind, options.intensity ?? 1)
  } catch {
    // Decorative only.
  }
  try {
    buzz(kind)
  } catch {
    // Decorative only.
  }
}
