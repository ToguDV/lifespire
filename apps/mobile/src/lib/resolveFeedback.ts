import type { NodeType, Rarity, ResolutionAction, WheelOutcome } from '@lifespire/core'
import { playFeedback } from '../state/feedback'
import type { FeedbackKind } from '../state/feedback'

/** Base feedback for a resolution, shared with the web copy. */
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

export function playForRewardEvent(event: {
  action: ResolutionAction
  nodeType: NodeType
  wheelOutcome?: WheelOutcome | null
  lootItem?: { rarity: Rarity } | null
}): void {
  playFeedback(feedbackKindForReward(event))
  if (event.action === 'complete' && event.lootItem) {
    const kind = lootFeedbackKind(event.lootItem.rarity)
    setTimeout(() => playFeedback(kind), 150)
  }
}
