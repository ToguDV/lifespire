import { describe, expect, it } from 'vitest'
import { createDemoSetup } from '../content/demo'
import { STORAGE_KEY } from '../domain/balance'
import type { RewardEvent } from '../domain/types'
import { createDocumentStorage } from './persistence'
import type { StorageLike } from './persistence'
import { createAppStore } from './store'

const baseNow = new Date(2026, 9, 20, 9, 0, 0)

function createMemoryStorage(): StorageLike & { values: Map<string, string> } {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
  }
}

const at = '2026-10-20T09:00:00.000Z'

function rewardFixture(): RewardEvent {
  return {
    id: 'event_n0_0',
    dayIndex: 0,
    nodeId: 'n0_0',
    nodeType: 'task',
    action: 'complete',
    taskId: 'task_1',
    taskTitle: 'Walk the north trail',
    goalId: 'goal_1',
    goalTitle: 'Wayfarer',
    xp: 10,
    gold: 10,
    progress: 1,
    lootItem: null,
    duplicateCatalogId: null,
    duplicateGold: 0,
    closingBonus: false,
    at,
  }
}

describe('reward toast state', () => {
  it('starts empty and shows then clears a reward event', () => {
    const memory = createMemoryStorage()
    const store = createAppStore({ storage: createDocumentStorage(memory), now: () => baseNow })
    expect(store.getState().rewardToast).toBeNull()

    store.getState().showRewardToast(rewardFixture())
    expect(store.getState().rewardToast?.nodeId).toBe('n0_0')

    store.getState().clearRewardToast()
    expect(store.getState().rewardToast).toBeNull()
  })

  it('never persists the reward toast into the save file', () => {
    const memory = createMemoryStorage()
    const store = createAppStore({ storage: createDocumentStorage(memory), now: () => baseNow })
    store.getState().completeOnboarding(createDemoSetup(baseNow), baseNow)
    store.getState().showRewardToast(rewardFixture())

    const raw = memory.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    expect(raw).not.toContain('rewardToast')
    expect(raw).not.toContain('event_n0_0')
  })
})
