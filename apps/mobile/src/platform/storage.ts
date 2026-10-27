import { createDocumentStorage } from '@lifespire/app-core/state/persistence'
import type { StorageLike } from '@lifespire/app-core/state/persistence'
import { migrateLegacySave } from '@lifespire/app-core/sync/migration'
import { STORAGE_KEY } from '@lifespire/core'
import Storage from 'expo-sqlite/kv-store'

/**
 * Synchronous SQLite-backed key/value store. The shared Zustand persist
 * adapter hydrates synchronously, so the app never flashes an empty save while
 * an async storage read settles.
 */
export const kv: StorageLike = {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => {
    Storage.setItemSync(key, value)
  },
  removeItem: (key) => {
    Storage.removeItemSync(key)
  },
}

/** Legacy per-account keys are enumerable in expo-sqlite's KV store. */
function legacyAccountKeys(): string[] {
  try {
    return Storage.getAllKeysSync().filter(
      (key) => key.startsWith(`${STORAGE_KEY}:u:`) && !/:(backup|meta|base)$/.test(key),
    )
  } catch {
    return []
  }
}

/**
 * Promote the active legacy account save to the single local key before the
 * store hydrates; other valid saves are kept as backups.
 */
export const localSyncMigration = migrateLegacySave({
  storage: kv,
  listKeys: legacyAccountKeys,
})

export const documentStorage = createDocumentStorage(kv, { persistent: true })
