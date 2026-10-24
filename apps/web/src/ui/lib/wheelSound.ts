/**
 * Backwards-compatible wheel sounds, now powered by the central feedback
 * engine. Kept so existing imports keep working; new code should call
 * `playFeedback` from `feedback.ts` directly.
 */
import { playFeedback } from './feedback'

export function playWheelTick(intensity = 1): void {
  playFeedback('wheelTick', { intensity })
}

export function playWheelReveal(): void {
  playFeedback('wheelReveal')
}
