import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  checkServerHealth,
  clearStoredBaseUrl,
  getStoredBaseUrl,
  getSyncBaseUrl,
  setStoredBaseUrl,
  validateServerUrl,
} from '../../sync/api'
import { useAuthStore } from '../../sync/authStore'
import { Button, Panel, PanelHead } from '../components'

function isLocalhost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

export function ServerPanel() {
  const logout = useAuthStore((state) => state.logout)
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
  const [checking, setChecking] = useState(false)
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
  const normalized =
    validation && validation.ok ? validation.normalized : null
  const showNormalized =
    normalized !== null && trimmed !== '' && normalized !== trimmed
  const showInsecureWarning = (() => {
    if (!normalized) return false
    try {
      const url = new URL(normalized)
      return url.protocol === 'http:' && !isLocalhost(url.hostname)
    } catch {
      return false
    }
  })()
  const canSubmit = trimmed !== '' && validation?.ok === true && !checking

  const saveAndRestart = async (origin: string): Promise<void> => {
    setStoredBaseUrl(origin)
    setStored(getStoredBaseUrl())
    try {
      await logout()
    } catch {
      // Logout is local-first; a failed server call still signs out here.
    }
    window.location.reload()
  }

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    setTouched(true)
    setServerError(null)
    if (!validation || !validation.ok) return
    const origin = validation.normalized
    if (unverified === origin) {
      setChecking(true)
      saveAndRestart(origin).catch((error: unknown) => {
        setServerError(error instanceof Error ? error.message : 'Could not save the server URL.')
        setChecking(false)
      })
      return
    }
    setChecking(true)
    setUnverified(null)
    checkServerHealth(origin)
      .then(() => saveAndRestart(origin))
      .catch((error: unknown) => {
        setServerError(
          error instanceof Error ? error.message : 'Could not reach that server.',
        )
        setUnverified(origin)
        setChecking(false)
      })
  }

  const reset = (): void => {
    setInput('')
    setTouched(false)
    setServerError(null)
    setUnverified(null)
    setChecking(true)
    try {
      clearStoredBaseUrl()
      setStored(null)
    } finally {
      window.location.reload()
    }
  }

  return (
    <Panel pad>
      <PanelHead
        label="Sync server"
        aside={
          <span className="chip chip--quiet">{stored ? 'custom' : 'default'}</span>
        }
      />
      <div className="sync-panel">
        <p className="panel-note">
          Current server: <strong>{effective || 'this app (same origin)'}</strong>
        </p>
        <form className="sync-form" onSubmit={submit} noValidate>
          <p className="panel-note">
            Point the app at another LifeSpire server (for example your own VPS).
            Changing servers signs you out.
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
              {checking ? 'Checking…' : unverified ? 'Save anyway' : 'Use this server'}
            </Button>
            {stored ? (
              <Button variant="secondary" onClick={reset} disabled={checking}>
                Use default
              </Button>
            ) : null}
          </div>
        </form>
      </div>
    </Panel>
  )
}
