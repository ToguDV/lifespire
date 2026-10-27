import { createAndroidTransport } from './localTransport'

jest.mock('../../modules/lifespire-lan', () => ({
  __esModule: true,
  default: { request: jest.fn() },
  lanEvents: null,
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockedModule = require('../../modules/lifespire-lan') as {
  default: { request: jest.Mock }
}

describe('android transport request bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('serializes the body to a JSON string so no null crosses the Expo bridge', async () => {
    mockedModule.default.request.mockResolvedValue({ status: 202, body: '{"docHash":"h"}' })
    const transport = createAndroidTransport()

    await transport.request('peer-1', {
      method: 'POST',
      path: '/v1/document',
      body: {
        documentJson: '{"schemaVersion":3}',
        expectedHash: null,
        docHash: 'hash-b',
      },
    })

    expect(mockedModule.default.request).toHaveBeenCalledTimes(1)
    const [, wire] = mockedModule.default.request.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ]
    // The bridge map itself must not contain null values: Expo-Kotlin
    // `Map<String, Any?>` rejects nested nulls with
    // "Value is null, expected an Object".
    expect(wire.body).toEqual(
      JSON.stringify({
        documentJson: '{"schemaVersion":3}',
        expectedHash: null,
        docHash: 'hash-b',
      }),
    )
    for (const value of Object.values(wire)) {
      expect(value).not.toBeNull()
    }
  })

  it('omits the body key entirely for GET requests', async () => {
    mockedModule.default.request.mockResolvedValue({ status: 200, body: '{}' })
    const transport = createAndroidTransport()

    await transport.request('peer-1', { method: 'GET', path: '/v1/info' })

    const [, wire] = mockedModule.default.request.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ]
    expect(wire).toEqual({ method: 'GET', path: '/v1/info' })
  })
})
