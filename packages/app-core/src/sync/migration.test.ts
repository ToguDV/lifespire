import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@lifespire/core'
import type { GameDocument } from '@lifespire/core'
import { migrateLegacySave } from './migration'
import {
  GUEST_BACKUP_KEY,
  GUEST_KEY,
  LOCAL_SYNC_MIGRATION_KEY,
  SESSION_KEY,
  accountStorageKey,
} from './storageKeys'

function makeDocument(name: string): GameDocument {
  const document = createEmptyDocument()
  document.profile = {
    id: `profile_${name}`,
    name,
    xp: 10,
    level: 1,
    gold: 2,
    loot: [],
    createdAt: '2026-10-20T09:00:00.000Z',
  }
  return document
}

function makeStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
    values,
  }
}

describe('migrateLegacySave', () => {
  it('promotes the active account save and keeps both copies', () => {
    const storage = makeStorage({
      [SESSION_KEY]: JSON.stringify({ id: 'user_1', email: 'a@b.c', role: 'USER' }),
      [accountStorageKey('user_1')]: JSON.stringify(makeDocument('Account')),
      [GUEST_KEY]: JSON.stringify(makeDocument('Guest')),
    })

    const result = migrateLegacySave({ storage })

    expect(result).toMatchObject({ migrated: true, from: accountStorageKey('user_1'), reason: 'active-account' })
    expect(JSON.parse(storage.getItem(GUEST_KEY) ?? '{}').profile.name).toBe('Account')
    expect(JSON.parse(storage.getItem(GUEST_BACKUP_KEY) ?? '{}').profile.name).toBe('Guest')
    expect(storage.getItem(accountStorageKey('user_1'))).not.toBeNull()
    expect(storage.getItem(LOCAL_SYNC_MIGRATION_KEY)).not.toBeNull()
  })

  it('keeps the guest save when there is no account', () => {
    const storage = makeStorage({ [GUEST_KEY]: JSON.stringify(makeDocument('Guest')) })
    const result = migrateLegacySave({ storage })
    expect(result).toMatchObject({ migrated: false, from: GUEST_KEY, reason: 'guest' })
    expect(JSON.parse(storage.getItem(GUEST_KEY) ?? '{}').profile.name).toBe('Guest')
  })

  it('falls back to the guest save when the account save is corrupt', () => {
    const storage = makeStorage({
      [SESSION_KEY]: JSON.stringify({ id: 'user_1' }),
      [accountStorageKey('user_1')]: '{broken',
      [GUEST_KEY]: JSON.stringify(makeDocument('Guest')),
    })
    const result = migrateLegacySave({ storage })
    expect(result.reason).toBe('guest')
    expect(JSON.parse(storage.getItem(GUEST_KEY) ?? '{}').profile.name).toBe('Guest')
  })

  it('is idempotent after the marker exists', () => {
    const storage = makeStorage({
      [GUEST_KEY]: JSON.stringify(makeDocument('Guest')),
      [LOCAL_SYNC_MIGRATION_KEY]: JSON.stringify({ from: GUEST_KEY }),
    })
    expect(migrateLegacySave({ storage })).toMatchObject({
      migrated: false,
      reason: 'already-migrated',
    })
  })

  it('reports no save without touching storage', () => {
    const storage = makeStorage()
    expect(migrateLegacySave({ storage })).toMatchObject({
      migrated: false,
      from: null,
      reason: 'no-save',
    })
  })

  it('picks another legacy account key when the session is gone', () => {
    const storage = makeStorage({
      [accountStorageKey('user_old')]: JSON.stringify(makeDocument('Old')),
    })
    const result = migrateLegacySave({
      storage,
      listKeys: () => [accountStorageKey('user_old')],
    })
    expect(result).toMatchObject({ migrated: true, reason: 'legacy-account' })
    expect(JSON.parse(storage.getItem(GUEST_KEY) ?? '{}').profile.name).toBe('Old')
  })
})
