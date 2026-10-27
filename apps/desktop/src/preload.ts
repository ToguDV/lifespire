import { contextBridge, ipcRenderer } from 'electron'

/**
 * Narrow bridge for the unmodified web build. The renderer never sees the
 * device private key or a peer token: they stay in the main-process local node.
 * Channel names are duplicated here because a sandboxed preload cannot import
 * local modules at runtime; keep them in sync with `LOCAL_SYNC_CHANNELS`.
 */
const CHANNELS = {
  start: 'lifespire:local-sync-start',
  stop: 'lifespire:local-sync-stop',
  setDiscoverable: 'lifespire:local-sync-set-discoverable',
  setDocument: 'lifespire:local-sync-set-document',
  pendingIncoming: 'lifespire:local-sync-pending-incoming',
  ackIncoming: 'lifespire:local-sync-ack-incoming',
  listPeers: 'lifespire:local-sync-list-peers',
  listNearby: 'lifespire:local-sync-list-nearby',
  startPairing: 'lifespire:local-sync-start-pairing',
  cancelPairing: 'lifespire:local-sync-cancel-pairing',
  pair: 'lifespire:local-sync-pair',
  pairWithCode: 'lifespire:local-sync-pair-with-code',
  forget: 'lifespire:local-sync-forget',
  setAutoSync: 'lifespire:local-sync-set-auto-sync',
  request: 'lifespire:local-sync-request',
  persistence: 'lifespire:local-sync-persistence',
  peersEvent: 'lifespire:local-sync-peers',
  pairedEvent: 'lifespire:local-sync-paired',
  incomingEvent: 'lifespire:local-sync-incoming',
  errorEvent: 'lifespire:local-sync-error',
} as const

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const wrapped = (_event: unknown, payload: T): void => listener(payload)
  ipcRenderer.on(channel, wrapped)
  return () => {
    ipcRenderer.removeListener(channel, wrapped)
  }
}

const localSync = Object.freeze({
  start: (options: { name: string; discoverable: boolean }) =>
    ipcRenderer.invoke(CHANNELS.start, options),
  stop: () => ipcRenderer.invoke(CHANNELS.stop),
  setDiscoverable: (discoverable: boolean) =>
    ipcRenderer.invoke(CHANNELS.setDiscoverable, discoverable),
  setDocument: (documentJson: string, docHash: string) =>
    ipcRenderer.invoke(CHANNELS.setDocument, documentJson, docHash),
  pendingIncoming: () => ipcRenderer.invoke(CHANNELS.pendingIncoming),
  ackIncoming: (id: string, result: unknown) =>
    ipcRenderer.invoke(CHANNELS.ackIncoming, id, result),
  listPeers: () => ipcRenderer.invoke(CHANNELS.listPeers),
  listNearby: () => ipcRenderer.invoke(CHANNELS.listNearby),
  startPairing: () => ipcRenderer.invoke(CHANNELS.startPairing),
  cancelPairing: () => ipcRenderer.invoke(CHANNELS.cancelPairing),
  pair: (payload: unknown) => ipcRenderer.invoke(CHANNELS.pair, payload),
  pairWithCode: (deviceId: string, code: string) =>
    ipcRenderer.invoke(CHANNELS.pairWithCode, deviceId, code),
  forget: (peerId: string) => ipcRenderer.invoke(CHANNELS.forget, peerId),
  setAutoSync: (peerId: string, autoSync: boolean) =>
    ipcRenderer.invoke(CHANNELS.setAutoSync, peerId, autoSync),
  request: (peerId: string, request: unknown) =>
    ipcRenderer.invoke(CHANNELS.request, peerId, request),
  persistence: () => ipcRenderer.invoke(CHANNELS.persistence),
  onPeersChanged: (listener: (peers: unknown[]) => void) =>
    subscribe(CHANNELS.peersEvent, listener),
  onPaired: (listener: (peer: unknown) => void) => subscribe(CHANNELS.pairedEvent, listener),
  onIncomingDocument: (listener: (item: unknown) => void) =>
    subscribe(CHANNELS.incomingEvent, listener),
  onError: (listener: (message: string) => void) => subscribe(CHANNELS.errorEvent, listener),
})

const bridge = Object.freeze({
  isDesktop: true as const,
  platform: process.platform,
  localSync,
})

contextBridge.exposeInMainWorld('lifespireDesktop', bridge)

export type LifespireDesktopBridge = typeof bridge
