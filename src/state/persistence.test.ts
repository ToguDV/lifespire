import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION, STORAGE_KEY } from '../domain/balance'
import { createEmptyDocument, serializeDocument } from '../domain/schema'
import type { GameDocument } from '../domain/types'
import { createDocumentStorage } from './persistence'
import type { PersistedSlice, StorageLike } from './persistence'

function createMemoryStorage(initial?: Record<string, string>): StorageLike & {
  values: Map<string, string>
} {
  const values = new Map(Object.entries(initial ?? {}))
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

function valueFor(document: GameDocument): PersistedSlice {
  return { document }
}

describe('createDocumentStorage', () => {
  it('returns null when no save exists', () => {
    const controller = createDocumentStorage(createMemoryStorage())
    expect(controller.storage.getItem(STORAGE_KEY)).toBeNull()
    expect(controller.consumeIssue()).toBeNull()
    expect(controller.isBlocked()).toBe(false)
  })

  it('writes and reads the versioned document itself', () => {
    const memory = createMemoryStorage()
    const controller = createDocumentStorage(memory)
    const document = createEmptyDocument()

    controller.storage.setItem(STORAGE_KEY, {
      state: valueFor({ ...document, settings: { theme: 'dark' } }),
      version: SCHEMA_VERSION,
    })

    const raw = memory.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw as string)).toEqual({
      ...document,
      settings: { theme: 'dark' },
    })
    expect(raw).toBe(serializeDocument({ ...document, settings: { theme: 'dark' } }))

    const restored = controller.storage.getItem(STORAGE_KEY)
    if (!restored || restored instanceof Promise) {
      throw new Error('Expected a synchronous persisted value')
    }
    expect(restored.state.document.settings.theme).toBe('dark')
  })

  it('migrates a version 1 save on read and reports the current version', () => {
    const createdAt = '2026-10-20T09:00:00.000Z'
    const legacyGoal = {
      id: 'goal_legacy',
      title: 'Read',
      category: 'Mind',
      weeklyObjective: 3,
      active: true,
      createdAt,
    }
    const legacy = {
      ...createEmptyDocument(),
      schemaVersion: 1,
      goals: [legacyGoal],
      onboardingDraft: {
        step: 2,
        mode: 'custom',
        name: 'Ari',
        goals: [{ ...legacyGoal, id: 'goal_draft' }],
        tasks: [],
      },
    }
    const memory = createMemoryStorage({ [STORAGE_KEY]: JSON.stringify(legacy) })
    const controller = createDocumentStorage(memory)

    const restored = controller.storage.getItem(STORAGE_KEY)
    if (!restored || restored instanceof Promise) {
      throw new Error('Expected a synchronous persisted value')
    }
    expect(restored.version).toBe(SCHEMA_VERSION)
    expect(restored.state.document.schemaVersion).toBe(SCHEMA_VERSION)
    expect(restored.state.document.goals[0]?.icon).toBe('banner')
    expect(restored.state.document.onboardingDraft?.goals[0]?.icon).toBe('banner')
    expect(memory.getItem(STORAGE_KEY)).toBe(JSON.stringify(legacy))
  })

  it('blocks writes for corrupt JSON without overwriting it', () => {
    const memory = createMemoryStorage({ [STORAGE_KEY]: '{broken' })
    const controller = createDocumentStorage(memory)

    expect(controller.storage.getItem(STORAGE_KEY)).toBeNull()
    expect(controller.consumeIssue()).toEqual({ reason: 'corrupt' })
    expect(controller.isBlocked()).toBe(true)

    controller.storage.setItem(STORAGE_KEY, { state: valueFor(createEmptyDocument()) })
    expect(memory.getItem(STORAGE_KEY)).toBe('{broken')
    expect(controller.consumeIssue()).toBeNull()
    expect(controller.isBlocked()).toBe(true)
  })

  it('blocks writes for a structurally invalid save without overwriting it', () => {
    const raw = JSON.stringify({ schemaVersion: 1 })
    const memory = createMemoryStorage({ [STORAGE_KEY]: raw })
    const controller = createDocumentStorage(memory)

    expect(controller.storage.getItem(STORAGE_KEY)).toBeNull()
    expect(controller.consumeIssue()).toEqual({ reason: 'corrupt' })
    controller.storage.setItem(STORAGE_KEY, { state: valueFor(createEmptyDocument()) })
    expect(memory.getItem(STORAGE_KEY)).toBe(raw)
  })

  it('blocks writes for a future schema without overwriting it', () => {
    const raw = JSON.stringify({ schemaVersion: 99 })
    const memory = createMemoryStorage({ [STORAGE_KEY]: raw })
    const controller = createDocumentStorage(memory)

    expect(controller.storage.getItem(STORAGE_KEY)).toBeNull()
    expect(controller.consumeIssue()).toEqual({ reason: 'future-version' })
    expect(controller.isBlocked()).toBe(true)

    controller.storage.setItem(STORAGE_KEY, { state: valueFor(createEmptyDocument()) })
    expect(memory.getItem(STORAGE_KEY)).toBe(raw)
  })

  it('unblocks after reset or a valid import', () => {
    const memory = createMemoryStorage({ [STORAGE_KEY]: 'not json' })
    const controller = createDocumentStorage(memory)
    controller.storage.getItem(STORAGE_KEY)
    expect(controller.isBlocked()).toBe(true)

    controller.unblockWrites()
    expect(controller.isBlocked()).toBe(false)
    controller.storage.setItem(STORAGE_KEY, { state: valueFor(createEmptyDocument()) })
    expect(JSON.parse(memory.getItem(STORAGE_KEY) as string)).toEqual(createEmptyDocument())
  })

  it('reports a failed write and clears the warning after a successful retry', () => {
    const memory = createMemoryStorage()
    let failWrites = false
    const controller = createDocumentStorage({
      ...memory,
      setItem: (key, value) => {
        if (failWrites) throw new Error('QuotaExceededError')
        memory.setItem(key, value)
      },
    })
    const warnings: Array<'write-failed' | null> = []
    controller.setWriteStatusListener((warning) => warnings.push(warning))

    failWrites = true
    controller.storage.setItem(STORAGE_KEY, { state: valueFor(createEmptyDocument()) })
    expect(warnings).toEqual(['write-failed'])
    expect(memory.getItem(STORAGE_KEY)).toBeNull()

    failWrites = false
    controller.storage.setItem(STORAGE_KEY, { state: valueFor(createEmptyDocument()) })
    expect(warnings).toEqual(['write-failed', null])
    expect(memory.getItem(STORAGE_KEY)).not.toBeNull()
  })

  it('reports writes as lost when the adapter fell back to memory', () => {
    const warnings: Array<'write-failed' | null> = []
    const controller = createDocumentStorage(createMemoryStorage(), { persistent: false })
    controller.setWriteStatusListener((warning) => warnings.push(warning))

    controller.storage.setItem(STORAGE_KEY, { state: valueFor(createEmptyDocument()) })

    expect(warnings).toEqual(['write-failed'])
    expect(controller.read()).not.toBeNull()
  })

  it('clears the stored save on request', () => {
    const memory = createMemoryStorage({ [STORAGE_KEY]: 'old' })
    const controller = createDocumentStorage(memory)
    controller.clear()
    expect(memory.getItem(STORAGE_KEY)).toBeNull()
  })
})
