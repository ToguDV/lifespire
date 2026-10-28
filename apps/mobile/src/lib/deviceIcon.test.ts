import { platformIcon } from './deviceIcon'

describe('platformIcon', () => {
  it('maps known platforms to device artwork', () => {
    expect(platformIcon('android')).toBe('smartphone')
    expect(platformIcon('desktop')).toBe('laptop')
  })

  it('never guesses for unknown or missing platforms', () => {
    expect(platformIcon(undefined)).toBe('devices')
    expect(platformIcon('watch' as never)).toBe('devices')
  })
})
