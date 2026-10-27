import { useEffect, useState } from 'react'
import { shortFingerprint } from '@lifespire/app-core/sync/protocol'
import type { LocalPeerView } from '@lifespire/app-core/sync/localEngine'
import type { PeerSyncStatus } from '@lifespire/app-core/sync/peerEngine'
import {
  localSync,
  migrationNotice,
  setDiscoverable,
  useSyncStore,
} from '../../sync/setup'
import { Button, Dialog, Panel, PanelHead } from './index'
import { PairDialog } from './PairDialog'
import type { PairMode } from './PairDialog'

const STATUS_LABEL: Record<PeerSyncStatus, string> = {
  disabled: 'Off',
  synced: 'Up to date',
  dirty: 'Changes waiting',
  pushing: 'Sending…',
  pulling: 'Checking…',
  offline: 'Not nearby',
  conflict: 'Needs review',
  error: 'Error',
  paused: 'Paused',
}

function formatWhen(value: string | null): string {
  if (!value) return 'never'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function PeerCard({
  peer,
  onForget,
}: {
  peer: LocalPeerView
  onForget: (peer: LocalPeerView) => void
}) {
  return (
    <div className="device-card">
      <div className="device-card__head">
        <div>
          <strong>{peer.name}</strong>
          <p className="panel-note">
            {STATUS_LABEL[peer.status]} · last sync {formatWhen(peer.lastSyncedAt ?? peer.lastSyncAt)}
          </p>
          <p className="field-hint">Fingerprint {shortFingerprint(peer.fingerprint)}</p>
        </div>
        <span className={`chip chip--quiet device-chip device-chip--${peer.status}`}>
          {peer.status === 'offline' ? 'Away' : 'Paired'}
        </span>
      </div>
      <div className="feedback-row">
        <div className="feedback-row__body">
          <strong>Start syncs automatically</strong>
          <p className="field-hint">This device initiates when both apps are open.</p>
        </div>
        <button
          type="button"
          className="feedback-switch"
          role="switch"
          aria-checked={peer.autoSync}
          aria-label={`Sync automatically with ${peer.name}`}
          onClick={() => void localSync.setAutoSync(peer.peerId, !peer.autoSync)}
        >
          <span className="feedback-switch__track" aria-hidden="true">
            <span className="feedback-switch__thumb" />
          </span>
          {peer.autoSync ? 'On' : 'Off'}
        </button>
      </div>
      <div className="settings-actions">
        <Button variant="secondary" onClick={() => void localSync.syncNow(peer.peerId)}>
          Sync now
        </Button>
        <Button variant="quiet" onClick={() => onForget(peer)}>
          Forget
        </Button>
      </div>
      {peer.lastError ? (
        <p className="field-error" role="alert">
          {peer.lastError}
        </p>
      ) : null}
      {peer.needsReview && !peer.conflict ? (
        <p className="field-hint">An unresolved conflict from a previous session. Tap Sync now to review it.</p>
      ) : null}
    </div>
  )
}

export function DevicesPanel() {
  const available = useSyncStore((state) => state.available)
  const device = useSyncStore((state) => state.device)
  const discoverable = useSyncStore((state) => state.discoverable)
  const nearby = useSyncStore((state) => state.nearby)
  const peers = useSyncStore((state) => state.peers)
  const conflicts = useSyncStore((state) => state.conflicts)
  const lastError = useSyncStore((state) => state.lastError)
  const phase = useSyncStore((state) => state.phase)
  const [pairOpen, setPairOpen] = useState(false)
  const [pairMode, setPairMode] = useState<PairMode>('host')
  const [pairDevice, setPairDevice] = useState<string | undefined>(undefined)
  const [forgetPeer, setForgetPeer] = useState<LocalPeerView | null>(null)
  const [persistence, setPersistence] = useState<'encrypted' | 'plaintext' | null>(null)
  const [migrationDismissed, setMigrationDismissed] = useState(false)

  useEffect(() => {
    const bridge =
      typeof window === 'undefined' ? undefined : window.lifespireDesktop?.localSync
    if (!bridge) return
    let active = true
    void bridge.persistence().then((value) => {
      if (active) setPersistence(value)
    })
    return () => {
      active = false
    }
  }, [])

  const peerList = Object.values(peers).sort((left, right) => left.name.localeCompare(right.name))
  const unpaired = nearby.filter((peer) => !peers[peer.deviceId])

  const openHost = (): void => {
    setPairMode('host')
    setPairDevice(undefined)
    setPairOpen(true)
  }

  const openJoin = (deviceId?: string): void => {
    setPairMode('join')
    setPairDevice(deviceId)
    setPairOpen(true)
  }

  return (
    <Panel pad>
      <PanelHead
        label="Nearby devices"
        aside={<span className="chip chip--quiet">{phase === 'syncing' ? 'Syncing' : 'Local'}</span>}
      />
      <div className="sync-panel">
        {!available ? (
          <p className="panel-note">
            Nearby sync is available in the Android and desktop apps. In this browser your save
            stays local; use export/import to move it.
          </p>
        ) : (
          <>
            <p className="panel-note">
              Sync directly with your own devices over the local network. There is no account,
              server or cloud copy.
            </p>
            <div className="feedback-row">
              <div className="feedback-row__body">
                <strong>Nearby sync</strong>
                <p className="field-hint">
                  This device advertises itself while the app is open. Turn it off to stay
                  invisible on the network.
                </p>
              </div>
              <button
                type="button"
                className="feedback-switch"
                role="switch"
                aria-checked={discoverable}
                aria-label="Nearby sync"
                onClick={() => void setDiscoverable(!discoverable)}
              >
                <span className="feedback-switch__track" aria-hidden="true">
                  <span className="feedback-switch__thumb" />
                </span>
                {discoverable ? 'On' : 'Off'}
              </button>
            </div>
            <p className="panel-note">
              This device: <strong>{device?.name ?? 'Unknown'}</strong>
              {device ? ` · ${shortFingerprint(device.fingerprint)}` : null}
            </p>
            {persistence === 'plaintext' ? (
              <p className="panel-note" role="note">
                The OS keychain is unavailable, so the local sync keys are stored with private
                file permissions instead of encryption.
              </p>
            ) : null}
            {lastError ? (
              <p className="field-error" role="alert">
                {lastError}
              </p>
            ) : null}
            {conflicts.length > 0 ? (
              <p className="field-error" role="alert">
                {conflicts.length === 1
                  ? `A change from ${conflicts[0]?.peerName} needs your review.`
                  : `${conflicts.length} devices have changes that need your review.`}
              </p>
            ) : null}
            {migrationNotice.migrated && !migrationDismissed ? (
              <div className="panel-note" role="status">
                <p>
                  Your previous account save is now the local save on this device. The old copy
                  was kept as a backup.
                </p>
                <Button variant="quiet" onClick={() => setMigrationDismissed(true)}>
                  Dismiss
                </Button>
              </div>
            ) : null}
            <div className="settings-actions">
              <Button variant="primary" onClick={openHost}>
                Show my code
              </Button>
              <Button variant="secondary" onClick={() => openJoin()}>
                Enter a code
              </Button>
              <Button
                variant="secondary"
                onClick={() => void localSync.syncNow()}
                disabled={peerList.length === 0}
              >
                Sync all
              </Button>
            </div>

            <h3 className="device-section">Paired devices</h3>
            {peerList.length === 0 ? (
              <p className="panel-note">No devices paired yet.</p>
            ) : (
              <div className="device-list">
                {peerList.map((peer) => (
                  <PeerCard key={peer.peerId} peer={peer} onForget={setForgetPeer} />
                ))}
              </div>
            )}

            <h3 className="device-section">Nearby</h3>
            {unpaired.length === 0 ? (
              <p className="panel-note">
                No other LifeSpire device is visible right now. Both apps must be open on the
                same Wi-Fi.
              </p>
            ) : (
              <div className="device-list">
                {unpaired.map((peer) => (
                  <div className="device-card device-card--nearby" key={peer.deviceId}>
                    <div className="device-card__head">
                      <div>
                        <strong>{peer.name}</strong>
                        <p className="field-hint">
                          {peer.host} · {shortFingerprint(peer.fingerprint)}
                        </p>
                      </div>
                      <Button variant="secondary" onClick={() => openJoin(peer.deviceId)}>
                        Pair
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <PairDialog
        open={pairOpen}
        mode={pairMode}
        initialDeviceId={pairDevice}
        onClose={() => setPairOpen(false)}
      />

      <Dialog
        open={forgetPeer !== null}
        title="Forget this device?"
        description="It stops syncing with this device. Its own save is not deleted, and you can pair it again later."
        onClose={() => setForgetPeer(null)}
        footer={
          <>
            <Button variant="quiet" onClick={() => setForgetPeer(null)}>
              Keep
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (forgetPeer) void localSync.forget(forgetPeer.peerId)
                setForgetPeer(null)
              }}
            >
              Forget device
            </Button>
          </>
        }
      >
        <p className="panel-note">
          {forgetPeer ? `${forgetPeer.name} · ${shortFingerprint(forgetPeer.fingerprint)}` : null}
        </p>
      </Dialog>
    </Panel>
  )
}
