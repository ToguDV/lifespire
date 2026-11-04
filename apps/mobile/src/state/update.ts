import { create } from 'zustand'
import { installedVersion } from '../lib/installedVersion'
import {
  checkMobileUpdate,
  type InstalledVersion,
  type MobileUpdate,
  type MobileUpdateCheck,
} from '../lib/update'

export const UPDATE_POLL_MS = 6 * 60 * 60 * 1000

export type UpdateStatus = 'idle' | 'checking' | 'current' | 'available' | 'error'

export interface UpdateState {
  status: UpdateStatus
  latest: MobileUpdate | null
  lastCheckedAt: number | null
  check(options?: { force?: boolean }): Promise<void>
}

export interface UpdateStoreDeps {
  installed?: InstalledVersion
  now?: () => number
  check?: (options: { installed: InstalledVersion }) => Promise<MobileUpdateCheck>
}

export function createUpdateStore(deps: UpdateStoreDeps = {}) {
  const now = deps.now ?? Date.now
  const checkImpl = deps.check ?? checkMobileUpdate
  let installed = deps.installed

  return create<UpdateState>((set, get) => ({
    status: 'idle',
    latest: null,
    lastCheckedAt: null,

    async check(options = {}) {
      const state = get()
      if (state.status === 'checking') return
      const lastCheckedAt = state.lastCheckedAt
      if (!options.force && lastCheckedAt !== null && now() - lastCheckedAt < UPDATE_POLL_MS) {
        return
      }

      installed ??= installedVersion()
      set({ status: 'checking' })

      let result: MobileUpdateCheck
      try {
        result = await checkImpl({ installed })
      } catch {
        set({ status: 'error', latest: null, lastCheckedAt: now() })
        return
      }
      const checkedAt = now()

      if (result.status === 'available') {
        set({ status: 'available', latest: result.update, lastCheckedAt: checkedAt })
        return
      }
      if (result.status === 'current') {
        set({ status: 'current', latest: null, lastCheckedAt: checkedAt })
        return
      }
      set({ status: 'error', latest: null, lastCheckedAt: checkedAt })
    },
  }))
}

export const useUpdateStore = createUpdateStore()
