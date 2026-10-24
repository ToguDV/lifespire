import { describe, expect, it } from 'vitest'
import {
  accountBackupKey,
  accountMetaKey,
  accountStorageKey,
  backupKeyFor,
  GUEST_BACKUP_KEY,
  GUEST_KEY,
  metaKeyFor,
  parseAccountId,
  SESSION_KEY,
} from './storageKeys'

describe('sync storage keys', () => {
  it('keeps the guest key stable', () => {
    expect(GUEST_KEY).toBe('lifespire:mvp0')
    expect(GUEST_BACKUP_KEY).toBe('lifespire:mvp0:backup')
  })

  it('namespaces account saves by user id', () => {
    expect(accountStorageKey('u_123')).toBe('lifespire:mvp0:u:u_123')
    expect(accountBackupKey('u_123')).toBe('lifespire:mvp0:u:u_123:backup')
    expect(accountMetaKey('u_123')).toBe('lifespire:mvp0:u:u_123:meta')
  })

  it('derives backup and meta keys from any save key', () => {
    expect(backupKeyFor(GUEST_KEY)).toBe(GUEST_BACKUP_KEY)
    expect(backupKeyFor(accountStorageKey('abc'))).toBe(accountBackupKey('abc'))
    expect(metaKeyFor(GUEST_KEY)).toBe('lifespire:mvp0:meta')
    expect(metaKeyFor(accountStorageKey('abc'))).toBe(accountMetaKey('abc'))
  })

  it('parses the account id back and rejects guest keys', () => {
    expect(parseAccountId(accountStorageKey('user-1'))).toBe('user-1')
    expect(parseAccountId(GUEST_KEY)).toBeNull()
    expect(parseAccountId(SESSION_KEY)).toBeNull()
  })

  it('rejects unsafe user ids', () => {
    expect(() => accountStorageKey('a/b')).toThrow()
    expect(() => accountStorageKey('')).toThrow()
  })
})
