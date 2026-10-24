export const RESET_CONFIRMATION = 'RESET'

/**
 * Reset needs more than closing a dialog: the phrase is typed exactly. Leading
 * and trailing whitespace is ignored, but the word itself is case-sensitive.
 */
export function isResetConfirmation(value: string): boolean {
  return value.trim() === RESET_CONFIRMATION
}
