import { useState } from 'react'
import type { FormEvent } from 'react'
import { clearStoredBaseUrl, getStoredBaseUrl, getSyncBaseUrl, setStoredBaseUrl } from '../../sync/api'
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
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const effective = (() => {
    try {
      return getSyncBaseUrl()
    } catch {
      return ''
    }
  })()
  const showInsecureWarning = (() => {
    try {
      const url = new URL(input.trim())
      return url.protocol === 'http:' && !isLocalhost(url.hostname)
    } catch {
      return false
    }
  })()

  const applyAndRestart = async (apply: () => void): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      apply()
      try {
        await logout()
      } catch {
        // Logout is local-first; a failed server call still signs out here.
      }
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the server URL.')
      setBusy(false)
    }
  }

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    const apply = (): void => {
      setStoredBaseUrl(input)
      setStored(getStoredBaseUrl())
    }
    void applyAndRestart(apply)
  }

  const reset = (): void => {
    setInput('')
    void applyAndRestart(() => {
      clearStoredBaseUrl()
      setStored(null)
    })
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
        <form onSubmit={submit}>
          <p className="panel-note">
            Point the app at another LifeSpire server (for example your own VPS).
            Changing servers signs you out.
          </p>
          <label className="field__label" htmlFor="sync-server-url">
            Server URL
          </label>
          <input
            id="sync-server-url"
            className="input"
            type="text"
            inputMode="url"
            autoComplete="off"
            placeholder="https://sync.example.com"
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          {showInsecureWarning ? (
            <p className="panel-note" role="alert">
              Plain http on a non-local host sends your password and save unencrypted.
              Prefer https.
            </p>
          ) : null}
          {error ? (
            <p className="panel-note" role="alert">
              {error}
            </p>
          ) : null}
          <div className="settings-actions">
            <Button variant="secondary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Use this server'}
            </Button>
            {stored ? (
              <Button variant="secondary" onClick={reset} disabled={busy}>
                Use default
              </Button>
            ) : null}
          </div>
        </form>
      </div>
    </Panel>
  )
}
