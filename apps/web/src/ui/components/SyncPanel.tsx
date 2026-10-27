import { useState } from 'react'
import type { FormEvent } from 'react'
import { extractAuthToken, isAuthToken } from '@lifespire/app-core/sync/authLink'
import { newPasswordProblem } from '@lifespire/app-core/sync/password'
import { finishDesktopSignOut } from '../../sync/api'
import { useAuthStore } from '../../sync/authStore'
import { useSyncStore } from '../../sync/setup'
import { Button } from '../components'
import { authErrorMessage } from '../lib/authError'

export function SyncPanel() {
  const serverVersion = useSyncStore((state) => state.serverVersion)
  const lastAutoMergeAt = useSyncStore((state) => state.lastAutoMergeAt)
  const lastError = useSyncStore((state) => state.lastError)
  const lastPushedAt = useSyncStore((state) => state.lastPushedAt)
  const authStatus = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)
  const authError = useAuthStore((state) => state.error)
  const clearError = useAuthStore((state) => state.clearError)
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
  const [loginBusy, setLoginBusy] = useState(false)
  const [inviteBusy, setInviteBusy] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const [inviteNotice, setInviteNotice] = useState<string | null>(null)
  const [resetNotice, setResetNotice] = useState<string | null>(null)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const authBusy = loginBusy || inviteBusy || resetBusy

  const submitSignOut = async (): Promise<void> => {
    setSignOutError(null)
    try {
      await finishDesktopSignOut(logout)
      setInviteNotice(null)
    } catch (error) {
      setSignOutError(
        error instanceof Error ? error.message : 'Could not clear the session on this device.',
      )
    }
  }

  const submitLogin = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setLoginError(null)
    clearError()
    if (!email.trim() || !password) {
      setLoginError('Enter your email and password.')
      return
    }
    setLoginBusy(true)
    try {
      const code = totpCode.trim()
      await login(email, password, code.length > 0 ? code : undefined)
    } catch {
      // The error is already surfaced through the auth store and shown below.
    } finally {
      setLoginBusy(false)
    }
  }

  const submitInvite = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setInviteError(null)
    setInviteNotice(null)
    clearError()
    const token = extractAuthToken(inviteToken)
    if (!isAuthToken(token)) {
      setInviteError('Paste the full invite link or its 43-character token.')
      return
    }
    const passwordIssue = newPasswordProblem(invitePassword)
    if (passwordIssue) {
      setInviteError(passwordIssue)
      return
    }
    setInviteBusy(true)
    try {
      await acceptInvite(token, invitePassword)
      setInviteNotice('Invite accepted — you are signed in on this device.')
      setInviteToken('')
      setInvitePassword('')
    } catch (error) {
      setInviteError(authErrorMessage(error, 'invite'))
      clearError()
    } finally {
      setInviteBusy(false)
    }
  }

  const submitReset = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setResetError(null)
    setResetNotice(null)
    clearError()
    const token = extractAuthToken(resetToken)
    if (!isAuthToken(token)) {
      setResetError('Paste the full reset link or its 43-character token.')
      return
    }
    const passwordIssue = newPasswordProblem(resetPasswordValue)
    if (passwordIssue) {
      setResetError(passwordIssue)
      return
    }
    setResetBusy(true)
    try {
      await resetPassword(token, resetPasswordValue)
      setResetNotice('Password updated — sign in with the new password.')
      setResetToken('')
      setResetPasswordValue('')
    } catch (error) {
      setResetError(authErrorMessage(error, 'reset'))
      clearError()
    } finally {
      setResetBusy(false)
    }
  }

  return (
    <>
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
          {inviteNotice ? (
            <p className="panel-note" role="status">
              {inviteNotice}
            </p>
          ) : null}
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
          <form className="sync-form" onSubmit={(event) => void submitLogin(event)} noValidate>
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
                onChange={(event) => {
                  setEmail(event.target.value)
                  setLoginError(null)
                  clearError()
                }}
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
                onChange={(event) => {
                  setPassword(event.target.value)
                  setLoginError(null)
                  clearError()
                }}
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
            {loginError ?? authError ? (
              <p className="field-error" role="alert">
                {loginError ?? authError}
              </p>
            ) : null}
            <div className="settings-actions">
              <Button variant="primary" type="submit" disabled={authBusy}>
                {loginBusy ? 'Signing in…' : 'Sign in'}
              </Button>
            </div>
          </form>

          <form className="sync-form" onSubmit={(event) => void submitInvite(event)} noValidate>
            <p className="panel-note">
              <strong>Have an invite?</strong> Paste the link or token your admin sent you, then
              choose a password.
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
                autoCapitalize="none"
                spellCheck={false}
                placeholder="https://app.example.com/accept-invite#token=…"
                value={inviteToken}
                onChange={(event) => {
                  setInviteToken(event.target.value)
                  setInviteError(null)
                  setInviteNotice(null)
                }}
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
                onChange={(event) => {
                  setInvitePassword(event.target.value)
                  setInviteError(null)
                  setInviteNotice(null)
                }}
                required
              />
              <p className="field-hint">
                12+ characters, at least 5 different; avoid common phrases.
              </p>
            </div>
            {inviteError ? (
              <p className="field-error" role="alert">
                {inviteError}
              </p>
            ) : null}
            <div className="settings-actions">
              <Button variant="primary" type="submit" disabled={authBusy}>
                {inviteBusy ? 'Accepting…' : 'Accept invite'}
              </Button>
            </div>
          </form>

          <form className="sync-form" onSubmit={(event) => void submitReset(event)} noValidate>
            <p className="panel-note">
              <strong>Forgot your password?</strong> Paste the reset link your admin sent you,
              then choose a new password.
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
                autoCapitalize="none"
                spellCheck={false}
                placeholder="https://app.example.com/reset-password#token=…"
                value={resetToken}
                onChange={(event) => {
                  setResetToken(event.target.value)
                  setResetError(null)
                  setResetNotice(null)
                }}
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
                onChange={(event) => {
                  setResetPasswordValue(event.target.value)
                  setResetError(null)
                  setResetNotice(null)
                }}
                required
              />
              <p className="field-hint">
                12+ characters, at least 5 different; avoid common phrases.
              </p>
            </div>
            {resetError ? (
              <p className="field-error" role="alert">
                {resetError}
              </p>
            ) : null}
            {resetNotice ? (
              <p className="panel-note" role="status">
                {resetNotice}
              </p>
            ) : null}
            <div className="settings-actions">
              <Button variant="primary" type="submit" disabled={authBusy}>
                {resetBusy ? 'Saving…' : 'Set new password'}
              </Button>
            </div>
          </form>

          <p className="panel-note settings-note">
            No signup here — accounts are created by an admin invite.
          </p>
        </div>
      )}
    </>
  )
}
