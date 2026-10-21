import { describe, expect, it } from 'vitest'
import { RESET_CONFIRMATION, isResetConfirmation } from './reset'

describe('reset confirmation phrase', () => {
  it('requires the exact word, ignoring only surrounding whitespace', () => {
    expect(RESET_CONFIRMATION).toBe('RESET')
    expect(isResetConfirmation('RESET')).toBe(true)
    expect(isResetConfirmation('  RESET\n')).toBe(true)
    expect(isResetConfirmation('reset')).toBe(false)
    expect(isResetConfirmation('Reset')).toBe(false)
    expect(isResetConfirmation('RESET ALL')).toBe(false)
    expect(isResetConfirmation('')).toBe(false)
  })
})
