import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/**
 * Tracks whether a screen reader is active. The map uses it to bypass the
 * first-tap label reveal: TalkBack users activate a node once and it opens.
 */
export function useScreenReader(): boolean {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    let mounted = true
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((value) => {
        if (mounted) setEnabled(value)
      })
      .catch(() => {
        // The platform can refuse the query; keep the default.
      })
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setEnabled,
    )
    return () => {
      mounted = false
      subscription.remove()
    }
  }, [])

  return enabled
}
