jest.mock('./Icon', () => ({ Icon: () => null }))
jest.mock('./Progress', () => ({ Pips: () => null }))
jest.mock('./Text', () => ({ Text: () => null }))
jest.mock('../theme/ThemeProvider', () => ({
  useTheme: () => ({ scheme: 'light', colors: {} }),
}))

import { clampAimFilled } from './AimRow'

describe('clampAimFilled', () => {
  it('clamps negative progress to zero instead of rendering "-1 / 5"', () => {
    expect(clampAimFilled(-1, 5)).toBe(0)
  })

  it('clamps progress above the target', () => {
    expect(clampAimFilled(7, 5)).toBe(5)
  })

  it('keeps in-range progress untouched', () => {
    expect(clampAimFilled(3, 5)).toBe(3)
  })
})
