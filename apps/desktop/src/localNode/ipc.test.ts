import { describe, expect, it, vi } from 'vitest'
import type { LocalNode } from './node'
import { LOCAL_SYNC_CHANNELS, registerLocalSyncIpc } from './ipc'

function createNode() {
  const calls: string[] = []
  const node = {
    start: vi.fn(async () => {
      calls.push('start')
      return {
        deviceId: 'device-1234',
        name: 'Desk',
        fingerprint: 'fingerprint-abcdefghijklmnop',
      }
    }),
    stop: vi.fn(async () => {
      calls.push('stop')
    }),
    setDiscoverable: vi.fn(async () => undefined),
    identity: vi.fn(() => null),
    setDocument: vi.fn(async () => undefined),
    pendingIncoming: vi.fn(async () => []),
    ackIncoming: vi.fn(async () => undefined),
    listPeers: vi.fn(() => []),
    listNearby: vi.fn(() => []),
    startPairing: vi.fn(() => {
      throw new Error('not used')
    }),
    cancelPairing: vi.fn(),
    pair: vi.fn(async () => {
      throw new Error('not used')
    }),
    pairWithCode: vi.fn(async () => {
      throw new Error('not used')
    }),
    forget: vi.fn(async () => undefined),
    setAutoSync: vi.fn(() => {
      throw new Error('not used')
    }),
    request: vi.fn(async () => ({ status: 200, body: {} })),
    persistence: vi.fn(() => 'encrypted' as const),
    onPeersChanged: vi.fn(() => () => undefined),
    onPaired: vi.fn(() => () => undefined),
    onIncomingDocument: vi.fn(() => () => undefined),
    onError: vi.fn(() => () => undefined),
  } satisfies LocalNode
  return { node, calls }
}

describe('local sync IPC', () => {
  it('registers the typed handlers and forwards only validated payloads', async () => {
    const { node } = createNode()
    const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
    const guard = vi.fn()
    const send = vi.fn()
    const dispose = registerLocalSyncIpc({
      ipcMain: {
        handle(channel, listener) {
          handlers.set(channel, listener)
        },
      },
      node,
      guard,
      send,
    })

    await handlers.get(LOCAL_SYNC_CHANNELS.start)!({}, { name: 'Desk', discoverable: true })
    expect(node.start).toHaveBeenCalledWith({ name: 'Desk', discoverable: true })
    expect(guard).toHaveBeenCalled()

    expect(() => handlers.get(LOCAL_SYNC_CHANNELS.setDocument)!({}, 42, 'hash')).toThrow(
      /invalid document mirror/i,
    )
    expect(() => handlers.get(LOCAL_SYNC_CHANNELS.request)!({}, 'peer', null)).toThrow(
      /invalid sync request/i,
    )

    handlers.get(LOCAL_SYNC_CHANNELS.stop)!({})
    expect(node.stop).toHaveBeenCalled()
    dispose()
  })

  it('rejects untrusted senders before touching the node', async () => {
    const { node } = createNode()
    const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
    registerLocalSyncIpc({
      ipcMain: {
        handle(channel, listener) {
          handlers.set(channel, listener)
        },
      },
      node,
      guard: () => {
        throw new Error('Untrusted IPC sender')
      },
      send: vi.fn(),
    })

    expect(() => handlers.get(LOCAL_SYNC_CHANNELS.start)!({}, {})).toThrow(
      /untrusted ipc sender/i,
    )
    expect(node.start).not.toHaveBeenCalled()
  })
})
