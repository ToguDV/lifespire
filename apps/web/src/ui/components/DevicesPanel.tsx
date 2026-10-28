import { useEffect, useState } from 'react'
import type { LocalPeerView } from '@lifespire/app-core/sync/localEngine'
import type { PeerSyncStatus } from '@lifespire/app-core/sync/peerEngine'
import {
  localSync,
  migrationNotice,
  setDiscoverable,
  useSyncStore,
} from '../../sync/setup'
import { Button, Dialog, Icon, IconButton, Panel, PanelHead } from './index'
import { platformIcon } from '../lib/deviceIcon'
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
  if (!value) return 'not yet'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function PeerRow({
  peer,
  onForget,
}: {
  peer: LocalPeerView
  onForget: (peer: LocalPeerView) => void
}) {
  const busy = peer.status === 'pushing' || peer.status === 'pulling'
  return (
    <li className="device-row">
      <span className="device-row__icon" aria-hidden="true">
        <Icon name={platformIcon(peer.platform)} />
      </span>
      <span className="device-row__body">
        <strong className="device-row__name">{peer.name}</strong>
        <span className="device-row__sub">
          {STATUS_LABEL[peer.status]} · {formatWhen(peer.lastSyncedAt ?? peer.lastSyncAt)}
        </span>
      </span>
      <IconButton
        icon="refresh"
        label={`Sync with ${peer.name} now`}
        disabled={busy}
        onClick={() => void localSync.syncNow(peer.peerId)}
      />
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
        <span className="sr-only">{peer.autoSync ? 'On' : 'Off'}</span>
      </button>
      <IconButton
        icon="trash"
        label={`Forget ${peer.name}`}
        onClick={() => onForget(peer)}
      />
      {peer.lastError && peer.status === 'error' ? (
        <span className="field-error device-row__error" role="alert">
          {peer.lastError}
        </span>
      ) : null}
      {peer.needsReview && !peer.conflict ? (
        <span className="field-hint">Unresolved conflict. Sync to review it.</span>
      ) : null}
    </li>
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

  const openPair = (mode: PairMode, deviceId?: string): void => {
    setPairMode(mode)
    setPairDevice(deviceId)
    setPairOpen(true)
  }

  return (
    <Panel pad>
      <PanelHead
        label="Nearby devices"
        aside={
          <span className="device-head__aside">
            <span className={`chip chip--quiet`}>{phase === 'syncing' ? 'Syncing' : 'Local'}</span>
            {available ? (
              <IconButton
                icon="refresh"
                label="Sync all devices now"
                disabled={peerList.length === 0}
                onClick={() => void localSync.syncNow()}
              />
            ) : null}
          </span>
        }
      />
      <div className="sync-panel">
        {!available ? (
          <p className="panel-note">
            Nearby sync is available in the Android and desktop apps. In this browser your save
            stays local; use export/import to move it.
          </p>
        ) : (
          <>
            <p className="panel-note">Your devices only — no account, no cloud.</p>
            <div className="feedback-row">
              <div className="feedback-row__body">
                <strong>Nearby sync</strong>
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
            <div className="device-row device-row--self">
              <span className="device-row__icon" aria-hidden="true">
                <Icon name={platformIcon(device?.platform)} />
              </span>
              <span className="device-row__body">
                <strong className="device-row__name">{device?.name ?? 'Unknown'}</strong>
              </span>
              <span className="chip chip--quiet">This device</span>
            </div>
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
                <p>Your previous account save is now the local save. The old copy was kept.</p>
                <Button variant="quiet" onClick={() => setMigrationDismissed(true)}>
                  Dismiss
                </Button>
              </div>
            ) : null}
            <div className="settings-actions">
              <Button variant="secondary" onClick={() => openPair('host')}>
                <Icon name="plus" />
                Pair a device
              </Button>
            </div>

            <h3 className="device-section">Paired</h3>
            {peerList.length === 0 ? (
              <p className="panel-note">No devices paired yet.</p>
            ) : (
              <ul className="device-list">
                {peerList.map((peer) => (
                  <PeerRow key={peer.peerId} peer={peer} onForget={setForgetPeer} />
                ))}
              </ul>
            )}

            <h3 className="device-section">Nearby</h3>
            {unpaired.length === 0 ? (
              <p className="panel-note">No other device visible. Keep both apps open.</p>
            ) : (
              <ul className="device-list">
                {unpaired.map((peer) => (
                  <li className="device-row" key={peer.deviceId}>
                    <span className="device-row__icon" aria-hidden="true">
                      <Icon name={platformIcon(peer.platform)} />
                    </span>
                    <span className="device-row__body">
                      <strong className="device-row__name">{peer.name}</strong>
                    </span>
                    <Button variant="secondary" onClick={() => openPair('join', peer.deviceId)}>
                      Pair
                    </Button>
                  </li>
                ))}
              </ul>
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
        <p className="panel-note">{forgetPeer ? forgetPeer.name : null}</p>
      </Dialog>
    </Panel>
  )
}
