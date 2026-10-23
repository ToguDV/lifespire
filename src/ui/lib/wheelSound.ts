/**
 * Tiny WebAudio ratchet for the wheel: a soft click per sector plus a
 * two-tone landing chime. No assets, created lazily so imports stay safe
 * outside the browser. Volume stays subtle; failures never break the spin.
 */

let context: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null
    const Constructor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Constructor) return null
    context ??= new Constructor()
    if (context.state === 'suspended') void context.resume()
    return context
  } catch {
    return null
  }
}

function blip(when: number, frequency: number, duration: number, volume: number): void {
  const ctx = audio()
  if (!ctx) return
  try {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'triangle'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.exponentialRampToValueAtTime(volume, when + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(when)
    oscillator.stop(when + duration + 0.02)
  } catch {
    // Sound is decorative; a blocked context must not break the spin.
  }
}

/** Ratchet click. `intensity` 0..1 follows the wheel velocity: faster = brighter. */
export function playWheelTick(intensity = 1): void {
  const ctx = audio()
  if (!ctx) return
  const clamped = Math.min(1, Math.max(0, intensity))
  blip(ctx.currentTime, 900 + 900 * clamped, 0.06, 0.05)
}

/** Landing chime when the wheel settles on its outcome. */
export function playWheelReveal(): void {
  const ctx = audio()
  if (!ctx) return
  const now = ctx.currentTime
  blip(now, 660, 0.12, 0.07)
  blip(now + 0.11, 990, 0.16, 0.07)
}
