import { describe, expect, it } from 'vitest'
import type { MapNode } from '../../domain/types'
import {
  nodeAriaLabel,
  nodeRewardLine,
  nodeRewardSummary,
} from './nodeCopy'

function taskNode(progress: 0 | 1): MapNode {
  return {
    id: 'n0_0',
    layer: 0,
    type: 'task',
    task: {
      taskId: 'task-walk',
      title: 'Walk the north trail',
      goalId: 'goal-wayfarer',
      goalTitle: 'Wayfarer',
      effort: 'light',
    },
    rewards: { xp: 20, gold: 7, lootRolls: 2, progress },
    connections: [],
  }
}

describe('nodeRewardLine', () => {
  it('omits weekly progress when the node does not grant it', () => {
    const node = taskNode(1)
    const line = nodeRewardLine(node, 0)

    expect(line).not.toContain('+1')
    expect(line).not.toContain('weekly target')
    expect(line).toContain('+20 XP')
    expect(line).toContain('+7 gold')
  })

  it('includes weekly progress when the node grants it', () => {
    const node = taskNode(0)
    const line = nodeRewardLine(node, 1)

    expect(line).toContain('+1 toward weekly target')
  })

  it('defaults to the node reward progress', () => {
    expect(nodeRewardLine(taskNode(1))).toContain('+1 toward weekly target')
    expect(nodeRewardLine(taskNode(0))).not.toContain('+1 toward weekly target')
  })
})

describe('nodeRewardSummary', () => {
  it('omits weekly progress when the node does not grant it', () => {
    const node = taskNode(1)
    const summary = nodeRewardSummary(node, 0)

    expect(summary).not.toContain('plus one')
    expect(summary).not.toContain('weekly target')
    expect(summary).toContain('plus 20 experience')
  })

  it('includes weekly progress when the node grants it', () => {
    const node = taskNode(0)
    const summary = nodeRewardSummary(node, 1)

    expect(summary).toContain('plus one toward the weekly target')
  })

  it('defaults to the node reward progress', () => {
    expect(nodeRewardSummary(taskNode(1))).toContain(
      'plus one toward the weekly target',
    )
    expect(nodeRewardSummary(taskNode(0))).not.toContain('plus one')
  })
})

describe('nodeAriaLabel', () => {
  it('reflects the real weekly progress for available and current steps', () => {
    const withoutProgress = taskNode(1)
    const withProgress = taskNode(0)

    for (const status of ['available', 'current'] as const) {
      expect(nodeAriaLabel(withoutProgress, status, 0)).not.toContain(
        'plus one toward the weekly target',
      )
      expect(nodeAriaLabel(withProgress, status, 1)).toContain(
        'plus one toward the weekly target',
      )
    }
  })

  it('defaults to the node reward progress', () => {
    expect(nodeAriaLabel(taskNode(1), 'available')).toContain(
      'plus one toward the weekly target',
    )
    expect(nodeAriaLabel(taskNode(0), 'available')).not.toContain('plus one')
  })
})
