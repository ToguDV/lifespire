import { createAppStore } from '@lifespire/app-core/state/store'
import { documentStorage } from '../platform/storage'

export * from '@lifespire/app-core/state/store'

/** Android app wiring: SQLite persistence, device clock and device time zone. */
export const useAppStore = createAppStore({ storage: documentStorage })
