import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { extractAuthToken, isAuthToken } from '@lifespire/app-core/sync/authLink'
import { newPasswordProblem } from '@lifespire/app-core/sync/password'
import { finishDesktopSignOut, waitForDesktopTransport } from '../../sync/api'
import { useAuthStore } from '../../sync/authStore'
import { Button, Icon, Panel, ThemeToggle } from '../components'
import { authErrorMessage } from '../lib/authError'
import type { AuthRoute } from '../lib/authRoute'

type Done = { kind: 'reset' } | { kind: 'invite'; email: string | null }

function clearUrl(): void {
  try {
    window.history.replaceState(null, '', '/')
  } catch {
    // A blocked history API must not hide the successful reset.
  }
}

function goHome(): void {
  try {
    window.location.replace('/')
  } catch {
    clearUrl()
  }
}

export function AuthLinkScreen({ route }: { route: AuthRoute }) {
  const resetPassword = useAuthStore((state) => state.resetPassword)
  const acceptInvite = useAuthStore((state) => state.acceptInvite)
  const logout = useAuthStore((state) => state.logout)

  const reset = route.kind === 'reset'
  const [token, setToken] = useState(route.token ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const tokenRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    document.title = done
      ? `${done.kind === 'reset' ? 'Password updated' : 'Invite accepted'} · LifeSpire`
      : `${reset ? 'Reset password' : 'Accept invite'} · LifeSpire`
    document.body.dataset.screen = 'auth-link'
    if (done) {
      headingRef.current?.focus()
    } else if (route.token) {
      passwordRef.current?.focus()
    } else {
      tokenRef.current?.focus()
    }
  }, [done, reset, route.token])

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setError(null)
    const cleaned = extractAuthToken(token)
    if (!isAuthToken(cleaned)) {
      setError('Paste the full link from your admin or the 43-character token.')
      return
    }
    const passwordIssue = newPasswordProblem(password)
    if (passwordIssue) {
      setError(passwordIssue)
      return
    }
    if (password !== confirm) {
      setError('The passwords do not match.')
      return
    }

    setBusy(true)
    try {
      // Desktop builds configure the main-process proxy asynchronously.
      await waitForDesktopTransport()
      if (reset) {
        await resetPassword(cleaned, password)
        if (useAuthStore.getState().status === 'authenticated') {
          try {
            await finishDesktopSignOut(logout)
          } catch {
            // The password changed; local session cleanup is best-effort.
          }
        }
        setPassword('')
        setConfirm('')
        setDone({ kind: 'reset' })
      } else {
        await acceptInvite(cleaned, password)
        const email = useAuthStore.getState().user?.email ?? null
        setPassword('')
        setConfirm('')
        setDone({ kind: 'invite', email })
      }
      clearUrl()
    } catch (err) {
      setError(authErrorMessage(err, route.kind))
    } finally {
      setBusy(false)
    }
  }

  const title = done
    ? done.kind === 'reset'
      ? 'Password updated'
      : 'Invite accepted'
    : reset
      ? 'Choose a new password'
      : 'Accept your invite'

  return (
    <section
      className="screen screen--welcome"
      data-screen="auth-link"
      aria-labelledby="auth-link-title"
    >
      <div className="welcome-top">
        <span className="brand" aria-label="LifeSpire">
          <Icon name="spire" className="brand__mark" />
          <span className="brand__word">LifeSpire</span>
        </span>
        <ThemeToggle />
      </div>

      <div className="auth-link-shell">
        <Panel pad>
          <span className="kicker">{reset ? 'Account recovery' : 'Closed beta invite'}</span>
          <h1 id="auth-link-title" ref={headingRef} tabIndex={-1}>
            {title}
          </h1>

          {done ? (
            <>
              <p className="panel-note" role="status">
                {done.kind === 'reset'
                  ? 'Sign in with your new password. Any sessions on this account were signed out.'
                  : done.email
                    ? `You are signed in as ${done.email}.`
                    : 'You are signed in on this device.'}
              </p>
              <div className="settings-actions">
                <Button variant="primary" onClick={goHome}>
                  Continue to LifeSpire
                </Button>
              </div>
            </>
          ) : (
            <form className="sync-form" onSubmit={(event) => void submit(event)} noValidate>
              <p className="panel-note">
                {reset
                  ? 'Paste the reset link from your admin and choose a new password.'
                  : 'Paste the invite link from your admin and choose a password.'}
              </p>

              <div className="sync-field">
                <label className="field__label" htmlFor="auth-link-token">
                  {reset ? 'Reset link or token' : 'Invite link or token'}
                </label>
                <input
                  ref={tokenRef}
                  id="auth-link-token"
                  className="input"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={reset ? 'https://…/reset-password#token=…' : 'https://…/accept-invite#token=…'}
                  value={token}
                  disabled={busy}
                  onChange={(event) => {
                    setToken(event.target.value)
                    setError(null)
                  }}
                  required
                />
                <p className="field-hint">The full link or its 43-character token.</p>
              </div>

              <div className="sync-field">
                <label className="field__label" htmlFor="auth-link-password">
                  New password
                </label>
                <input
                  ref={passwordRef}
                  id="auth-link-password"
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  placeholder="12+ characters"
                  value={password}
                  disabled={busy}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setError(null)
                  }}
                  required
                />
                <p className="field-hint">
                  12+ characters, at least 5 different; avoid common phrases.
                </p>
              </div>

              <div className="sync-field">
                <label className="field__label" htmlFor="auth-link-confirm">
                  Confirm new password
                </label>
                <input
                  id="auth-link-confirm"
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  disabled={busy}
                  onChange={(event) => {
                    setConfirm(event.target.value)
                    setError(null)
                  }}
                  required
                />
              </div>

              {error ? (
                <p className="field-error" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="settings-actions">
                <Button variant="primary" type="submit" disabled={busy}>
                  {busy ? 'Saving…' : reset ? 'Set new password' : 'Accept invite'}
                </Button>
                <Button variant="quiet" onClick={goHome} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </Panel>

        <p className="welcome-foot">
          <Icon name="lock" />
          {reset
            ? 'The link is single-use and expires one hour after it is generated.'
            : 'The invite is single-use and expires after 72 hours.'}
        </p>
      </div>
    </section>
  )
}
