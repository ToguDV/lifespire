import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { Field, Input } from './Field'
import { Icon } from './Icon'
import { Text } from './Text'
import { devError } from '../lib/devLogger'
import { accountLinkErrorMessage, loginProblem, validateAccountLink } from '../lib/syncForm'
import {
  checkServerHealth,
  clearStoredBaseUrl,
  getStoredBaseUrl,
  getSyncBaseUrl,
  refreshSyncApi,
  setStoredBaseUrl,
  validateServerUrl,
} from '../sync/api'
import { useAuthStore } from '../sync/auth'
import { useSyncStore } from '../sync/setup'
import { useAppStore } from '../state/store'

/**
 * Account and server dialog shared by Settings and the welcome screen, so a
 * player without a local profile can sign in, accept an invite or paste a
 * password-reset link before starting a run.
 */
export function SyncDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme()
  const user = useAuthStore((state) => state.user)
  const authStatus = useAuthStore((state) => state.status)
  const authError = useAuthStore((state) => state.error)
  const clearError = useAuthStore((state) => state.clearError)
  const login = useAuthStore((state) => state.login)
  const acceptInvite = useAuthStore((state) => state.acceptInvite)
  const resetPassword = useAuthStore((state) => state.resetPassword)
  const logout = useAuthStore((state) => state.logout)
  const showToast = useAppStore((state) => state.showToast)
  const serverVersion = useSyncStore((state) => state.serverVersion)
  const lastPushedAt = useSyncStore((state) => state.lastPushedAt)
  const signedIn = authStatus === 'authenticated' && user !== null

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [inviteToken, setInviteToken] = useState('')
  const [invitePassword, setInvitePassword] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteNotice, setInviteNotice] = useState<string | null>(null)
  const [resetToken, setResetToken] = useState('')
  const [resetNewPassword, setResetNewPassword] = useState('')
  const [resetBusy, setResetBusy] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetNotice, setResetNotice] = useState<string | null>(null)
  const [serverOpen, setServerOpen] = useState(false)
  const [serverInput, setServerInput] = useState(getStoredBaseUrl() ?? '')
  const [serverNotice, setServerNotice] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const effective = getSyncBaseUrl() || 'Not configured'

  const submitLogin = async () => {
    setLoginError(null)
    clearError()
    const problem = loginProblem(email, password)
    if (problem) {
      setLoginError(problem)
      return
    }
    setLoginBusy(true)
    try {
      await login(email, password, totp.trim() || undefined)
      setPassword('')
      setTotp('')
      showToast('Signed in. Sync starts on this device.')
    } catch (error) {
      devError('auth', 'sign-in failed', error)
    } finally {
      setLoginBusy(false)
    }
  }

  const submitInvite = async () => {
    setInviteError(null)
    setInviteNotice(null)
    clearError()
    const validation = validateAccountLink('invite', inviteToken, invitePassword)
    if (!validation.ok) {
      setInviteError(validation.error)
      return
    }
    setInviteBusy(true)
    try {
      await acceptInvite(validation.token, invitePassword)
      setInviteNotice('Invite accepted — you are signed in on this device.')
      setInviteToken('')
      setInvitePassword('')
    } catch (error) {
      devError('auth', 'invite acceptance failed', error)
      setInviteError(accountLinkErrorMessage(error, 'invite'))
      clearError()
    } finally {
      setInviteBusy(false)
    }
  }

  const submitReset = async () => {
    setResetError(null)
    setResetNotice(null)
    clearError()
    const validation = validateAccountLink('reset', resetToken, resetNewPassword)
    if (!validation.ok) {
      setResetError(validation.error)
      return
    }
    setResetBusy(true)
    try {
      await resetPassword(validation.token, resetNewPassword)
      setResetNotice('Password updated — sign in with the new password.')
      setResetToken('')
      setResetNewPassword('')
    } catch (error) {
      devError('auth', 'password reset failed', error)
      setResetError(accountLinkErrorMessage(error, 'reset'))
      clearError()
    } finally {
      setResetBusy(false)
    }
  }

  const saveServer = async () => {
    setChecking(true)
    setServerError(null)
    setServerNotice(null)
    try {
      const validation = validateServerUrl(serverInput)
      if (!validation.ok) {
        setServerError(validation.error)
        return
      }
      await checkServerHealth(validation.normalized)
      await logout()
      setStoredBaseUrl(validation.normalized)
      refreshSyncApi()
      setServerInput(validation.normalized)
      setServerNotice(`Pointing at ${validation.normalized}. Sign in again.`)
    } catch (error) {
      devError('auth', 'server check or switch failed', error)
      setServerError(error instanceof Error ? error.message : 'That server could not be reached.')
    } finally {
      setChecking(false)
    }
  }

  const clearServer = async () => {
    try {
      await logout()
      clearStoredBaseUrl()
      refreshSyncApi()
      setServerInput('')
      setServerNotice('Using the build default server. Sign in again.')
    } catch (error) {
      devError('auth', 'could not clear the server override', error)
      setServerError('The server override could not be cleared.')
    }
  }

  return (
    <Dialog
      visible={visible}
      title="Sync"
      description="Sign in to sync this save between your devices."
      onClose={onClose}
      actions={
        <Button variant="quiet" onPress={onClose}>
          Close
        </Button>
      }
    >
      {signedIn ? (
        <View style={styles.syncBody}>
          {inviteNotice ? (
            <Text
              variant="caption"
              tone="accent"
              accessibilityLiveRegion="polite"
            >
              {inviteNotice}
            </Text>
          ) : null}
          {user ? (
            <Text variant="bodySm">
              Signed in as <Text variant="bodySm" tone="accent">{user.email}</Text>
            </Text>
          ) : null}
          <Text variant="caption" tone="muted">
            {serverVersion ? `Cloud v${serverVersion}` : 'No cloud save yet'}
            {lastPushedAt ? ` · last push ${new Date(lastPushedAt).toLocaleTimeString()}` : ''}
          </Text>
          <Text variant="caption" tone="soft">
            Signing out keeps a copy on this device.
          </Text>
          <View style={styles.formActions}>
            <Button variant="quiet" small onPress={() => void logout()}>
              Sign out
            </Button>
          </View>
        </View>
      ) : (
        <View style={styles.syncBody}>
          <Text variant="bodySm" tone="muted">
            Optional sync between your devices. Guests keep playing locally.
          </Text>

          <Field label="Email">
            <Input
              accessibilityLabel="Email"
              value={email}
              onChangeText={(value) => {
                setEmail(value)
                setLoginError(null)
                clearError()
              }}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              editable={!loginBusy}
            />
          </Field>
          <Field label="Password">
            <Input
              accessibilityLabel="Password"
              minLength={12}
              value={password}
              onChangeText={(value) => {
                setPassword(value)
                setLoginError(null)
                clearError()
              }}
              placeholder="At least 12 characters"
              autoComplete="current-password"
              secureTextEntry
              editable={!loginBusy}
            />
          </Field>
          <Field label="Authenticator code" hint="Only if two-factor is on.">
            <Input
              accessibilityLabel="Authenticator code"
              value={totp}
              onChangeText={(value) => {
                setTotp(value)
                setLoginError(null)
                clearError()
              }}
              keyboardType="number-pad"
              maxLength={8}
              editable={!loginBusy}
            />
          </Field>
          {loginError ?? authError ? (
            <Text variant="caption" tone="default" accessibilityRole="alert">
              {loginError ?? authError}
            </Text>
          ) : null}
          <Button onPress={() => void submitLogin()} loading={loginBusy}>
            {loginBusy ? 'Signing in…' : 'Sign in'}
          </Button>

          <View style={[styles.formSection, { borderColor: colors.hairline }]}>
            <Text variant="headingSm">Have an invite?</Text>
            <Text variant="caption" tone="muted">
              Paste the link or token your admin sent you, then choose a password.
            </Text>
            <Field
              label="Invite link or token"
              hint="The full link or its 43-character token."
            >
              <Input
                accessibilityLabel="Invite link or token"
                value={inviteToken}
                onChangeText={(value) => {
                  setInviteToken(value)
                  setInviteError(null)
                  setInviteNotice(null)
                  clearError()
                }}
                placeholder="https://…/accept-invite#token=…"
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                editable={!inviteBusy}
              />
            </Field>
            <Field
              label="New password"
              hint="12+ characters, at least 5 different; avoid common phrases."
            >
              <Input
                accessibilityLabel="New password for the invite"
                minLength={12}
                value={invitePassword}
                onChangeText={(value) => {
                  setInvitePassword(value)
                  setInviteError(null)
                  setInviteNotice(null)
                  clearError()
                }}
                placeholder="12+ characters"
                autoComplete="new-password"
                secureTextEntry
                editable={!inviteBusy}
              />
            </Field>
            {inviteError ? (
              <Text variant="caption" tone="default" accessibilityRole="alert">
                {inviteError}
              </Text>
            ) : null}
            <View style={styles.formActions}>
              <Button
                variant="secondary"
                small
                loading={inviteBusy}
                onPress={() => void submitInvite()}
              >
                {inviteBusy ? 'Accepting…' : 'Accept invite'}
              </Button>
            </View>
          </View>

          <View style={[styles.formSection, { borderColor: colors.hairline }]}>
            <Text variant="headingSm">Forgot your password?</Text>
            <Text variant="caption" tone="muted">
              Paste the reset link your admin sent you, then choose a new password.
            </Text>
            <Field label="Reset link or token" hint="The full link or its 43-character token.">
              <Input
                accessibilityLabel="Reset link or token"
                value={resetToken}
                onChangeText={(value) => {
                  setResetToken(value)
                  setResetError(null)
                  setResetNotice(null)
                  clearError()
                }}
                placeholder="https://…/reset-password#token=…"
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                editable={!resetBusy}
              />
            </Field>
            <Field
              label="New password"
              hint="12+ characters, at least 5 different; avoid common phrases."
            >
              <Input
                accessibilityLabel="New password"
                minLength={12}
                value={resetNewPassword}
                onChangeText={(value) => {
                  setResetNewPassword(value)
                  setResetError(null)
                  setResetNotice(null)
                  clearError()
                }}
                placeholder="12+ characters"
                autoComplete="new-password"
                secureTextEntry
                editable={!resetBusy}
              />
            </Field>
            {resetError ? (
              <Text variant="caption" tone="default" accessibilityRole="alert">
                {resetError}
              </Text>
            ) : null}
            {resetNotice ? (
              <Text variant="caption" tone="accent" accessibilityLiveRegion="polite">
                {resetNotice}
              </Text>
            ) : null}
            <View style={styles.formActions}>
              <Button
                variant="secondary"
                small
                loading={resetBusy}
                onPress={() => void submitReset()}
              >
                {resetBusy ? 'Saving…' : 'Set new password'}
              </Button>
            </View>
          </View>

          <Text variant="caption" tone="soft">
            No signup here — accounts are created by an admin invite.
          </Text>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Server"
        accessibilityState={{ expanded: serverOpen }}
        onPress={() => setServerOpen((value) => !value)}
        style={[styles.disclosure, { borderColor: colors.hairline }]}
      >
        <Text variant="caption" tone="muted">
          Server
        </Text>
        <View style={serverOpen ? styles.chevronOpen : undefined}>
          <Icon name="chevron-right" size={14} color={colors.inkMuted} />
        </View>
      </Pressable>
      {serverOpen ? (
        <View style={[styles.server, { borderColor: colors.hairline }]}>
          <Text variant="caption" tone="soft">Current server: {effective}</Text>
          <Field label="Server URL" hint="Changing the server signs you out.">
            <Input
              accessibilityLabel="Server URL"
              value={serverInput}
              onChangeText={setServerInput}
              placeholder="https://sync.example.com"
              autoCapitalize="none"
              autoComplete="off"
              keyboardType="url"
            />
          </Field>
          {serverError ? <Text variant="caption" tone="default">{serverError}</Text> : null}
          {serverNotice ? <Text variant="caption" tone="accent">{serverNotice}</Text> : null}
          <View style={styles.serverActions}>
            <Button variant="secondary" small onPress={() => void saveServer()} loading={checking}>
              Check and save
            </Button>
            <Button variant="quiet" small onPress={() => void clearServer()}>
              Use default
            </Button>
          </View>
        </View>
      ) : null}
    </Dialog>
  )
}

const styles = StyleSheet.create({
  syncBody: { gap: space.sm },
  formSection: {
    gap: space.sm,
    marginTop: space.xxs,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.xs, flexWrap: 'wrap' },
  server: { gap: space.xs, borderWidth: 1, borderRadius: radius.md, padding: space.sm },
  serverActions: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
  disclosure: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: space.sm,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
})
