import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createPinnedClient } from './client'
import { createInbox } from './inbox'
import { createIdentityStore } from './identity'
import { createLocalNode } from './node'
import type { LocalNode } from './node'
import { createPeerStore, newStoredPeer } from './peerStore'
import { broadcastAddressFor, parseDiscoveryPacket } from './discovery'
import { pairingCodeFromSecret } from './protocol'
import { createVaultFile } from './vault'
import type { SecretBox } from './vault'

const roots: string[] = []
const plainSecrets: SecretBox = {
  available: false,
  encrypt: (value) => value,
  decrypt: (value) => value,
}

function tempDir(): string {
  fs.mkdirSync('/tmp/opencode', { recursive: true })
  const dir = fs.mkdtempSync('/tmp/opencode/lifespire-node-')
  roots.push(dir)
  return dir
}

function discoveryPort(): number {
  return 45000 + Math.floor(Math.random() * 5000)
}

afterEach(() => {
  for (const dir of roots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('desktop local node primitives', () => {
  it('persists the device identity across instances', () => {
    const dir = tempDir()
    const file = createVaultFile(path.join(dir, 'identity.json'), fs)
    const first = createIdentityStore({ file, secrets: plainSecrets })
    const identity = first.loadOrCreate('Desk')
    expect(identity.fingerprint.length).toBeGreaterThan(20)
    expect(identity.certPem).toContain('BEGIN CERTIFICATE')

    const second = createIdentityStore({ file, secrets: plainSecrets })
    const loaded = second.loadOrCreate('Desk')
    expect(loaded.deviceId).toBe(identity.deviceId)
    expect(loaded.fingerprint).toBe(identity.fingerprint)
    expect(second.rename('Renamed').name).toBe('Renamed')
  })

  it('stores peers, tokens and the auto-sync policy', () => {
    const dir = tempDir()
    const file = createVaultFile(path.join(dir, 'peers.json'), fs)
    const store = createPeerStore({ file, secrets: plainSecrets })
    store.upsert(
      newStoredPeer({
        peerId: 'peer-1234-abcd',
        name: 'Phone',
        fingerprint: 'fingerprint-abcdefghijklmnop',
        certPem: '-----BEGIN CERTIFICATE-----\nxxx\n-----END CERTIFICATE-----\n',
        token: 'token-0123456789abcdef',
        lastHost: '192.168.1.20',
        lastPort: 4444,
      }),
    )
    expect(store.findByToken('token-0123456789abcdef')?.name).toBe('Phone')
    expect(store.findByToken('wrong-token')).toBeNull()
    expect(store.list()[0]?.autoSync).toBe(true)
    store.setAutoSync('peer-1234-abcd', false)
    expect(store.list()[0]?.autoSync).toBe(false)
    store.remove('peer-1234-abcd')
    expect(store.list()).toHaveLength(0)
  })

  it('keeps incoming documents until they are acknowledged', () => {
    const dir = tempDir()
    const inbox = createInbox({ dir: path.join(dir, 'inbox'), fs })
    const item = {
      id: 'incoming-1',
      fromPeerId: 'peer-1234-abcd',
      documentJson: '{"schemaVersion":3}',
      docHash: 'hash-1',
      updatedAt: '2026-10-27T10:00:00.000Z',
    }
    inbox.add(item)
    expect(inbox.list()).toHaveLength(1)

    const second = { ...item, id: 'incoming-2' }
    inbox.add(second)
    inbox.ack(second.id, false)
    expect(inbox.list()).toHaveLength(1)
    expect(fs.existsSync(path.join(dir, 'inbox', 'quarantine', 'incoming-2.json'))).toBe(true)

    inbox.ack(item.id, true)
    expect(inbox.list()).toHaveLength(0)
  })

  it('parses discovery packets and computes subnet broadcasts', () => {
    const packet = {
      v: 1,
      kind: 'announce',
      deviceId: 'device-1234-abcd',
      name: 'Pixel',
      port: 4444,
      fingerprint: 'fingerprint-abcdefghijklmnop',
      protocol: 1,
    }
    expect(parseDiscoveryPacket(JSON.stringify(packet))).toMatchObject({
      deviceId: 'device-1234-abcd',
      port: 4444,
    })
    expect(parseDiscoveryPacket('{}')).toBeNull()
    expect(broadcastAddressFor('192.168.1.10', '255.255.255.0')).toBe('192.168.1.255')
    expect(broadcastAddressFor('not-an-ip', '255.255.255.0')).toBeNull()
  })
})

describe('desktop local node over HTTPS', () => {
  async function pairNodes(): Promise<{
    a: LocalNode
    b: LocalNode
    aId: string
    bId: string
    pairing: ReturnType<LocalNode['startPairing']>
  }> {
    const a = createLocalNode({
      dataDir: tempDir(),
      secrets: plainSecrets,
      advertisedHost: '127.0.0.1',
      discoveryPort: discoveryPort(),
    })
    const b = createLocalNode({
      dataDir: tempDir(),
      secrets: plainSecrets,
      advertisedHost: '127.0.0.1',
      discoveryPort: discoveryPort(),
    })
    await a.start({ name: 'A', discoverable: false })
    await b.start({ name: 'B', discoverable: false })
    const pairing = a.startPairing()
    await b.pair(pairing)
    return {
      a,
      b,
      aId: a.identity()?.deviceId ?? '',
      bId: b.identity()?.deviceId ?? '',
      pairing,
    }
  }

  it('pairs two devices and moves a document with CAS and an inbox ack', async () => {
    const { a, b, aId } = await pairNodes()
    try {
      expect(a.listPeers()).toHaveLength(1)
      expect(b.listPeers()).toHaveLength(1)

      await a.setDocument('{"schemaVersion":3,"marker":"A"}', 'hash-a')
      const info = await b.request(aId, { method: 'GET', path: '/v1/info' })
      expect(info.status).toBe(200)
      expect((info.body as { docHash: string }).docHash).toBe('hash-a')

      const document = await b.request(aId, { method: 'GET', path: '/v1/document' })
      expect((document.body as { documentJson: string }).documentJson).toBe(
        '{"schemaVersion":3,"marker":"A"}',
      )

      const push = await b.request(aId, {
        method: 'POST',
        path: '/v1/document',
        body: {
          documentJson: '{"schemaVersion":3,"marker":"B"}',
          expectedHash: 'hash-a',
          docHash: 'hash-b',
        },
      })
      expect(push.status).toBe(202)

      // A second peer must not write against the same stale mirror while the
      // first document is still in the inbox.
      const competing = await b.request(aId, {
        method: 'POST',
        path: '/v1/document',
        body: {
          documentJson: '{"schemaVersion":3,"marker":"C"}',
          expectedHash: 'hash-a',
          docHash: 'hash-c',
        },
      })
      expect(competing.status).toBe(409)

      const pending = await a.pendingIncoming()
      expect(pending).toHaveLength(1)
      expect(pending[0]?.fromPeerId).toBe(b.identity()?.deviceId)
      await a.ackIncoming(pending[0]!.id, {
        ok: true,
        docHash: 'hash-b',
        updatedAt: '2026-10-27T10:05:00.000Z',
      })
      const after = await b.request(aId, { method: 'GET', path: '/v1/info' })
      expect((after.body as { docHash: string }).docHash).toBe('hash-b')
    } finally {
      await a.stop()
      await b.stop()
    }
  })

  it('treats a missing expectedHash like an explicit null (not malformed)', async () => {
    const { a, b, aId } = await pairNodes()
    try {
      await a.setDocument('{"schemaVersion":3,"marker":"A"}', 'hash-a')

      // With a save present, both a missing key and an explicit null mean
      // "no expected version" and must conflict (409), never 413 malformed.
      const missing = await b.request(aId, {
        method: 'POST',
        path: '/v1/document',
        body: {
          documentJson: '{"schemaVersion":3,"marker":"other"}',
          docHash: 'hash-other',
        },
      })
      expect(missing.status).toBe(409)

      const explicitNull = await b.request(aId, {
        method: 'POST',
        path: '/v1/document',
        body: {
          documentJson: '{"schemaVersion":3,"marker":"other"}',
          expectedHash: null,
          docHash: 'hash-other',
        },
      })
      expect(explicitNull.status).toBe(409)

      // Sanity: the correct hash is still accepted.
      const matching = await b.request(aId, {
        method: 'POST',
        path: '/v1/document',
        body: {
          documentJson: '{"schemaVersion":3,"marker":"B"}',
          expectedHash: 'hash-a',
          docHash: 'hash-b',
        },
      })
      expect(matching.status).toBe(202)
    } finally {
      await a.stop()
      await b.stop()
    }
  })

  it('rejects a null JSON body as malformed instead of a server error', async () => {
    const { a, b, aId } = await pairNodes()
    try {
      await a.setDocument('{"schemaVersion":3,"marker":"A"}', 'hash-a')
      const response = await b.request(aId, {
        method: 'POST',
        path: '/v1/document',
        body: null,
      })
      expect(response.status).toBe(400)
    } finally {
      await a.stop()
      await b.stop()
    }
  })

  it('rejects a wrong token and a wrong certificate pin', async () => {
    const { a, b, aId, pairing } = await pairNodes()
    try {
      const client = createPinnedClient()
      const wrongToken = await client.request({
        host: '127.0.0.1',
        port: pairing.port,
        method: 'GET',
        path: '/v1/info',
        token: 'wrong-token-0123456789',
        expectedFingerprint: a.identity()?.fingerprint ?? '',
      })
      expect(wrongToken.status).toBe(401)

      await expect(
        client.request({
          host: '127.0.0.1',
          port: pairing.port,
          method: 'GET',
          path: '/health',
          expectedFingerprint: 'wrong-fingerprint',
        }),
      ).rejects.toThrow(/certificate/i)

      await expect(
        b.pair({ ...pairing, secret: 'x'.repeat(32) }),
      ).rejects.toThrow()
    } finally {
      await a.stop()
      await b.stop()
      expect(aId).toBeTruthy()
    }
  })

  it('accepts the human code fallback for a fresh pairing', async () => {
    const a = createLocalNode({
      dataDir: tempDir(),
      secrets: plainSecrets,
      advertisedHost: '127.0.0.1',
      discoveryPort: discoveryPort(),
    })
    try {
      await a.start({ name: 'A', discoverable: false })
      const pairing = a.startPairing()
      const code = pairingCodeFromSecret(pairing.secret)
      const client = createPinnedClient()
      const response = await client.request({
        host: '127.0.0.1',
        port: pairing.port,
        method: 'POST',
        path: '/v1/pair',
        expectedFingerprint: a.identity()?.fingerprint ?? '',
        body: {
          code,
          deviceId: 'fake-device-1234',
          name: 'Fake',
          fingerprint: 'fake-fingerprint-abcdefghijkl',
          certPem: '-----BEGIN CERTIFICATE-----\nxxx\n-----END CERTIFICATE-----\n',
          token: 'fake-token-0123456789',
          port: 45555,
        },
      })
      expect(response.status).toBe(200)
      expect(a.listPeers().some((peer) => peer.peerId === 'fake-device-1234')).toBe(true)
    } finally {
      await a.stop()
    }
  })
})
