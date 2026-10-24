import type { StoreDeps } from '@lifespire/app-core/state/store'
import {
  createAppStore as createAppStoreBase,
} from '@lifespire/app-core/state/store'
import { documentStorage } from './persistence'

export * from '@lifespire/app-core/state/store'

/**
 * Web wiring: the shared factory gets the browser storage controller. Every
 * caller may still inject its own deps (tests, alternate controllers).
 */
export function createAppStore(deps: StoreDeps = {}) {
  return createAppStoreBase({ storage: documentStorage, ...deps })
}

export const useAppStore = createAppStore()
