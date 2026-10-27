import dgram from 'node:dgram'
import os from 'node:os'
import type { DiscoveryPacket, NearbyPeer } from './protocol'
import { DISCOVERY_PORT, PROTOCOL_VERSION, isValidDeviceId } from './protocol'

export const PEER_TTL_MS = 30_000
export const ANNOUNCE_INTERVAL_MS = 10_000
export const EXPIRE_INTERVAL_MS = 5_000
const MULTICAST_ADDRESS = '239.255.42.99'

export interface DiscoveryIdentity {
  deviceId: string
  name: string
  fingerprint: string
}

export interface Discovery {
  start(): void
  stop(): void
  setDiscoverable(discoverable: boolean): void
  setIdentity(identity: DiscoveryIdentity, port: number): void
  getNearby(): NearbyPeer[]
  onPeers(listener: (peers: NearbyPeer[]) => void): () => void
  onError(listener: (message: string) => void): () => void
}

export function parseDiscoveryPacket(raw: string): DiscoveryPacket | null {
  try {
    const value = JSON.parse(raw) as Partial<DiscoveryPacket>
    if (
      value.v !== PROTOCOL_VERSION ||
      (value.kind !== 'probe' && value.kind !== 'announce') ||
      !isValidDeviceId(value.deviceId) ||
      typeof value.name !== 'string' ||
      value.name.length === 0 ||
      value.name.length > 120 ||
      typeof value.port !== 'number' ||
      value.port <= 0 ||
      value.port >= 65536 ||
      typeof value.fingerprint !== 'string' ||
      value.fingerprint.length < 16 ||
      value.protocol !== PROTOCOL_VERSION
    ) {
      return null
    }
    return {
      v: PROTOCOL_VERSION,
      kind: value.kind,
      deviceId: value.deviceId,
      name: value.name,
      port: value.port,
      fingerprint: value.fingerprint,
      protocol: PROTOCOL_VERSION,
    }
  } catch {
    return null
  }
}

/** Broadcast address of an IPv4 interface, or null when it has no netmask. */
export function broadcastAddressFor(ip: string, netmask: string): string | null {
  const address = ip.split('.').map((part) => Number.parseInt(part, 10))
  const mask = netmask.split('.').map((part) => Number.parseInt(part, 10))
  if (
    address.length !== 4 ||
    mask.length !== 4 ||
    address.some((part) => !Number.isFinite(part) || part < 0 || part > 255) ||
    mask.some((part) => !Number.isFinite(part) || part < 0 || part > 255)
  ) {
    return null
  }
  return address
    .map((part, index) => (part & (mask[index] ?? 255)) | (~(mask[index] ?? 255) & 255))
    .join('.')
}

export function localBroadcastTargets(
  interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = os.networkInterfaces(),
): string[] {
  const targets = new Set<string>(['255.255.255.255', '127.0.0.1'])
  for (const list of Object.values(interfaces)) {
    for (const info of list ?? []) {
      if (info.family !== 'IPv4' || info.internal) continue
      targets.add(info.address)
      const broadcast = broadcastAddressFor(info.address, info.netmask)
      if (broadcast) targets.add(broadcast)
    }
  }
  return [...targets]
}

export function createDiscovery(deps: {
  port?: number
  identity: DiscoveryIdentity
  discoverable: boolean
  onError?: (message: string) => void
  now?: () => Date
}): Discovery {
  const port = deps.port ?? DISCOVERY_PORT
  const now = deps.now ?? (() => new Date())
  const listeners = new Set<(peers: NearbyPeer[]) => void>()
  const errorListeners = new Set<(message: string) => void>()
  const peers = new Map<string, NearbyPeer>()
  let socket: dgram.Socket | null = null
  let identity = deps.identity
  let httpsPort = 0
  let discoverable = deps.discoverable
  let announceTimer: ReturnType<typeof setInterval> | null = null
  let expireTimer: ReturnType<typeof setInterval> | null = null
  let started = false

  const report = (message: string): void => {
    deps.onError?.(message)
    errorListeners.forEach((listener) => listener(message))
  }

  const emit = (): void => {
    const snapshot = [...peers.values()].sort((left, right) => left.deviceId.localeCompare(right.deviceId))
    listeners.forEach((listener) => listener(snapshot))
  }

  const send = (target: string, kind: 'probe' | 'announce'): void => {
    if (!socket || httpsPort === 0) return
    const packet: DiscoveryPacket = {
      v: PROTOCOL_VERSION,
      kind,
      deviceId: identity.deviceId,
      name: identity.name,
      port: httpsPort,
      fingerprint: identity.fingerprint,
      protocol: PROTOCOL_VERSION,
    }
    const payload = Buffer.from(JSON.stringify(packet))
    try {
      socket.send(payload, port, target)
    } catch {
      // A single unreachable interface must not stop the others.
    }
  }

  const announce = (targets = localBroadcastTargets()): void => {
    if (!discoverable) return
    for (const target of targets) send(target, 'announce')
    try {
      socket?.send(
        Buffer.from(
          JSON.stringify({
            v: PROTOCOL_VERSION,
            kind: 'announce',
            deviceId: identity.deviceId,
            name: identity.name,
            port: httpsPort,
            fingerprint: identity.fingerprint,
            protocol: PROTOCOL_VERSION,
          }),
        ),
        port,
        MULTICAST_ADDRESS,
      )
    } catch {
      // Multicast is an optional fallback.
    }
  }

  const probe = (): void => {
    for (const target of localBroadcastTargets()) send(target, 'probe')
  }

  const expire = (): void => {
    const cutoff = now().getTime() - PEER_TTL_MS
    let changed = false
    for (const [deviceId, peer] of peers) {
      if (new Date(peer.lastSeenAt).getTime() < cutoff) {
        peers.delete(deviceId)
        changed = true
      }
    }
    if (changed) emit()
  }

  const handleMessage = (raw: Buffer, rinfo: dgram.RemoteInfo): void => {
    const packet = parseDiscoveryPacket(raw.toString('utf8'))
    if (!packet || packet.deviceId === identity.deviceId) return
    const host = rinfo.address.startsWith('::ffff:') ? rinfo.address.slice(7) : rinfo.address
    const previous = peers.get(packet.deviceId)
    const next: NearbyPeer = {
      deviceId: packet.deviceId,
      name: packet.name,
      host,
      port: packet.port,
      fingerprint: packet.fingerprint,
      lastSeenAt: now().toISOString(),
    }
    const changed =
      !previous ||
      previous.name !== next.name ||
      previous.host !== next.host ||
      previous.port !== next.port ||
      previous.fingerprint !== next.fingerprint
    peers.set(packet.deviceId, next)
    if (changed) emit()
    if (packet.kind === 'probe' && discoverable) {
      const announcePacket: DiscoveryPacket = {
        v: PROTOCOL_VERSION,
        kind: 'announce',
        deviceId: identity.deviceId,
        name: identity.name,
        port: httpsPort,
        fingerprint: identity.fingerprint,
        protocol: PROTOCOL_VERSION,
      }
      try {
        socket?.send(Buffer.from(JSON.stringify(announcePacket)), rinfo.port, rinfo.address)
      } catch {
        // Unicast reply is best-effort; the periodic broadcast retries.
      }
    }
  }

  const start = (): void => {
    if (started) return
    started = true
    const next = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    socket = next
    next.on('error', (error) => {
      report(`Discovery is unavailable: ${error.message}`)
      started = false
      try {
        next.close()
      } catch {
        // Already closed.
      }
      if (socket === next) socket = null
    })
    next.on('message', handleMessage)
    next.bind(port, '0.0.0.0', () => {
      try {
        next.setBroadcast(true)
        next.setMulticastTTL(1)
        next.addMembership(MULTICAST_ADDRESS)
      } catch {
        // Broadcast still works on networks that reject multicast membership.
      }
      if (discoverable) {
        probe()
        setTimeout(() => announce(), 500)
      }
      announceTimer = setInterval(() => announce(), ANNOUNCE_INTERVAL_MS)
      expireTimer = setInterval(expire, EXPIRE_INTERVAL_MS)
    })
  }

  const stop = (): void => {
    started = false
    if (announceTimer) clearInterval(announceTimer)
    if (expireTimer) clearInterval(expireTimer)
    announceTimer = null
    expireTimer = null
    const current = socket
    socket = null
    try {
      current?.close()
    } catch {
      // Already closed.
    }
    peers.clear()
    emit()
  }

  return {
    start,
    stop,
    setDiscoverable(next) {
      discoverable = next
      if (next) {
        probe()
        setTimeout(() => announce(), 100)
      }
    },
    setIdentity(next, nextHttpsPort) {
      identity = next
      httpsPort = nextHttpsPort
      if (started && discoverable) announce()
    },
    getNearby: () => [...peers.values()],
    onPeers(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    onError(listener) {
      errorListeners.add(listener)
      return () => errorListeners.delete(listener)
    },
  }
}
