import { useEffect } from 'react'

export interface ToastProps {
  message: string | null
  onDismiss: () => void
  duration?: number
}

/** Polite, self-clearing feedback for transient store messages. */
export function Toast({ message, onDismiss, duration = 5000 }: ToastProps) {
  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(onDismiss, duration)
    return () => window.clearTimeout(timer)
  }, [message, onDismiss, duration])

  if (!message) return null

  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{message}</span>
      <button type="button" className="toast__dismiss" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  )
}
