import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuthStore } from '../../sync/authStore'
import { useSyncStore } from '../../sync/setup'
import { Button, Panel, PanelHead } from '../components'

export function SyncPanel() {
  const status = useSyncStore((state) => state.status)
  const serverVersion = useSyncStore((state) => state.serverVersion)
  const lastError = useSyncStore((state) => state.lastError)
  const lastPushedAt = useSyncStore((state) => state.lastPushedAt)
  const authStatus = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)
  const authError = useAuthStore((state) => state.error)
  const login = useAuthStore((state) => state.login)
  const logout = useAuthStore((state) => state.logout)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const submitLogin = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    try {
      await login(email, password)
    } catch {
      // The error is already surfaced through the auth store.
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel pad>
      <PanelHead label="Sync" aside={<span className="chip chip--quiet">{status}</span>} />
      {authStatus === 'authenticated' && user ? (
        <div className="sync-panel">
          <p className="panel-note">
            Signed in as <strong>{user.email}</strong>
            {serverVersion ? ` · cloud v${serverVersion}` : ' · no cloud save yet'}
            {lastPushedAt ? ` · last push ${new Date(lastPushedAt).toLocaleTimeString()}` : null}
          </p>
          {lastError ? (
            <p className="panel-note" role="alert">
              {lastError}
            </p>
          ) : null}
          <div className="settings-actions">
            <Button variant="secondary" onClick={() => void logout()}>
              Sign out
            </Button>
          </div>
          <p className="panel-note settings-note">
            Sign-out keeps a per-account copy on this device. Offline edits queue and sync on
            reconnect; conflicts never auto-merge.
          </p>
        </div>
      ) : (
        <form className="sync-panel" onSubmit={(event) => void submitLogin(event)}>
          <p className="panel-note">
            Optional closed-beta sync between your devices. Guests keep playing locally.
          </p>
          <label className="field__label" htmlFor="sync-email">
            Email
          </label>
          <input
            id="sync-email"
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <label className="field__label" htmlFor="sync-password">
            Password
          </label>
          <input
            id="sync-password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {authError ? (
            <p className="panel-note" role="alert">
              {authError}
            </p>
          ) : null}
          <div className="settings-actions">
            <Button variant="secondary" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </div>
          <p className="panel-note settings-note">
            No signup here — accounts are created by an admin invite (see the admin panel in the
            next slice).
          </p>
        </form>
      )}
    </Panel>
  )
}
