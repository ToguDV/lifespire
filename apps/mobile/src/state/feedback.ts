import * as Haptics from 'expo-haptics'
import { useSyncExternalStore } from 'react'
import { devWarn } from '../lib/devLogger'
import { kv } from '../platform/storage'

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
  haptics: boolean
}

export const FEEDBACK_PREFS_KEY = 'lifespire:feedback-prefs'
const DEFAULT_PREFS: FeedbackPrefs = { haptics: true }

let cached: FeedbackPrefs | null = null
const listeners = new Set<() => void>()

function readStored(): FeedbackPrefs {
  try {
    const raw = kv.getItem(FEEDBACK_PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed = JSON.parse(raw) as Partial<FeedbackPrefs>
    return { haptics: typeof parsed.haptics === 'boolean' ? parsed.haptics : DEFAULT_PREFS.haptics }
  } catch (error) {
    devWarn('feedback', 'feedback preferences could not be read', error)
    return { ...DEFAULT_PREFS }
  }
}

function snapshot(): FeedbackPrefs {
  if (!cached) cached = readStored()
  return cached
}

function emit(): void {
  for (const listener of listeners) listener()
}

export function getFeedbackPrefs(): FeedbackPrefs {
  return { ...snapshot() }
}

export function setFeedbackPrefs(patch: Partial<FeedbackPrefs>): FeedbackPrefs {
  const next = { ...getFeedbackPrefs(), ...patch }
  cached = next
  try {
    kv.setItem(FEEDBACK_PREFS_KEY, JSON.stringify(next))
  } catch (error) {
    devWarn('feedback', 'feedback preferences could not be saved', error)
  }
  emit()
  return { ...next }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useFeedbackPrefs(): FeedbackPrefs {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

let hapticsWarned = false

function reportHaptics(error: unknown): void {
  if (hapticsWarned) return
  hapticsWarned = true
  devWarn('feedback', 'haptics are unavailable on this device', error)
}

function impact(style: Haptics.ImpactFeedbackStyle): void {
  void Haptics.impactAsync(style).catch(reportHaptics)
}

function notify(type: Haptics.NotificationFeedbackType): void {
  void Haptics.notificationAsync(type).catch(reportHaptics)
}

function later(delay: number, play: () => void): void {
  setTimeout(play, delay)
}

/** Soft haptic vocabulary; every call is best-effort and never throws. */
export function playFeedback(kind: FeedbackKind): void {
  if (!getFeedbackPrefs().haptics) return
  switch (kind) {
    case 'select':
    case 'wheelTick':
      impact(Haptics.ImpactFeedbackStyle.Light)
      return
    case 'skip':
      return
    case 'rest':
      impact(Haptics.ImpactFeedbackStyle.Soft)
      return
    case 'complete':
    case 'treasure':
    case 'lootCommon':
      notify(Haptics.NotificationFeedbackType.Success)
      return
    case 'elite':
      notify(Haptics.NotificationFeedbackType.Success)
      later(70, () => impact(Haptics.ImpactFeedbackStyle.Medium))
      return
    case 'wheelReveal':
    case 'bossUnlock':
      impact(Haptics.ImpactFeedbackStyle.Medium)
      return
    case 'lootRare':
      notify(Haptics.NotificationFeedbackType.Success)
      later(60, () => impact(Haptics.ImpactFeedbackStyle.Light))
      return
    case 'lootEpic':
      notify(Haptics.NotificationFeedbackType.Success)
      later(70, () => impact(Haptics.ImpactFeedbackStyle.Heavy))
      later(150, () => impact(Haptics.ImpactFeedbackStyle.Light))
      return
    case 'levelUp':
      notify(Haptics.NotificationFeedbackType.Success)
      later(90, () => impact(Haptics.ImpactFeedbackStyle.Medium))
      later(180, () => impact(Haptics.ImpactFeedbackStyle.Heavy))
      return
    case 'seal':
      notify(Haptics.NotificationFeedbackType.Success)
      later(80, () => impact(Haptics.ImpactFeedbackStyle.Medium))
      return
  }
}
