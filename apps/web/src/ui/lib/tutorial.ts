import { useSyncExternalStore } from 'react'

export type TutorialCardId = 'camp' | 'map' | 'node' | 'sealed'

export const TUTORIAL_ORDER: readonly TutorialCardId[] = ['camp', 'map', 'node', 'sealed']

const STORAGE_KEY = 'lifespire:tutorial-cards-v1'

function readSeen(): Set<TutorialCardId> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is TutorialCardId => TUTORIAL_ORDER.includes(id as TutorialCardId)))
  } catch {
    return new Set()
  }
}

let snapshot: Set<TutorialCardId> = typeof window === 'undefined' ? new Set() : readSeen()
const listeners = new Set<() => void>()

function emit(): void {
  snapshot = readSeen()
  for (const listener of listeners) listener()
}

export function markTutorialSeen(id: TutorialCardId): void {
  try {
    const next = new Set(readSeen())
    next.add(id)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
  } catch {
    return
  }
  emit()
}

export function markTutorialDone(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...TUTORIAL_ORDER]))
  } catch {
    return
  }
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Reactive set of dismissed tutorial dialog cards. Never blocks rendering. */
export function useSeenTutorialCards(): Set<TutorialCardId> {
  return useSyncExternalStore(subscribe, () => snapshot, () => new Set<TutorialCardId>())
}
