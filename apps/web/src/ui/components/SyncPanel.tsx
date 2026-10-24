import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuthStore } from '../../sync/authStore'
import { useSyncStore } from '../../sync/setup'
import { Button, Panel, PanelHead } from '../components'

function extractToken(raw: string): string {
  const trimmed = raw.trim()
  const fragment = trimmed.indexOf('#token=')
  if (fragment !== -1) return trimmed.slice(fragment + '#token='.length)
  const query = trimmed.indexOf('token=')
  if (query !== -1) return trimmed.slice(query + 'token='.length).split('&')[0] ?? ''
  return trimmed
}

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
  const acceptInvite = useAuthStore((state) => state.acceptInvite)
  const resetPassword = useAuthStore((state) => state.resetPassword)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [inviteToken, setInviteToken] = useState('')
  const [invitePassword, setInvitePassword] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [resetPasswordValue, setResetPasswordValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const submitLogin = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      const code = totpCode.trim()
      await login(email, password, code.length > 0 ? code : undefined)
    } catch {
      // The error is already surfaced through the auth store.
    } finally {
      setBusy(false)
    }
  }

  const submitInvite = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      await acceptInvite(extractToken(inviteToken), invitePassword)
      setNotice('Invite accepted — you are signed in on this device.')
      setInviteToken('')
      setInvitePassword('')
    } catch {
      // The error is already surfaced through the auth store.
    } finally {
      setBusy(false)
    }
  }

  const submitReset = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      await resetPassword(extractToken(resetToken), resetPasswordValue)
      setNotice('Password updated — sign in with the new password.')
      setResetToken('')
      setResetPasswordValue('')
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
        <div className="sync-panel">
          <form onSubmit={(event) => void submitLogin(event)}>
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
            <label className="field__label" htmlFor="sync-totp">
              Authenticator code <span className="micro">(if two-factor is on)</span>
            </label>
            <input
              id="sync-totp"
              className="input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={totpCode}
              onChange={(event) => setTotpCode(event.target.value)}
            />
            {authError ? (
              <p className="panel-note" role="alert">
                {authError}
              </p>
            ) : null}
            {notice ? <p className="panel-note">{notice}</p> : null}
            <div className="settings-actions">
              <Button variant="secondary" type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
            </div>
          </form>
          <form onSubmit={(event) => void submitInvite(event)}>
            <p className="panel-note">
              <strong>Have an invite?</strong> Paste the link or token your admin sent you, then
              choose a password (12+ characters).
            </p>
            <label className="field__label" htmlFor="sync-invite-token">
              Invite link or token
            </label>
            <input
              id="sync-invite-token"
              className="input"
              type="text"
              autoComplete="off"
              value={inviteToken}
              onChange={(event) => setInviteToken(event.target.value)}
              required
            />
            <label className="field__label" htmlFor="sync-invite-password">
              New password
            </label>
            <input
              id="sync-invite-password"
              className="input"
              type="password"
              autoComplete="new-password"
              minLength={12}
              value={invitePassword}
              onChange={(event) => setInvitePassword(event.target.value)}
              required
            />
            <div className="settings-actions">
              <Button variant="secondary" type="submit" disabled={busy}>
                Accept invite
              </Button>
            </div>
          </form>
          <form onSubmit={(event) => void submitReset(event)}>
            <p className="panel-note">
              <strong>Forgot your password?</strong> Paste the reset link your admin sent you,
              then choose a new password (12+ characters).
            </p>
            <label className="field__label" htmlFor="sync-reset-token">
              Reset link or token
            </label>
            <input
              id="sync-reset-token"
              className="input"
              type="text"
              autoComplete="off"
              value={resetToken}
              onChange={(event) => setResetToken(event.target.value)}
              required
            />
            <label className="field__label" htmlFor="sync-reset-password">
              New password
            </label>
            <input
              id="sync-reset-password"
              className="input"
              type="password"
              autoComplete="new-password"
              minLength={12}
              value={resetPasswordValue}
              onChange={(event) => setResetPasswordValue(event.target.value)}
              required
            />
            <div className="settings-actions">
              <Button variant="secondary" type="submit" disabled={busy}>
                Set new password
              </Button>
            </div>
          </form>
          <p className="panel-note settings-note">
            No signup here — accounts are created by an admin invite.
          </p>
        </div>
      )}
    </Panel>
  )
}
