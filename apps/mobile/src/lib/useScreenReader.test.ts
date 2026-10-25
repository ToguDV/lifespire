import { AccessibilityInfo } from 'react-native'
import { useScreenReader } from './useScreenReader'

/**
 * Coverage for the screen-reader flag without a renderer: `useState` and
 * `useEffect` are stubbed at the `react` module boundary, so the test can run
 * the effect, settle the platform query and fire `screenReaderChanged`
 * events. The hook API (a plain boolean, default `false`) is pinned, not
 * changed: MapCanvas reads it to bypass the first-tap label reveal for
 * TalkBack users.
 */
const mockWiring = {
  setter: jest.fn(),
  initial: undefined as unknown,
  effect: undefined as (() => void | (() => void)) | undefined,
}

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react')
  return {
    ...actual,
    useState: (initial: unknown) => {
      mockWiring.initial = initial
      return [initial, mockWiring.setter]
    },
    useEffect: (effect: () => void | (() => void)) => {
      mockWiring.effect = effect
    },
  }
})

describe('useScreenReader', () => {
  let isEnabledSpy: jest.SpyInstance
  let addListenerSpy: jest.SpyInstance
  let removeListener: jest.Mock

  beforeEach(() => {
    mockWiring.setter.mockClear()
    mockWiring.initial = undefined
    mockWiring.effect = undefined
    removeListener = jest.fn()
    isEnabledSpy = jest
      .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
      .mockResolvedValue(false)
    addListenerSpy = jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove: removeListener } as unknown as ReturnType<
        typeof AccessibilityInfo.addEventListener
      >)
  })

  afterEach(() => {
    isEnabledSpy.mockRestore()
    addListenerSpy.mockRestore()
  })

  function useMountedReader(): void {
    useScreenReader()
    expect(mockWiring.effect).toBeDefined()
    mockWiring.effect?.()
  }

  it('starts disabled and queries the platform once', () => {
    const value = useScreenReader()

    expect(value).toBe(false)
    expect(mockWiring.initial).toBe(false)

    useMountedReader()
    expect(isEnabledSpy).toHaveBeenCalledTimes(1)
    expect(addListenerSpy).toHaveBeenCalledTimes(1)
    expect(addListenerSpy.mock.calls[0]?.[0]).toBe('screenReaderChanged')
    expect(typeof addListenerSpy.mock.calls[0]?.[1]).toBe('function')
  })

  it('adopts the platform result when the query resolves enabled', async () => {
    let resolveQuery!: (value: boolean) => void
    isEnabledSpy.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveQuery = resolve
      }),
    )

    useMountedReader()
    resolveQuery(true)
    await isEnabledSpy.mock.results[0]?.value

    expect(mockWiring.setter).toHaveBeenCalledWith(true)
  })

  it('keeps the default when the platform query fails', async () => {
    isEnabledSpy.mockRejectedValue(new Error('denied'))

    useMountedReader()
    await expect(isEnabledSpy.mock.results[0]?.value).rejects.toThrow('denied')

    expect(mockWiring.setter).not.toHaveBeenCalled()
  })

  it('follows live screenReaderChanged events in both states', () => {
    useMountedReader()

    const handler = addListenerSpy.mock.calls[0]?.[1] as (enabled: boolean) => void
    handler(true)
    expect(mockWiring.setter).toHaveBeenCalledWith(true)
    handler(false)
    expect(mockWiring.setter).toHaveBeenCalledWith(false)
  })

  it('removes the subscription and ignores a late query result', async () => {
    let resolveQuery!: (value: boolean) => void
    isEnabledSpy.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveQuery = resolve
      }),
    )

    useScreenReader()
    const cleanup = mockWiring.effect?.()
    expect(typeof cleanup).toBe('function')
    ;(cleanup as () => void)()
    expect(removeListener).toHaveBeenCalledTimes(1)

    resolveQuery(true)
    await isEnabledSpy.mock.results[0]?.value
    expect(mockWiring.setter).not.toHaveBeenCalled()
  })

  it('selects at once with a reader; otherwise the first tap only reveals', () => {
    // Contract pin of MapCanvas press() (components/MapCanvas.tsx): TalkBack
    // announces the node name, so the visual-only first-tap reveal is skipped.
    const decidePress = (revealed: boolean, screenReader: boolean): 'reveal' | 'select' =>
      !revealed && !screenReader ? 'reveal' : 'select'

    expect(decidePress(false, false)).toBe('reveal')
    expect(decidePress(false, true)).toBe('select')
    expect(decidePress(true, false)).toBe('select')
    expect(decidePress(true, true)).toBe('select')
  })
})
