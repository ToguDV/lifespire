import { useState } from 'react'
import type { FormEvent } from 'react'
import { finishDesktopSignOut } from '../../sync/api'
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
  const lastAutoMergeAt = useSyncStore((state) => state.lastAutoMergeAt)
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
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const submitSignOut = async (): Promise<void> => {
    setSignOutError(null)
    try {
      await finishDesktopSignOut(logout)
    } catch (error) {
      setSignOutError(
        error instanceof Error ? error.message : 'Could not clear the session on this device.',
      )
    }
  }

  const submitLogin = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    setSignOutError(null)
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
      {signOutError ? (
        <p className="field-error" role="alert">
          {signOutError}
        </p>
      ) : null}
      {authStatus === 'authenticated' && user ? (
        <div className="sync-panel">
          <p className="panel-note">
            Signed in as <strong>{user.email}</strong>
            {serverVersion ? ` · cloud v${serverVersion}` : ' · no cloud save yet'}
            {lastPushedAt ? ` · last push ${new Date(lastPushedAt).toLocaleTimeString()}` : null}
            {lastAutoMergeAt ? ' · edits merged automatically' : null}
          </p>
          {lastError ? (
            <p className="panel-note" role="alert">
              {lastError}
            </p>
          ) : null}
          <div className="settings-actions">
            <Button variant="secondary" onClick={() => void submitSignOut()}>
              Sign out
            </Button>
          </div>
          <p className="panel-note settings-note">
            Sign-out keeps a per-account copy on this device. Offline edits queue and sync on
            reconnect; small independent edits merge on their own, real conflicts ask you.
          </p>
        </div>
      ) : (
        <div className="sync-panel">
          <form className="sync-form" onSubmit={(event) => void submitLogin(event)}>
            <p className="panel-note">
              Optional closed-beta sync between your devices. Guests keep playing locally.
            </p>
            <div className="sync-field">
              <label className="field__label" htmlFor="sync-email">
                Email
              </label>
              <input
                id="sync-email"
                className="input"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="sync-field">
              <label className="field__label" htmlFor="sync-password">
                Password
              </label>
              <input
                id="sync-password"
                className="input"
                type="password"
                autoComplete="current-password"
                placeholder="Your account password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <div className="sync-field">
              <label className="field__label" htmlFor="sync-totp">
                Authenticator code <span className="micro">(if two-factor is on)</span>
              </label>
              <input
                id="sync-totp"
                className="input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123 456"
                value={totpCode}
                onChange={(event) => setTotpCode(event.target.value)}
              />
            </div>
            {authError ? (
              <p className="field-error" role="alert">
                {authError}
              </p>
            ) : null}
            {notice ? <p className="panel-note">{notice}</p> : null}
            <div className="settings-actions">
              <Button variant="primary" type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
            </div>
          </form>
          <form className="sync-form" onSubmit={(event) => void submitInvite(event)}>
            <p className="panel-note">
              <strong>Have an invite?</strong> Paste the link or token your admin sent you, then
              choose a password (12+ characters).
            </p>
            <div className="sync-field">
              <label className="field__label" htmlFor="sync-invite-token">
                Invite link or token
              </label>
              <input
                id="sync-invite-token"
                className="input"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://app.example.com/#token=…"
                value={inviteToken}
                onChange={(event) => setInviteToken(event.target.value)}
                required
              />
            </div>
            <div className="sync-field">
              <label className="field__label" htmlFor="sync-invite-password">
                New password
              </label>
              <input
                id="sync-invite-password"
                className="input"
                type="password"
                autoComplete="new-password"
                minLength={12}
                placeholder="12+ characters"
                value={invitePassword}
                onChange={(event) => setInvitePassword(event.target.value)}
                required
              />
            </div>
            <div className="settings-actions">
              <Button variant="primary" type="submit" disabled={busy}>
                Accept invite
              </Button>
            </div>
          </form>
          <form className="sync-form" onSubmit={(event) => void submitReset(event)}>
            <p className="panel-note">
              <strong>Forgot your password?</strong> Paste the reset link your admin sent you,
              then choose a new password (12+ characters).
            </p>
            <div className="sync-field">
              <label className="field__label" htmlFor="sync-reset-token">
                Reset link or token
              </label>
              <input
                id="sync-reset-token"
                className="input"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Paste the reset link or token"
                value={resetToken}
                onChange={(event) => setResetToken(event.target.value)}
                required
              />
            </div>
            <div className="sync-field">
              <label className="field__label" htmlFor="sync-reset-password">
                New password
              </label>
              <input
                id="sync-reset-password"
                className="input"
                type="password"
                autoComplete="new-password"
                minLength={12}
                placeholder="12+ characters"
                value={resetPasswordValue}
                onChange={(event) => setResetPasswordValue(event.target.value)}
                required
              />
            </div>
            <div className="settings-actions">
              <Button variant="primary" type="submit" disabled={busy}>
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
