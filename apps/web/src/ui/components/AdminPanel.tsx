import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { AdminUser } from '@lifespire/api-client'
import { syncApi } from '../../sync/api'
import { useAuthStore } from '../../sync/authStore'
import { Button, Panel, PanelHead } from '../components'

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    try {
      const area = window.document.createElement('textarea')
      area.value = value
      area.setAttribute('readonly', '')
      area.style.position = 'absolute'
      area.style.left = '-9999px'
      window.document.body.append(area)
      area.select()
      const ok = window.document.execCommand('copy')
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}

function formatSync(value: string | null): string {
  if (!value) return 'never'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return 'never'
  }
}

function TotpSetup() {
  const startTotpSetup = useAuthStore((state) => state.startTotpSetup)
  const confirmTotpSetup = useAuthStore((state) => state.confirmTotpSetup)
  const totpSetup = useAuthStore((state) => state.totpSetup)
  const authError = useAuthStore((state) => state.error)
  const [currentPassword, setCurrentPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const submitStart = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    try {
      await startTotpSetup(currentPassword)
    } catch {
      // The error is already surfaced through the auth store.
    } finally {
      setBusy(false)
    }
  }

  const submitConfirm = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    try {
      await confirmTotpSetup(code.trim())
      setCode('')
      setCurrentPassword('')
    } catch {
      // The error is already surfaced through the auth store.
    } finally {
      setBusy(false)
    }
  }

  const copySecret = async (): Promise<void> => {
    if (!totpSetup) return
    const ok = await copyText(
      `Secret: ${totpSetup.manualSecret}\nRecovery codes:\n${totpSetup.recoveryCodes.join('\n')}`,
    )
    setCopied(ok)
  }

  return (
    <div className="sync-panel">
      <p className="panel-note" role="alert">
        <strong>Two-factor is required for admins.</strong> Set it up before managing accounts,
        then sign in again with an authenticator code.
      </p>
      {!totpSetup ? (
        <form onSubmit={(event) => void submitStart(event)}>
          <label className="field__label" htmlFor="admin-totp-password">
            Current password
          </label>
          <input
            id="admin-totp-password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
          {authError ? (
            <p className="panel-note" role="alert">
              {authError}
            </p>
          ) : null}
          <div className="settings-actions">
            <Button variant="secondary" type="submit" disabled={busy}>
              {busy ? 'Starting…' : 'Start setup'}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className="panel-note">
            Scan this address in your authenticator app, or enter the secret by hand:
          </p>
          <p className="panel-note">
            <code>{totpSetup.otpauthUrl}</code>
          </p>
          <label className="field__label" htmlFor="admin-totp-secret">
            Manual secret
          </label>
          <input
            id="admin-totp-secret"
            className="input"
            type="text"
            readOnly
            value={totpSetup.manualSecret}
          />
          <p className="panel-note">
            Recovery codes — store them somewhere safe, each works once:
          </p>
          <ul>
            {totpSetup.recoveryCodes.map((recovery) => (
              <li key={recovery} className="panel-note">
                <code>{recovery}</code>
              </li>
            ))}
          </ul>
          <div className="settings-actions">
            <Button variant="secondary" onClick={() => void copySecret()}>
              {copied ? 'Copied' : 'Copy secret + codes'}
            </Button>
          </div>
          <form onSubmit={(event) => void submitConfirm(event)}>
            <label className="field__label" htmlFor="admin-totp-code">
              Authenticator code
            </label>
            <input
              id="admin-totp-code"
              className="input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
            {authError ? (
              <p className="panel-note" role="alert">
                {authError}
              </p>
            ) : null}
            <div className="settings-actions">
              <Button variant="secondary" type="submit" disabled={busy}>
                {busy ? 'Confirming…' : 'Enable two-factor'}
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}

export function AdminPanel() {
  const user = useAuthStore((state) => state.user)
  const totpSetupRequired = useAuthStore((state) => state.totpSetupRequired)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'USER' | 'ADMIN'>('USER')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const loadUsers = useCallback(async (): Promise<void> => {
    setLoading(true)
    setListError(null)
    try {
      const out = await syncApi.listUsers()
      setUsers(out.users)
      setTotal(out.total)
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'Could not load users.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.role === 'ADMIN' && !totpSetupRequired) void loadUsers()
  }, [user?.role, totpSetupRequired, loadUsers])

  if (!user || user.role !== 'ADMIN') return null

  const submitCreate = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setCreating(true)
    setCreateError(null)
    setInviteLink(null)
    setCopied(false)
    try {
      const out = await syncApi.createUser(email.trim(), role)
      setInviteLink(out.inviteLink)
      setEmail('')
      await loadUsers()
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Could not create the account.')
    } finally {
      setCreating(false)
    }
  }

  const copyInvite = async (): Promise<void> => {
    if (!inviteLink) return
    setCopied(await copyText(inviteLink))
  }

  return (
    <Panel pad>
      <PanelHead
        label="Admin"
        aside={
          <span className="chip chip--quiet">
            {totpSetupRequired ? 'two-factor required' : `${total} accounts`}
          </span>
        }
      />
      {totpSetupRequired ? (
        <TotpSetup />
      ) : (
        <div className="sync-panel">
          <form onSubmit={(event) => void submitCreate(event)}>
            <p className="panel-note">
              <strong>Create an account.</strong> The invite link works once — deliver it
              yourself; the server never sends email.
            </p>
            <label className="field__label" htmlFor="admin-email">
              Email
            </label>
            <input
              id="admin-email"
              className="input"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <span className="field__label" id="admin-role-label">
              Role
            </span>
            <div
              className="segmented segmented--wide"
              role="group"
              aria-labelledby="admin-role-label"
            >
              {(['USER', 'ADMIN'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={role === option}
                  onClick={() => setRole(option)}
                >
                  {option === 'USER' ? 'User' : 'Admin'}
                </button>
              ))}
            </div>
            {createError ? (
              <p className="panel-note" role="alert">
                {createError}
              </p>
            ) : null}
            <div className="settings-actions">
              <Button variant="secondary" type="submit" disabled={creating}>
                {creating ? 'Creating…' : 'Create account'}
              </Button>
            </div>
          </form>
          {inviteLink ? (
            <div>
              <label className="field__label" htmlFor="admin-invite-link">
                One-time invite link
              </label>
              <input
                id="admin-invite-link"
                className="input"
                type="text"
                readOnly
                value={inviteLink}
              />
              <div className="settings-actions">
                <Button variant="secondary" onClick={() => void copyInvite()}>
                  {copied ? 'Copied' : 'Copy invite link'}
                </Button>
              </div>
            </div>
          ) : null}
          <p className="panel-note">
            <strong>Accounts</strong>
            <span className="micro"> · email, role, status, devices, last sync</span>
          </p>
          {listError ? (
            <p className="panel-note" role="alert">
              {listError}
            </p>
          ) : null}
          {loading && users.length === 0 ? (
            <p className="panel-note">Loading…</p>
          ) : (
            <ul>
              {users.map((entry) => (
                <li key={entry.id} className="panel-note">
                  <strong>{entry.email}</strong>{' '}
                  <span className="chip chip--quiet">{entry.role.toLowerCase()}</span>{' '}
                  <span className="chip chip--quiet">{entry.status.toLowerCase()}</span>
                  <span className="micro">
                    {' '}
                    · {entry.deviceCount} device{entry.deviceCount === 1 ? '' : 's'} · last
                    sync {formatSync(entry.lastSyncAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="settings-actions">
            <Button variant="secondary" onClick={() => void loadUsers()} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh list'}
            </Button>
          </div>
          <p className="panel-note settings-note">
            Resend or revoke invites, disable accounts and password resets stay CLI/API-only in
            this slice.
          </p>
        </div>
      )}
    </Panel>
  )
}
