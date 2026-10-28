import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, Share, StyleSheet, Switch, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import QRCode from 'react-native-qrcode-svg'
import {
  decodePairingPayload,
  encodePairingPayload,
  pairingCodeFromSecret,
} from '@lifespire/app-core/sync/protocol'
import type { LocalPeerView } from '@lifespire/app-core/sync/localEngine'
import type { PeerSyncStatus } from '@lifespire/app-core/sync/peerEngine'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Button } from './Button'
import { Chip } from './Chip'
import { Dialog } from './Dialog'
import { Field, Input } from './Field'
import { Icon } from './Icon'
import { IconButton } from './IconButton'
import { Panel, PanelHead } from './Panel'
import { Text } from './Text'
import { localSync, migrationNotice, setDiscoverable, useSyncStore } from '../sync/setup'
import { platformIcon } from '../lib/deviceIcon'

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

function formatExpiry(value: string): string {
  try {
    return new Date(value).toLocaleTimeString()
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
  const { colors } = useTheme()
  const busy = peer.status === 'pushing' || peer.status === 'pulling'
  return (
    <View style={[styles.peer, { borderTopColor: colors.hairline }]}>
      <View style={styles.peerHead}>
        <View style={styles.peerIcon}>
          <Icon name={platformIcon(peer.platform)} size={26} color={colors.accentDeep} />
        </View>
        <View style={styles.peerText}>
          <Text variant="bodySm">{peer.name}</Text>
          <Text variant="caption" tone="soft">
            {STATUS_LABEL[peer.status]} · {formatWhen(peer.lastSyncedAt ?? peer.lastSyncAt)}
          </Text>
        </View>
        <IconButton
          icon="refresh"
          label={`Sync with ${peer.name} now`}
          disabled={busy}
          onPress={() => void localSync.syncNow(peer.peerId)}
        />
        <Switch
          value={peer.autoSync}
          onValueChange={(value) => void localSync.setAutoSync(peer.peerId, value)}
          accessibilityLabel={`Sync automatically with ${peer.name}`}
        />
        <IconButton
          icon="trash"
          label={`Forget ${peer.name}`}
          onPress={() => onForget(peer)}
        />
      </View>
      {peer.lastError && peer.status === 'error' ? (
        <Text variant="caption" accessibilityRole="alert">
          {peer.lastError}
        </Text>
      ) : null}
      {peer.needsReview && !peer.conflict ? (
        <Text variant="caption" tone="soft">
          Unresolved conflict. Sync to review it.
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
  const [tab, setTab] = useState<PairMode>(mode)
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
    setTab(mode)
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

  const switchTab = (next: PairMode): void => {
    setTab(next)
    setError(null)
    if (next === 'host') void localSync.startPairing()
    else void localSync.cancelPairing()
  }

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
      setError('Enter the 8-character code shown on the other device.')
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
      title="Pair a device"
      eyebrow="Nearby sync"
      description="Both devices must be open on the same Wi-Fi."
      onClose={onClose}
      actions={
        <>
          <Button variant="quiet" onPress={onClose}>
            {tab === 'host' ? 'Done' : 'Cancel'}
          </Button>
          {tab === 'join' ? (
            <Button variant="secondary" onPress={() => void openScanner()}>
              Scan QR
            </Button>
          ) : null}
        </>
      }
    >
      <View style={styles.tabs}>
        {(['host', 'join'] as const).map((option) => {
          const selected = tab === option
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => switchTab(option)}
              style={[
                styles.tab,
                {
                  borderColor: selected ? colors.accent : colors.hairline,
                  backgroundColor: selected ? colors.accentSoft : colors.surface,
                },
              ]}
            >
              <Text variant="caption" tone={selected ? 'deep' : 'muted'}>
                {option === 'host' ? 'Show my code' : 'Enter a code'}
              </Text>
            </Pressable>
          )
        })}
      </View>
      {tab === 'host' ? (
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
                Expires at {formatExpiry(pairing.expiresAt)}.
              </Text>
              <Field label="Pairing link">
                <Input
                  value={linkValue}
                  editable={false}
                  multiline
                  numberOfLines={3}
                />
              </Field>
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
              No nearby devices. Keep both apps open.
            </Text>
          ) : (
            <View style={styles.choices}>
              {unpaired.map((peer) => (
                <Button
                  key={peer.deviceId}
                  variant={deviceId === peer.deviceId ? 'primary' : 'secondary'}
                  small
                  icon={platformIcon(peer.platform)}
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
            {busy ? 'Pairing…' : 'Pair'}
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
  const { colors } = useTheme()
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
  const [migrationDismissed, setMigrationDismissed] = useState(false)

  const peerList = Object.values(peers).sort((left, right) => left.name.localeCompare(right.name))
  const unpaired = nearby.filter((peer) => !peers[peer.deviceId])

  const openPair = (mode: PairMode, peerId?: string): void => {
    setPairMode(mode)
    setPairDevice(peerId)
    setPairOpen(true)
  }

  return (
    <Panel>
      <PanelHead
        label="Nearby devices"
        aside={
          <View style={styles.headAside}>
            <Chip variant="quiet">{phase === 'syncing' ? 'Syncing' : 'Local'}</Chip>
            {available ? (
              <IconButton
                icon="refresh"
                label="Sync all devices now"
                disabled={peerList.length === 0}
                onPress={() => void localSync.syncNow()}
              />
            ) : null}
          </View>
        }
      />
      <View style={styles.stack}>
        {!available ? (
          <Text variant="bodySm" tone="soft">
            Nearby sync needs the LifeSpire Android build. This save stays on this device.
          </Text>
        ) : (
          <>
            <Text variant="bodySm" tone="soft">
              Your devices only — no account, no cloud.
            </Text>
            <View style={styles.row}>
              <View style={styles.peerText}>
                <Text variant="bodySm">Nearby sync</Text>
              </View>
              <Switch
                value={discoverable}
                onValueChange={(value) => void setDiscoverable(value)}
                accessibilityLabel="Nearby sync"
              />
            </View>
            <View style={[styles.selfRow, { borderColor: colors.hairline }]}>
              <Icon name={platformIcon(device?.platform)} size={26} color={colors.accentDeep} />
              <View style={styles.peerText}>
                <Text variant="bodySm">{device?.name ?? 'Unknown'}</Text>
              </View>
              <Chip variant="quiet">This device</Chip>
            </View>
            {lastError ? (
              <Text variant="caption" accessibilityRole="alert">
                {lastError}
              </Text>
            ) : null}
            {conflicts.length > 0 ? (
              <Text variant="caption" accessibilityRole="alert">
                {conflicts.length === 1
                  ? `A change from ${conflicts[0]?.peerName} needs your review.`
                  : `${conflicts.length} devices have changes that need your review.`}
              </Text>
            ) : null}
            {migrationNotice.migrated && !migrationDismissed ? (
              <View style={styles.notice} accessibilityLiveRegion="polite">
                <Text variant="caption" tone="soft">
                  Your previous account save is now the local save. The old copy was kept.
                </Text>
                <Button variant="quiet" small onPress={() => setMigrationDismissed(true)}>
                  Dismiss
                </Button>
              </View>
            ) : null}
            <View style={styles.actions}>
              <Button variant="secondary" icon="plus" onPress={() => openPair('host')}>
                Pair a device
              </Button>
            </View>
            <Text variant="micro" tone="muted">
              PAIRED
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
                No other device visible. Keep both apps open.
              </Text>
            ) : (
              unpaired.map((peer) => (
                <View key={peer.deviceId} style={styles.peerHead}>
                  <View style={styles.peerIcon}>
                    <Icon name={platformIcon(peer.platform)} size={26} color={colors.accentDeep} />
                  </View>
                  <View style={styles.peerText}>
                    <Text variant="bodySm">{peer.name}</Text>
                  </View>
                  <Button variant="secondary" small onPress={() => openPair('join', peer.deviceId)}>
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
        description="It stops syncing with this device. Its own save is not deleted, and you can pair it again later."
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
              Forget device
            </Button>
          </>
        }
      >
        <Text variant="bodySm">{forgetPeer ? forgetPeer.name : null}</Text>
      </Dialog>
    </Panel>
  )
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headAside: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  selfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderRadius: radius.md,
  },
  peer: {
    gap: space.xs,
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  peerHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  peerIcon: { width: 30, alignItems: 'center' },
  peerText: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  tabs: { flexDirection: 'row', gap: space.xs, marginBottom: space.sm },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
  },
  choices: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
  notice: { gap: space.xs },
  qr: { alignSelf: 'center', backgroundColor: '#ffffff', padding: 10, borderRadius: 8 },
  code: { textAlign: 'center', letterSpacing: 4, fontSize: 24 },
  scanner: { height: 300, overflow: 'hidden', borderRadius: 8, borderWidth: 1 },
})
