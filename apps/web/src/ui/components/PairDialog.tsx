import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  decodePairingPayload,
  encodePairingPayload,
  pairingCodeFromSecret,
  shortFingerprint,
} from '@lifespire/app-core/sync/protocol'
import { useSyncStore, localSync } from '../../sync/setup'
import { Button, Dialog } from './index'

export type PairMode = 'host' | 'join'

function formatExpiry(value: string): string {
  try {
    return new Date(value).toLocaleTimeString()
  } catch {
    return value
  }
}

export function PairDialog({
  open,
  mode,
  initialDeviceId,
  onClose,
}: {
  open: boolean
  mode: PairMode
  initialDeviceId?: string
  onClose: () => void
}) {
  const pairing = useSyncStore((state) => state.pairing)
  const nearby = useSyncStore((state) => state.nearby)
  const peers = useSyncStore((state) => state.peers)
  const [link, setLink] = useState('')
  const [code, setCode] = useState('')
  const [deviceId, setDeviceId] = useState(initialDeviceId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const unpaired = useMemo(
    () => nearby.filter((peer) => !peers[peer.deviceId]),
    [nearby, peers],
  )

  useEffect(() => {
    if (!open) return
    setError(null)
    setBusy(false)
    setCopied(false)
    if (mode === 'host') {
      void localSync.startPairing()
    } else {
      void localSync.cancelPairing()
      setDeviceId(initialDeviceId ?? '')
    }
  }, [open, mode, initialDeviceId])

  useEffect(() => {
    if (!open) return
    return () => {
      void localSync.cancelPairing()
    }
  }, [open])

  const linkValue = pairing ? encodePairingPayload(pairing) : ''

  const copyLink = async (): Promise<void> => {
    if (!linkValue) return
    try {
      await navigator.clipboard.writeText(linkValue)
      setCopied(true)
    } catch {
      setError('Could not copy. Select the link and copy it manually.')
    }
  }

  const pairWithLink = async (): Promise<void> => {
    setError(null)
    const payload = decodePairingPayload(link)
    if (!payload) {
      setError('Paste the full pairing link or its payload.')
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
      setError('Choose the nearby device that is showing the code.')
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

  return (
    <Dialog
      open={open}
      title={mode === 'host' ? 'Pair this device' : 'Pair another device'}
      eyebrow="Nearby sync"
      description={
        mode === 'host'
          ? 'Show this code to the other device. The QR carries the certificate fingerprint; the 8-character code is the fallback.'
          : 'Scan the other device’s QR with the Android app, paste its pairing link, or enter the 8-character code.'
      }
      onClose={onClose}
      footer={
        <Button variant="quiet" onClick={onClose}>
          {mode === 'host' ? 'Done' : 'Cancel'}
        </Button>
      }
    >
      {mode === 'host' ? (
        <div className="pair-host">
          {pairing ? (
            <>
              <div className="pair-qr" aria-label="Pairing QR code">
                <QRCodeSVG value={linkValue} size={208} marginSize={2} />
              </div>
              <p className="pair-code" aria-live="polite">
                <span className="micro">Code</span>
                <strong>{pairingCodeFromSecret(pairing.secret)}</strong>
              </p>
              <p className="panel-note">
                Expires at {formatExpiry(pairing.expiresAt)}. This device: {pairing.name} ·{' '}
                {shortFingerprint(pairing.fingerprint)}
              </p>
              <label className="field__label" htmlFor="pair-link">
                Pairing link
              </label>
              <textarea
                id="pair-link"
                className="input pair-link"
                readOnly
                rows={3}
                value={linkValue}
                onFocus={(event) => event.currentTarget.select()}
              />
              <div className="settings-actions">
                <Button variant="secondary" onClick={() => void copyLink()}>
                  {copied ? 'Copied' : 'Copy link'}
                </Button>
              </div>
            </>
          ) : (
            <p className="panel-note">Preparing the pairing code…</p>
          )}
        </div>
      ) : (
        <div className="pair-join">
          <div className="sync-field">
            <label className="field__label" htmlFor="pair-nearby">
              Nearby device
            </label>
            <select
              id="pair-nearby"
              className="input"
              value={deviceId}
              onChange={(event) => setDeviceId(event.target.value)}
            >
              <option value="">Choose a device…</option>
              {unpaired.map((peer) => (
                <option key={peer.deviceId} value={peer.deviceId}>
                  {peer.name} · {shortFingerprint(peer.fingerprint)}
                </option>
              ))}
            </select>
            {unpaired.length === 0 ? (
              <p className="field-hint">
                No nearby devices yet. Both apps must be open on the same Wi-Fi and Nearby sync
                must be on.
              </p>
            ) : null}
          </div>
          <div className="sync-field">
            <label className="field__label" htmlFor="pair-code">
              8-character code
            </label>
            <input
              id="pair-code"
              className="input"
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={12}
              placeholder="ABCD2345"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            <p className="field-hint">
              The code is shown on the other device. It expires in 5 minutes.
            </p>
          </div>
          <div className="settings-actions">
            <Button
              variant="primary"
              onClick={() => void pairWithCode()}
              disabled={busy || !deviceId || !code.trim()}
            >
              {busy ? 'Pairing…' : 'Pair with code'}
            </Button>
          </div>

          <details className="settings-details">
            <summary>Pair with a link instead</summary>
            <label className="field__label" htmlFor="pair-join-link">
              Pairing link or payload
            </label>
            <textarea
              id="pair-join-link"
              className="input pair-link"
              rows={3}
              placeholder="lifespire://pair?p=…"
              value={link}
              onChange={(event) => setLink(event.target.value)}
            />
            <div className="settings-actions">
              <Button variant="secondary" onClick={() => void pairWithLink()} disabled={busy}>
                {busy ? 'Pairing…' : 'Pair with link'}
              </Button>
            </div>
          </details>
        </div>
      )}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </Dialog>
  )
}
