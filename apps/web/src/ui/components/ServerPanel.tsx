import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  checkServerHealth,
  clearStoredBaseUrl,
  getBuildBaseUrl,
  getStoredBaseUrl,
  getSyncBaseUrl,
  getSyncFetch,
  refreshSyncApi,
  setStoredBaseUrl,
  validateServerUrl,
  waitForDesktopTransport,
} from '../../sync/api'
import { useAuthStore } from '../../sync/authStore'
import { Button, Panel, PanelHead } from '../components'
import { isDesktopShell } from '../lib/platform'

function isLocalhost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

type Phase = 'idle' | 'checking' | 'saving'

export function ServerPanel() {
  const logout = useAuthStore((state) => state.logout)
  const desktop = isDesktopShell()
  const buildDefault = getBuildBaseUrl()
  const canTurnOff = desktop && !buildDefault
  const [stored, setStored] = useState<string | null>(() => {
    try {
      return getStoredBaseUrl()
    } catch {
      return null
    }
  })
  const [input, setInput] = useState(stored ?? '')
  const [touched, setTouched] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [unverified, setUnverified] = useState<string | null>(null)

  const effective = (() => {
    try {
      return getSyncBaseUrl()
    } catch {
      return ''
    }
  })()

  const trimmed = input.trim()
  const validation = useMemo(
    () => (trimmed ? validateServerUrl(trimmed) : null),
    [trimmed],
  )
  const fieldError =
    touched && trimmed && validation && !validation.ok ? validation.error : null
  const normalized = validation && validation.ok ? validation.normalized : null
  const showNormalized = normalized !== null && trimmed !== '' && normalized !== trimmed
  const showInsecureWarning = (() => {
    if (!normalized) return false
    try {
      const url = new URL(normalized)
      return url.protocol === 'http:' && !isLocalhost(url.hostname)
    } catch {
      return false
    }
  })()
  const busy = phase !== 'idle'
  const canSubmit = trimmed !== '' && validation?.ok === true && !busy

  /** Signs out, points the client at the new server and stays on screen. */
  const swapTo = async (origin: string | null): Promise<void> => {
    setPhase('saving')
    setServerError(null)
    setNotice(null)
    try {
      // Sessions live on the old server; sign out there first.
      await logout()
      if (origin === null) {
        clearStoredBaseUrl()
      } else {
        setStoredBaseUrl(origin)
      }
      refreshSyncApi()
      // A failed vault cleanup must block the success notice.
      await waitForDesktopTransport()
      setStored(getStoredBaseUrl())
      setUnverified(null)
      setNotice(
        origin === null
          ? canTurnOff
            ? 'Sync is off. Choose a server to sync between devices.'
            : 'Using the default server. You were signed out — sign in again to sync.'
          : `Now using ${origin}. You were signed out — sign in again to sync.`,
      )
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Could not save the server URL.')
    } finally {
      setPhase('idle')
    }
  }

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    setTouched(true)
    setServerError(null)
    setNotice(null)
    if (!validation || !validation.ok) return
    const origin = validation.normalized
    if (origin === effective) {
      setNotice('Already using this server.')
      return
    }
    if (unverified === origin) {
      void swapTo(origin)
      return
    }
    setPhase('checking')
    setUnverified(null)
    checkServerHealth(origin, getSyncFetch()).then(
      () => {
        void swapTo(origin)
      },
      (error: unknown) => {
        setServerError(
          error instanceof Error ? error.message : 'Could not reach that server.',
        )
        setUnverified(origin)
        setPhase('idle')
      },
    )
  }

  const reset = (): void => {
    setInput('')
    setTouched(false)
    setServerError(null)
    setNotice(null)
    setUnverified(null)
    void swapTo(null)
  }

  return (
    <Panel pad>
      <PanelHead
        label="Sync server"
        aside={
          <span className="chip chip--quiet">
            {stored ? 'custom' : desktop ? 'not configured' : 'default'}
          </span>
        }
      />
      <div className="sync-panel">
        <p className="panel-note">
          Current server:{' '}
          <strong>{effective || (desktop ? 'not configured' : 'this app (same origin)')}</strong>
        </p>
        {notice ? (
          <p className="panel-note" role="status">
            {notice}
          </p>
        ) : null}
        <form className="sync-form" onSubmit={submit} noValidate>
          <p className="panel-note">
            Point the app at another LifeSpire server (for example your own VPS).
            Changing servers signs you out, but you stay here.
          </p>
          <div className="sync-field">
            <label className="field__label" htmlFor="sync-server-url">
              Server URL
            </label>
            <input
              id="sync-server-url"
              className="input"
              type="url"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="https://sync.example.com"
              value={input}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby="sync-server-url-hint sync-server-url-error"
              onChange={(event) => {
                setInput(event.target.value)
                setServerError(null)
                setNotice(null)
                setUnverified(null)
              }}
              onBlur={() => setTouched(true)}
            />
            <p className="field-hint" id="sync-server-url-hint">
              Just the origin — no paths, queries or logins. Local servers look like{' '}
              <code>http://localhost:3000</code>.
            </p>
            {showNormalized ? (
              <p className="panel-note">Will be saved as {normalized}.</p>
            ) : null}
            {fieldError ? (
              <p className="field-error" id="sync-server-url-error" role="alert">
                {fieldError}
              </p>
            ) : null}
            {showInsecureWarning ? (
              <p className="panel-note" role="note">
                Plain http on a non-local host sends your password and save unencrypted.
                Prefer https.
              </p>
            ) : null}
            {serverError ? (
              <p className="field-error" role="alert">
                {serverError}
              </p>
            ) : null}
          </div>
          <div className="settings-actions">
            <Button
              variant="primary"
              type="submit"
              disabled={!canSubmit && unverified === null}
            >
              {phase === 'checking'
                ? 'Checking…'
                : phase === 'saving'
                  ? 'Saving…'
                  : unverified
                    ? 'Save anyway'
                    : 'Use this server'}
            </Button>
            {stored ? (
              <Button variant="secondary" onClick={reset} disabled={busy}>
                {canTurnOff ? 'Turn off sync' : 'Use default'}
              </Button>
            ) : null}
          </div>
        </form>
      </div>
    </Panel>
  )
}
