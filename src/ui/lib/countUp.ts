import { useEffect, useRef, useState } from 'react'

/** Shared ease-out so numbers settle like the rest of the motion system. */
export function easeOutQuart(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  return 1 - (1 - clamped) ** 4
}

/** Pure step: eased interpolation between two counters, rounded for display. */
export function countUpValue(from: number, to: number, progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress))
  if (clamped <= 0) return Math.round(from)
  if (clamped >= 1) return Math.round(to)
  return Math.round(from + (to - from) * easeOutQuart(clamped))
}

function prefersReducedMotion(): boolean {
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
  } catch {
    return false
  }
  return false
}

function prefersReducedMotionSignal(): boolean {
  try {
    if (typeof matchMedia === 'function') {
      return matchMedia('(prefers-reduced-motion: reduce)').matches
    }
  } catch {
    return false
  }
  return false
}

/**
 * Animated counter for XP/gold/totals. Jumps straight to the target under
 * `prefers-reduced-motion` and on the first frame when duration is 0.
 */
export function useCountUp(target: number, durationMs = 600): number {
  const safeTarget = Number.isFinite(target) ? target : 0
  const [display, setDisplay] = useState(safeTarget)
  const fromRef = useRef(safeTarget)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const from = fromRef.current
    if (from === safeTarget) {
      setDisplay(safeTarget)
      return
    }
    if (prefersReducedMotion() || prefersReducedMotionSignal() || durationMs <= 0) {
      fromRef.current = safeTarget
      setDisplay(safeTarget)
      return
    }
    let start: number | null = null
    const step = (nowMs: number) => {
      if (start === null) start = nowMs
      const progress = Math.min(1, (nowMs - start) / durationMs)
      setDisplay(countUpValue(from, safeTarget, progress))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
        return
      }
      rafRef.current = null
      fromRef.current = safeTarget
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      fromRef.current = safeTarget
    }
  }, [safeTarget, durationMs])

  return display
}
