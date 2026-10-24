import { createDocumentStorage } from '@lifespire/app-core/state/persistence'
import type { StorageLike } from '@lifespire/app-core/state/persistence'
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

export const documentStorage = createDocumentStorage(kv, { persistent: true })
