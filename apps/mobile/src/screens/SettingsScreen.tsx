import { useEffect, useState } from 'react'
import { Linking, Pressable, StyleSheet, Switch, View } from 'react-native'
import Constants from 'expo-constants'
import { SCHEMA_VERSION, STORAGE_KEY } from '@lifespire/core'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Button } from '../components/Button'
import { Field, Input } from '../components/Field'
import { Icon } from '../components/Icon'
import { Panel, PanelHead, ScreenHead } from '../components/Panel'
import { SaveImportDialog } from '../components/SaveImportDialog'
import { Screen } from '../components/Screen'
import { Text } from '../components/Text'
import { Dialog } from '../components/Dialog'
import { exportDocument, pickAndValidateSave } from '../lib/exportImport'
import type { PickedImportResult } from '../lib/exportImport'
import { devError } from '../lib/devLogger'
import { useAppStore } from '../state/store'
import { setFeedbackPrefs, useFeedbackPrefs } from '../state/feedback'
import { useNotificationPrefs, setNotificationPrefs, isTimeValue } from '../notifications/prefs'
import type { NotificationPrefs } from '../notifications/prefs'
import {
  getNotificationPermission,
  requestNotificationPermission,
  scheduleImmediateTest,
  syncScheduledNotifications,
} from '../notifications/scheduler'
import type { NotificationPermission } from '../notifications/scheduler'
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

function extractToken(raw: string): string {
  const trimmed = raw.trim()
  const fragment = trimmed.indexOf('#token=')
  if (fragment !== -1) return trimmed.slice(fragment + '#token='.length)
  const query = trimmed.indexOf('token=')
  if (query !== -1) return trimmed.slice(query + 'token='.length).split('&')[0] ?? ''
  return trimmed
}

const THEMES = [
  { value: 'light', label: 'Day' },
  { value: 'dark', label: 'Night' },
  { value: 'system', label: 'System' },
] as const

export function SettingsScreen() {
  const { colors } = useTheme()
  const document = useAppStore((state) => state.document)
  const setTheme = useAppStore((state) => state.setTheme)
  const importDocument = useAppStore((state) => state.importDocument)
  const resetAll = useAppStore((state) => state.resetAll)
  const showToast = useAppStore((state) => state.showToast)
  const feedback = useFeedbackPrefs()
  const prefs = useNotificationPrefs()
  const [permission, setPermission] = useState<NotificationPermission | 'loading'>('loading')
  const [importResult, setImportResult] = useState<PickedImportResult | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetPhrase, setResetPhrase] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void getNotificationPermission()
      .then(setPermission)
      .catch((error: unknown) => {
        devError('notifications', 'could not read the notification permission', error)
        setPermission('undetermined')
      })
  }, [])

  const exportSave = async () => {
    setBusy(true)
    try {
      await exportDocument(document)
      showToast('Save shared as a JSON file.')
    } catch (error) {
      devError('files', 'save export failed', error)
      showToast(error instanceof Error ? error.message : 'Could not export the save.')
    } finally {
      setBusy(false)
    }
  }

  const importSave = async () => {
    setBusy(true)
    try {
      const result = await pickAndValidateSave()
      if ('canceled' in result) return
      setImportResult(result)
    } catch (error) {
      devError('files', 'save import failed', error)
      showToast(error instanceof Error ? error.message : 'Could not read that file.')
    } finally {
      setBusy(false)
    }
  }

  const confirmReset = () => {
    if (resetPhrase !== 'RESET') return
    resetAll()
    setResetOpen(false)
    setResetPhrase('')
  }

  const enableNotifications = async (enabled: boolean) => {
    try {
      if (!enabled) {
        const next = setNotificationPrefs({ enabled: false })
        await syncScheduledNotifications(document, next)
        return
      }
      const result = await requestNotificationPermission()
      setPermission(result)
      if (result !== 'granted') {
        setNotificationPrefs({ enabled: false })
        showToast('Notifications are blocked in system settings.')
        return
      }
      const next = setNotificationPrefs({ enabled: true })
      await syncScheduledNotifications(document, next)
      showToast('Daily reminders are on.')
    } catch (error) {
      devError('notifications', 'could not enable or disable reminders', error, { enabled })
      showToast('Notifications could not be updated on this device.')
    }
  }

  const updatePrefs = async (patch: Partial<NotificationPrefs>) => {
    try {
      const next = setNotificationPrefs(patch)
      await syncScheduledNotifications(document, next)
    } catch (error) {
      devError('notifications', 'could not update notification preferences', error)
      showToast('That reminder setting could not be saved.')
    }
  }

  return (
    <Screen>
      <ScreenHead
        kicker="Profile · Local data"
        title="Settings"
        subtitle={
          <Text variant="bodyMd" tone="muted">
            Appearance, the local save, device reminders and optional sync.
          </Text>
        }
      />

      <SyncSection />

      <Panel>
        <PanelHead label="Appearance" />
        <View style={styles.choices}>
          {THEMES.map((option) => {
            const selected = document.settings.theme === option.value
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setTheme(option.value)}
                style={[
                  styles.choice,
                  {
                    borderColor: selected ? colors.accent : colors.hairline,
                    backgroundColor: selected ? colors.accentSoft : colors.surface,
                  },
                ]}
              >
                <Icon
                  name={option.value === 'dark' ? 'moon' : option.value === 'light' ? 'sun' : 'compass'}
                  size={15}
                  color={selected ? colors.accentDeep : colors.inkMuted}
                />
                <Text variant="caption" tone={selected ? 'deep' : 'muted'}>{option.label}</Text>
              </Pressable>
            )
          })}
        </View>
        <Text variant="caption" tone="soft" style={styles.note}>
          System follows the Android light/dark preference.
        </Text>
      </Panel>

      <Panel>
        <PanelHead label="Feedback" />
        <SettingRow
          title="Haptics"
          hint="A soft tap for selections, rewards and seals."
          value={feedback.haptics}
          onChange={(value) => setFeedbackPrefs({ haptics: value })}
        />
      </Panel>

      <Panel>
        <PanelHead label="Data" aside={<Text variant="caption" tone="soft">JSON</Text>} />
        <Text variant="bodySm" tone="muted">
          Export keeps the versioned save that web and Android share. Import validates the file and
          previews it before replacing anything.
        </Text>
        <View style={styles.actions}>
          <Button variant="secondary" icon="archive" onPress={() => void exportSave()} loading={busy} full>
            Export save
          </Button>
          <Button variant="secondary" icon="scroll" onPress={() => void importSave()} disabled={busy} full>
            Import save
          </Button>
        </View>
        <Text variant="caption" tone="soft">
          {STORAGE_KEY} · schema v{SCHEMA_VERSION}
        </Text>
      </Panel>

      <Panel>
        <PanelHead
          label="Notifications"
          aside={<Text variant="caption" tone={prefs.enabled ? 'accent' : 'soft'}>{prefs.enabled ? 'On' : 'Off'}</Text>}
        />
        <SettingRow
          title="Daily reminders"
          hint="Device-local. No server and no push service involved."
          value={prefs.enabled}
          onChange={(value) => void enableNotifications(value)}
        />
        {permission === 'denied' ? (
          <View style={styles.permissionBlock}>
            <Text variant="caption" tone="danger">
              Android is blocking LifeSpire notifications. Allow them in system settings.
            </Text>
            <Button variant="secondary" small onPress={() => void Linking.openSettings()}>
              Open system settings
            </Button>
          </View>
        ) : null}
        <View style={styles.notificationOptions}>
          <SettingRow
            title="Today's map is ready"
            value={prefs.dailyOpen}
            onChange={(value) => void updatePrefs({ dailyOpen: value })}
          />
          <TimeField
            label="Morning time"
            value={prefs.dailyTime}
            disabled={!prefs.dailyOpen}
            onCommit={(value) => void updatePrefs({ dailyTime: value })}
          />
          <SettingRow
            title="Evening nudge"
            value={prefs.eveningNudge}
            onChange={(value) => void updatePrefs({ eveningNudge: value })}
          />
          <TimeField
            label="Evening time"
            value={prefs.eveningTime}
            disabled={!prefs.eveningNudge}
            onCommit={(value) => void updatePrefs({ eveningTime: value })}
          />
          <SettingRow
            title="Week-end reminder"
            hint="A single note on the last day of the run."
            value={prefs.runEnd}
            onChange={(value) => void updatePrefs({ runEnd: value })}
          />
        </View>
        <Button
          variant="secondary"
          small
          disabled={!prefs.enabled || permission !== 'granted'}
          onPress={() => {
            scheduleImmediateTest()
            showToast('Test notification scheduled.')
          }}
        >
          Send a test notification
        </Button>
        <Text variant="caption" tone="soft" style={styles.note}>
          Notifications are scheduled on this device and respect the day you already sealed. Android
          may deliver them a few minutes late to save battery.
        </Text>
      </Panel>

      <Panel>
        <PanelHead label="Local data" aside={<Text variant="caption" tone="danger">Careful</Text>} />
        <Text variant="bodySm" tone="muted">
          Resetting removes the local save after copying it to a backup. It cannot be undone from
          here.
        </Text>
        <Button variant="danger" onPress={() => setResetOpen(true)} full>
          Reset all data
        </Button>
      </Panel>

      <Panel>
        <PanelHead label="About" />
        <Text variant="bodySm" tone="muted">
          LifeSpire for Android · version {Constants.expoConfig?.version ?? '0.1.0'} · schema v
          {SCHEMA_VERSION}
        </Text>
        <Text variant="caption" tone="soft" style={styles.note}>
          Local-first. A seven-day climb, one small promise at a time.
        </Text>
      </Panel>

      {__DEV__ ? <DevSection /> : null}

      <SaveImportDialog
        result={importResult}
        onClose={() => setImportResult(null)}
        onConfirm={(next) => {
          if (importDocument(next)) setImportResult(null)
        }}
      />

      <Dialog
        visible={resetOpen}
        eyebrow="Local data"
        title="Reset all data?"
        description="This removes the local save from this device and returns LifeSpire to onboarding."
        onClose={() => setResetOpen(false)}
        actions={
          <>
            <Button variant="quiet" onPress={() => setResetOpen(false)}>Cancel</Button>
            <Button variant="danger" disabled={resetPhrase !== 'RESET'} onPress={confirmReset}>
              Reset everything
            </Button>
          </>
        }
      >
        <Text variant="bodySm" tone="muted">
          The current save is copied to a backup before the key is removed.
        </Text>
        <Field
          label="Confirmation"
          hint="The reset button stays disabled until the word is typed exactly."
        >
          <Input
            value={resetPhrase}
            onChangeText={setResetPhrase}
            autoCapitalize="characters"
            autoFocus
            placeholder="RESET"
          />
        </Field>
      </Dialog>
    </Screen>
  )
}

function SettingRow({
  title,
  hint,
  value,
  onChange,
}: {
  title: string
  hint?: string
  value: boolean
  onChange: (value: boolean) => void
}) {
  const { colors } = useTheme()
  return (
    <View style={[styles.settingRow, { borderColor: colors.hairline }]}>
      <View style={styles.settingBody}>
        <Text variant="bodySm">{title}</Text>
        {hint ? <Text variant="caption" tone="muted">{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.surfaceSunken }}
        thumbColor={colors.surfaceRaised}
      />
    </View>
  )
}

function TimeField({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string
  value: string
  disabled?: boolean
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const valid = isTimeValue(draft)
  return (
    <Field
      label={`${label}${valid ? '' : ' · use HH:mm'}`}
      error={!valid ? 'Enter a time between 00:00 and 23:59.' : null}
    >
      <Input
        value={draft}
        editable={!disabled}
        onChangeText={setDraft}
        onBlur={() => {
          if (valid && draft !== value) onCommit(draft)
        }}
        placeholder="09:00"
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        style={disabled ? { opacity: 0.5 } : undefined}
      />
    </Field>
  )
}

function SyncSection() {
  const { colors } = useTheme()
  const authStatus = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)
  const authError = useAuthStore((state) => state.error)
  const login = useAuthStore((state) => state.login)
  const logout = useAuthStore((state) => state.logout)
  const acceptInvite = useAuthStore((state) => state.acceptInvite)
  const resetPassword = useAuthStore((state) => state.resetPassword)
  const syncStatus = useSyncStore((state) => state.status)
  const syncError = useSyncStore((state) => state.lastError)
  const lastPushedAt = useSyncStore((state) => state.lastPushedAt)
  const serverVersion = useSyncStore((state) => state.serverVersion)
  const showToast = useAppStore((state) => state.showToast)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [inviteToken, setInviteToken] = useState('')
  const [invitePassword, setInvitePassword] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [resetNewPassword, setResetNewPassword] = useState('')
  const [showExtras, setShowExtras] = useState(false)
  const [busy, setBusy] = useState(false)
  const [serverInput, setServerInput] = useState(getStoredBaseUrl() ?? '')
  const [serverNotice, setServerNotice] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const effective = getSyncBaseUrl() || 'Not configured'

  const submitLogin = async () => {
    setBusy(true)
    try {
      await login(email, password, totp.trim() || undefined)
      showToast('Signed in. Sync starts on this device.')
    } catch (error) {
      devError('auth', 'sign-in failed', error)
    } finally {
      setBusy(false)
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
    <Panel>
      <PanelHead
        label="Sync"
        aside={<Text variant="caption" tone="soft">{authStatus === 'authenticated' ? syncStatus : 'guest'}</Text>}
      />
      {authStatus === 'authenticated' && user ? (
        <View style={styles.syncBody}>
          <Text variant="bodySm">
            Signed in as <Text variant="bodySm" tone="accent">{user.email}</Text>
          </Text>
          <Text variant="caption" tone="muted">
            {serverVersion ? `Cloud v${serverVersion}` : 'No cloud save yet'}
            {lastPushedAt ? ` · last push ${new Date(lastPushedAt).toLocaleTimeString()}` : ''}
          </Text>
          {syncError ? <Text variant="caption" tone="danger">{syncError}</Text> : null}
          <Button variant="secondary" onPress={() => void logout()}>Sign out</Button>
          <Text variant="caption" tone="soft">
            Signing out keeps a per-account copy on this device. Offline edits queue and sync on
            reconnect.
          </Text>
        </View>
      ) : (
        <View style={styles.syncBody}>
          <Text variant="bodySm" tone="muted">
            Optional closed-beta sync. Guests keep playing locally.
          </Text>
          <Field label="Email">
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />
          </Field>
          <Field label="Password" hint="At least 12 characters.">
            <Input
              minLength={12}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 12 characters"
              autoComplete="current-password"
              secureTextEntry
            />
          </Field>
          <Field label="Authenticator code (admins only)">
            <Input value={totp} onChangeText={setTotp} keyboardType="number-pad" maxLength={8} />
          </Field>
          <Button onPress={() => void submitLogin()} loading={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
          {authError ? <Text variant="caption" tone="danger">{authError}</Text> : null}
          <Button variant="quiet" small onPress={() => setShowExtras((value) => !value)}>
            {showExtras ? 'Hide invite and password reset' : 'Invite and password reset'}
          </Button>
          {showExtras ? (
            <View style={styles.extras}>
              <Text variant="caption" tone="muted">Accept an invite (paste the link or token)</Text>
              <Input value={inviteToken} onChangeText={setInviteToken} placeholder="Paste invite link or token" />
              <Input value={invitePassword} onChangeText={setInvitePassword} placeholder="Choose a password" secureTextEntry />
              <Button
                variant="secondary"
                small
                onPress={() => {
                  void acceptInvite(extractToken(inviteToken), invitePassword).catch((error: unknown) => {
                    devError('auth', 'invite acceptance failed', error)
                  })
                }}
              >
                Accept invite
              </Button>
              <Text variant="caption" tone="muted">Reset a password</Text>
              <Input value={resetToken} onChangeText={setResetToken} placeholder="Paste reset token or link" />
              <Input value={resetNewPassword} onChangeText={setResetNewPassword} placeholder="New password" secureTextEntry />
              <Button
                variant="secondary"
                small
                onPress={() => {
                  void resetPassword(extractToken(resetToken), resetNewPassword).catch((error: unknown) => {
                    devError('auth', 'password reset failed', error)
                  })
                }}
              >
                Set new password
              </Button>
            </View>
          ) : null}
        </View>
      )}

      <View style={[styles.server, { borderColor: colors.hairline }]}>
        <Text variant="caption" tone="soft">Current server: {effective}</Text>
        <Field label="Server URL" hint="Changing the server signs you out.">
          <Input
            value={serverInput}
            onChangeText={setServerInput}
            placeholder="https://sync.example.com"
            autoCapitalize="none"
            autoComplete="off"
            keyboardType="url"
          />
        </Field>
        {serverError ? <Text variant="caption" tone="danger">{serverError}</Text> : null}
        {serverNotice ? <Text variant="caption" tone="accent">{serverNotice}</Text> : null}
        <View style={styles.serverActions}>
          <Button variant="secondary" small onPress={() => void saveServer()} loading={checking}>
            Check and save
          </Button>
          <Button variant="quiet" small onPress={() => void clearServer()}>
            Use default
          </Button>
        </View>
        <Text variant="caption" tone="soft">
          Android blocks plain HTTP outside localhost.
        </Text>
      </View>
    </Panel>
  )
}

function DevSection() {
  const devAdvanceDay = useAppStore((state) => state.devAdvanceDay)
  const devRestartRun = useAppStore((state) => state.devRestartRun)
  const devStartDemoRun = useAppStore((state) => state.devStartDemoRun)
  const devResetAll = useAppStore((state) => state.devResetAll)
  return (
    <Panel>
      <PanelHead label="Development" aside={<Text variant="caption" tone="soft">dev only</Text>} />
      <View style={styles.actions}>
        <Button variant="secondary" small onPress={() => devAdvanceDay(1)}>Advance a day</Button>
        <Button variant="secondary" small onPress={() => devRestartRun()}>Restart run</Button>
        <Button variant="secondary" small onPress={() => devStartDemoRun()}>Demo run</Button>
        <Button variant="danger" small onPress={() => devResetAll()}>Reset everything</Button>
      </View>
    </Panel>
  )
}

const styles = StyleSheet.create({
  choices: { flexDirection: 'row', gap: space.xs },
  choice: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderRadius: radius.md, paddingVertical: space.sm },
  note: { marginTop: space.sm },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: space.sm },
  settingBody: { flex: 1, gap: 2 },
  permissionBlock: { gap: space.xs, marginVertical: space.sm },
  notificationOptions: { marginTop: space.sm, gap: space.sm },
  actions: { gap: space.sm, marginVertical: space.sm },
  syncBody: { gap: space.sm },
  extras: { gap: space.xs, marginTop: space.xs },
  server: { gap: space.xs, borderWidth: 1, borderRadius: radius.md, padding: space.sm, marginTop: space.md },
  serverActions: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
})
