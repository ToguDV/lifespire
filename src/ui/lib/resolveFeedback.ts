import type { NodeType, Rarity, ResolutionAction, WheelOutcome } from '../../domain/types'
import { playFeedback, type FeedbackKind } from './feedback'

/** Base one-shot for a resolution: skips are always the soft paper note. */
export function feedbackKindForReward(input: {
  nodeType: NodeType
  action: ResolutionAction
  wheelOutcome?: WheelOutcome | null
}): FeedbackKind {
  if (input.action === 'skip') return 'skip'
  if (input.nodeType === 'wheel') {
    switch (input.wheelOutcome) {
      case 'gold':
        return 'treasure'
      case 'rest':
        return 'rest'
      default:
        return 'complete'
    }
  }
  switch (input.nodeType) {
    case 'elite':
      return 'elite'
    case 'treasure':
      return 'treasure'
    case 'rest':
      return 'rest'
    case 'boss':
      return 'seal'
    default:
      return 'complete'
  }
}

export function lootFeedbackKind(rarity: Rarity): FeedbackKind {
  if (rarity === 'epic') return 'lootEpic'
  if (rarity === 'rare') return 'lootRare'
  return 'lootCommon'
}

function later(delayMs: number, play: () => void): void {
  try {
    if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
      window.setTimeout(play, delayMs)
      return
    }
  } catch {
    // Fall through to immediate play.
  }
  play()
}

/**
 * Plays the base resolution sound now and, when the event carried a new
 * relic, its rarity shimmer a beat later. Never throws; sound is decorative.
 */
export function playForRewardEvent(event: {
  action: ResolutionAction
  nodeType: NodeType
  wheelOutcome?: WheelOutcome | null
  lootItem?: { rarity: Rarity } | null
}): void {
  playFeedback(feedbackKindForReward(event))
  if (event.action === 'complete' && event.lootItem) {
    const kind = lootFeedbackKind(event.lootItem.rarity)
    later(150, () => playFeedback(kind))
  }
}
