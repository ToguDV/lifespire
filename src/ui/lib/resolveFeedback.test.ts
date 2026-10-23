import { describe, expect, it } from 'vitest'
import { feedbackKindForReward } from './resolveFeedback'

describe('feedbackKindForReward', () => {
  it('maps node types to their completion sound', () => {
    expect(feedbackKindForReward({ nodeType: 'task', action: 'complete' })).toBe('complete')
    expect(feedbackKindForReward({ nodeType: 'elite', action: 'complete' })).toBe('elite')
    expect(feedbackKindForReward({ nodeType: 'treasure', action: 'complete' })).toBe(
      'treasure',
    )
    expect(feedbackKindForReward({ nodeType: 'rest', action: 'complete' })).toBe('rest')
    expect(feedbackKindForReward({ nodeType: 'boss', action: 'complete' })).toBe('seal')
  })

  it('maps wheel outcomes to their sound', () => {
    expect(
      feedbackKindForReward({ nodeType: 'wheel', action: 'complete', wheelOutcome: 'task' }),
    ).toBe('complete')
    expect(
      feedbackKindForReward({ nodeType: 'wheel', action: 'complete', wheelOutcome: 'gold' }),
    ).toBe('treasure')
    expect(
      feedbackKindForReward({ nodeType: 'wheel', action: 'complete', wheelOutcome: 'xp' }),
    ).toBe('complete')
    expect(
      feedbackKindForReward({ nodeType: 'wheel', action: 'complete', wheelOutcome: 'rest' }),
    ).toBe('rest')
  })

  it('is silent-ish on skip', () => {
    expect(feedbackKindForReward({ nodeType: 'task', action: 'skip' })).toBe('skip')
    expect(feedbackKindForReward({ nodeType: 'boss', action: 'skip' })).toBe('skip')
  })
})
