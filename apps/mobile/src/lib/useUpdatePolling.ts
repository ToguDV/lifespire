import { useEffect } from 'react'
import { AppState } from 'react-native'
import { UPDATE_POLL_MS, useUpdateStore } from '../state/update'

/**
 * Checks the F-Droid index on start, when the app returns to the foreground
 * (throttled by the store) and every six hours while it stays open. The store
 * owns the throttle and the in-flight guard, so repeated calls are cheap.
 */
export function useUpdatePolling(enabled: boolean): void {
  const check = useUpdateStore((state) => state.check)

  useEffect(() => {
    if (!enabled) return

    void check()
    const interval = setInterval(() => void check(), UPDATE_POLL_MS)
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check()
    })

    return () => {
      clearInterval(interval)
      subscription.remove()
    }
  }, [check, enabled])
}
