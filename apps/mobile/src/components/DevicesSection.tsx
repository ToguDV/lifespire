import { useEffect, useMemo, useRef, useState } from 'react'
import { Share, StyleSheet, Switch, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import QRCode from 'react-native-qrcode-svg'
import {
  decodePairingPayload,
  encodePairingPayload,
  pairingCodeFromSecret,
  shortFingerprint,
} from '@lifespire/app-core/sync/protocol'
import type { LocalPeerView } from '@lifespire/app-core/sync/localEngine'
import type { PeerSyncStatus } from '@lifespire/app-core/sync/peerEngine'
import { useTheme } from '../theme/ThemeProvider'
import { space } from '../theme/tokens'
import { Button } from './Button'
import { Chip } from './Chip'
import { Dialog } from './Dialog'
import { Field, Input } from './Field'
import { Panel, PanelHead } from './Panel'
import { Text } from './Text'
import { localSync, migrationNotice, setDiscoverable, useSyncStore } from '../sync/setup'

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
    <View style={styles.peer}>
      <View style={styles.peerHead}>
        <View style={styles.peerText}>
          <Text variant="bodySm">{peer.name}</Text>
          <Text variant="caption" tone="soft">
            {STATUS_LABEL[peer.status]} · {formatWhen(peer.lastSyncedAt ?? peer.lastSyncAt)}
          </Text>
          <Text variant="caption" tone="soft">
            {shortFingerprint(peer.fingerprint)}
          </Text>
        </View>
        <Chip variant="quiet">{peer.status === 'offline' ? 'Away' : 'Paired'}</Chip>
      </View>
      <View style={styles.row}>
        <View style={styles.peerText}>
          <Text variant="bodySm">Start syncs automatically</Text>
          <Text variant="caption" tone="soft">
            This device initiates when both apps are open.
          </Text>
        </View>
        <Switch
          value={peer.autoSync}
          onValueChange={(value) => void localSync.setAutoSync(peer.peerId, value)}
          accessibilityLabel={`Sync automatically with ${peer.name}`}
        />
      </View>
      <View style={styles.actions}>
        <Button variant="secondary" small onPress={() => void localSync.syncNow(peer.peerId)}>
          Sync now
        </Button>
        <Button variant="quiet" small onPress={() => onForget(peer)}>
          Forget
        </Button>
      </View>
      {peer.lastError ? (
        <Text variant="caption" accessibilityRole="alert">
          {peer.lastError}
        </Text>
      ) : null}
      {peer.needsReview && !peer.conflict ? (
        <Text variant="caption" tone="soft">
          An unresolved conflict from a previous session. Tap Sync now to review it.
        </Text>
      ) : null}
    </View>
  )
}

type PairMode = 'host' | 'join'

function PairSheet({
  visible,
  mode,
  initialDeviceId,
  onClose,
}: {
  visible: boolean
  mode: PairMode
  initialDeviceId?: string
  onClose: () => void
}) {
  const { colors } = useTheme()
  const pairing = useSyncStore((state) => state.pairing)
  const nearby = useSyncStore((state) => state.nearby)
  const peers = useSyncStore((state) => state.peers)
  const [code, setCode] = useState('')
  const [deviceId, setDeviceId] = useState(initialDeviceId ?? '')
  const [link, setLink] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const scanningRef = useRef(false)
  const [permission, requestPermission] = useCameraPermissions()

  const unpaired = useMemo(
    () => nearby.filter((peer) => !peers[peer.deviceId]),
    [nearby, peers],
  )

  useEffect(() => {
    if (!visible) {
      setScannerOpen(false)
      return
    }
    setError(null)
    setBusy(false)
    setScannerOpen(false)
    setCode('')
    setLink('')
    setDeviceId(initialDeviceId ?? '')
    if (mode === 'host') void localSync.startPairing()
    else void localSync.cancelPairing()
  }, [visible, mode, initialDeviceId])

  useEffect(() => {
    if (!visible) return
    return () => {
      void localSync.cancelPairing()
    }
  }, [visible])

  const pairWithLink = async (value: string): Promise<void> => {
    setError(null)
    const payload = decodePairingPayload(value)
    if (!payload) {
      setError('Paste the full pairing link or scan its QR.')
      return
    }
    setBusy(true)
    try {
      const peer = await localSync.pair(payload)
      if (peer) onClose()
    } finally {
      setBusy(false)
    }
  }

  const pairWithCode = async (): Promise<void> => {
    setError(null)
    if (!deviceId) {
      setError('Choose the nearby device showing the code.')
      return
    }
    if (!/^[A-Za-z0-9]{8}$/.test(code.replace(/[^A-Za-z0-9]/g, ''))) {
      setError('Enter the 8-character code.')
      return
    }
    setBusy(true)
    try {
      const peer = await localSync.pairWithCode(deviceId, code)
      if (peer) onClose()
    } finally {
      setBusy(false)
    }
  }

  const scan = async (data: string): Promise<void> => {
    if (scanningRef.current) return
    scanningRef.current = true
    setScannerOpen(false)
    try {
      await pairWithLink(data)
    } finally {
      scanningRef.current = false
    }
  }

  const openScanner = async (): Promise<void> => {
    if (!permission?.granted) {
      const next = await requestPermission()
      if (!next.granted) {
        setError('Camera access is needed to scan the pairing QR.')
        return
      }
    }
    setScannerOpen(true)
  }

  const linkValue = pairing ? encodePairingPayload(pairing) : ''

  if (scannerOpen && visible) {
    return (
      <Dialog visible title="Scan pairing QR" onClose={() => setScannerOpen(false)}>
        <View style={[styles.scanner, { borderColor: colors.hairline }]}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              void scan(data)
            }}
          />
        </View>
        <Text variant="caption" tone="soft">
          Point the camera at the QR shown by the other device.
        </Text>
      </Dialog>
    )
  }

  return (
    <Dialog
      visible={visible}
      title={mode === 'host' ? 'Pair this device' : 'Pair another device'}
      eyebrow="Nearby sync"
      description={
        mode === 'host'
          ? 'Show this QR or the 8-character code to the other device.'
          : 'Scan the other device’s QR, paste its link or enter the code.'
      }
      onClose={onClose}
      actions={
        <>
          <Button variant="quiet" onPress={onClose}>
            {mode === 'host' ? 'Done' : 'Cancel'}
          </Button>
          {mode === 'join' ? (
            <Button variant="secondary" onPress={() => void openScanner()}>
              Scan QR
            </Button>
          ) : null}
        </>
      }
    >
      {mode === 'host' ? (
        <View style={styles.stack}>
          {pairing ? (
            <>
              <View style={styles.qr}>
                <QRCode value={linkValue} size={190} backgroundColor="#ffffff" />
              </View>
              <Text variant="headingSm" style={styles.code}>
                {pairingCodeFromSecret(pairing.secret)}
              </Text>
              <Text variant="caption" tone="soft">
                Expires {formatWhen(pairing.expiresAt)}. This device: {pairing.name} ·{' '}
                {shortFingerprint(pairing.fingerprint)}
              </Text>
              <Button
                variant="secondary"
                onPress={() => void Share.share({ message: linkValue })}
              >
                Share pairing link
              </Button>
            </>
          ) : (
            <Text variant="bodySm">Preparing the pairing code…</Text>
          )}
        </View>
      ) : (
        <View style={styles.stack}>
          <Text variant="micro" tone="muted">
            NEARBY DEVICE
          </Text>
          {unpaired.length === 0 ? (
            <Text variant="caption" tone="soft">
              No nearby devices. Both apps must be open on the same Wi-Fi with Nearby sync on.
            </Text>
          ) : (
            <View style={styles.choices}>
              {unpaired.map((peer) => (
                <Button
                  key={peer.deviceId}
                  variant={deviceId === peer.deviceId ? 'primary' : 'secondary'}
                  small
                  onPress={() => setDeviceId(peer.deviceId)}
                >
                  {peer.name}
                </Button>
              ))}
            </View>
          )}
          <Field label="8-character code" hint="Shown on the other device; expires in 5 minutes.">
            <Input
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              placeholder="ABCD2345"
            />
          </Field>
          <Button
            variant="primary"
            onPress={() => void pairWithCode()}
            disabled={busy || !deviceId || !code.trim()}
          >
            {busy ? 'Pairing…' : 'Pair with code'}
          </Button>
          <Field label="Pairing link">
            <Input
              value={link}
              onChangeText={setLink}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              numberOfLines={3}
              placeholder="lifespire://pair?p=…"
            />
          </Field>
          <Button variant="secondary" onPress={() => void pairWithLink(link)} disabled={busy || !link.trim()}>
            {busy ? 'Pairing…' : 'Pair with link'}
          </Button>
        </View>
      )}
      {error ? (
        <Text variant="caption" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </Dialog>
  )
}

export function DevicesSection() {
  const available = useSyncStore((state) => state.available)
  const device = useSyncStore((state) => state.device)
  const discoverable = useSyncStore((state) => state.discoverable)
  const nearby = useSyncStore((state) => state.nearby)
  const peers = useSyncStore((state) => state.peers)
  const conflicts = useSyncStore((state) => state.conflicts)
  const lastError = useSyncStore((state) => state.lastError)
  const [pairOpen, setPairOpen] = useState(false)
  const [pairMode, setPairMode] = useState<PairMode>('host')
  const [pairDevice, setPairDevice] = useState<string | undefined>(undefined)
  const [forgetPeer, setForgetPeer] = useState<LocalPeerView | null>(null)
  const [migrationDismissed, setMigrationDismissed] = useState(false)

  const peerList = Object.values(peers).sort((left, right) => left.name.localeCompare(right.name))
  const unpaired = nearby.filter((peer) => !peers[peer.deviceId])

  const openHost = (): void => {
    setPairMode('host')
    setPairDevice(undefined)
    setPairOpen(true)
  }
  const openJoin = (peerId?: string): void => {
    setPairMode('join')
    setPairDevice(peerId)
    setPairOpen(true)
  }

  return (
    <Panel>
      <PanelHead label="Nearby devices" aside={<Chip variant="quiet">Local</Chip>} />
      <View style={styles.stack}>
        {!available ? (
          <Text variant="bodySm" tone="soft">
            Nearby sync needs the LifeSpire Android build. This save stays on this device.
          </Text>
        ) : (
          <>
            <Text variant="bodySm" tone="soft">
              Sync directly with your own devices over Wi-Fi. No account or server.
            </Text>
            <View style={styles.row}>
              <View style={styles.peerText}>
                <Text variant="bodySm">Nearby sync</Text>
                <Text variant="caption" tone="soft">
                  Advertise this device while the app is open.
                </Text>
              </View>
              <Switch
                value={discoverable}
                onValueChange={(value) => void setDiscoverable(value)}
                accessibilityLabel="Nearby sync"
              />
            </View>
            <Text variant="caption" tone="soft">
              This device: {device?.name ?? 'Unknown'}
              {device ? ` · ${shortFingerprint(device.fingerprint)}` : null}
            </Text>
            {lastError ? (
              <Text variant="caption" accessibilityRole="alert">
                {lastError}
              </Text>
            ) : null}
            {conflicts.length > 0 ? (
              <Text variant="caption" accessibilityRole="alert">
                {conflicts.length === 1
                  ? `A change from ${conflicts[0]?.peerName} needs review.`
                  : `${conflicts.length} devices have changes that need review.`}
              </Text>
            ) : null}
            {migrationNotice.migrated && !migrationDismissed ? (
              <View style={styles.notice}>
                <Text variant="caption" tone="soft">
                  Your previous account save is now the local save. The old copy was kept as a
                  backup.
                </Text>
                <Button variant="quiet" small onPress={() => setMigrationDismissed(true)}>
                  Dismiss
                </Button>
              </View>
            ) : null}
            <View style={styles.actions}>
              <Button variant="primary" onPress={openHost}>
                Show my code
              </Button>
              <Button variant="secondary" onPress={() => openJoin()}>
                Enter a code
              </Button>
              <Button
                variant="secondary"
                onPress={() => void localSync.syncNow()}
                disabled={peerList.length === 0}
              >
                Sync all
              </Button>
            </View>
            <Text variant="micro" tone="muted">
              PAIRED DEVICES
            </Text>
            {peerList.length === 0 ? (
              <Text variant="caption" tone="soft">
                No devices paired yet.
              </Text>
            ) : (
              peerList.map((peer) => (
                <PeerCard key={peer.peerId} peer={peer} onForget={setForgetPeer} />
              ))
            )}
            <Text variant="micro" tone="muted">
              NEARBY
            </Text>
            {unpaired.length === 0 ? (
              <Text variant="caption" tone="soft">
                No other LifeSpire device is visible. Both apps must be open on the same Wi-Fi.
              </Text>
            ) : (
              unpaired.map((peer) => (
                <View key={peer.deviceId} style={styles.peerHead}>
                  <View style={styles.peerText}>
                    <Text variant="bodySm">{peer.name}</Text>
                    <Text variant="caption" tone="soft">
                      {peer.host} · {shortFingerprint(peer.fingerprint)}
                    </Text>
                  </View>
                  <Button variant="secondary" small onPress={() => openJoin(peer.deviceId)}>
                    Pair
                  </Button>
                </View>
              ))
            )}
          </>
        )}
      </View>

      <PairSheet
        visible={pairOpen}
        mode={pairMode}
        initialDeviceId={pairDevice}
        onClose={() => setPairOpen(false)}
      />

      <Dialog
        visible={forgetPeer !== null}
        title="Forget this device?"
        description="It stops syncing with this device. Its own save is not deleted."
        onClose={() => setForgetPeer(null)}
        actions={
          <>
            <Button variant="quiet" onPress={() => setForgetPeer(null)}>
              Keep
            </Button>
            <Button
              variant="danger"
              onPress={() => {
                if (forgetPeer) void localSync.forget(forgetPeer.peerId)
                setForgetPeer(null)
              }}
            >
              Forget
            </Button>
          </>
        }
      >
        <Text variant="bodySm">
          {forgetPeer ? `${forgetPeer.name} · ${shortFingerprint(forgetPeer.fingerprint)}` : null}
        </Text>
      </Dialog>
    </Panel>
  )
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  peer: {
    gap: space.sm,
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#00000022',
  },
  peerHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  peerText: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  choices: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
  notice: { gap: space.xs },
  qr: { alignSelf: 'center', backgroundColor: '#ffffff', padding: 10, borderRadius: 8 },
  code: { textAlign: 'center', letterSpacing: 4, fontSize: 24 },
  scanner: { height: 300, overflow: 'hidden', borderRadius: 8, borderWidth: 1 },
})
