import { useEffect, useState } from 'react'
import { Linking, Pressable, StyleSheet, Switch, View } from 'react-native'
import { SCHEMA_VERSION, STORAGE_KEY } from '@lifespire/core'
import type { SyncStatus } from '@lifespire/app-core/sync/syncEngine'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Button } from '../components/Button'
import { Chip } from '../components/Chip'
import { Dialog } from '../components/Dialog'
import { Field, Input } from '../components/Field'
import { Icon } from '../components/Icon'
import { Panel, PanelHead, ScreenHead } from '../components/Panel'
import { SaveImportDialog } from '../components/SaveImportDialog'
import { Screen } from '../components/Screen'
import { SyncDialog } from '../components/SyncDialog'
import { Text } from '../components/Text'
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
import { useAuthStore } from '../sync/auth'
import { useSyncStore } from '../sync/setup'

const THEMES = [
  { value: 'light', label: 'Day' },
  { value: 'dark', label: 'Night' },
  { value: 'system', label: 'System' },
] as const

const SYNC_LABEL: Record<SyncStatus, string> = {
  disabled: 'Local only',
  synced: 'Synced',
  dirty: 'Saving…',
  pushing: 'Saving…',
  pulling: 'Checking…',
  offline: 'Offline',
  conflict: 'Needs review',
  error: 'Sync error',
  paused: 'Paused (dev clock)',
}

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
  const [showSaveDetails, setShowSaveDetails] = useState(false)
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
        subtitle="Appearance, sync and local data."
      />

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
        <SettingRow
          title="Vibration"
          value={feedback.haptics}
          onChange={(value) => setFeedbackPrefs({ haptics: value })}
        />
      </Panel>

      <SyncSection />

      <Panel>
        <PanelHead label="Data" />
        <Text variant="bodySm" tone="muted">
          Your save stays on this device.
        </Text>
        <View style={styles.actions}>
          <Button variant="secondary" icon="archive" onPress={() => void exportSave()} loading={busy} full>
            Export save
          </Button>
          <Button variant="secondary" icon="scroll" onPress={() => void importSave()} disabled={busy} full>
            Import save
          </Button>
          <Button variant="danger" onPress={() => setResetOpen(true)} full>
            Reset local data
          </Button>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save details"
          accessibilityState={{ expanded: showSaveDetails }}
          onPress={() => setShowSaveDetails((value) => !value)}
          style={[styles.disclosure, { borderColor: colors.hairline }]}
        >
          <Text variant="caption" tone="muted">
            Save details
          </Text>
          <View style={showSaveDetails ? styles.chevronOpen : undefined}>
            <Icon name="chevron-right" size={14} color={colors.inkMuted} />
          </View>
        </Pressable>
        {showSaveDetails ? (
          <View style={styles.details}>
            <Text variant="caption" tone="soft">{`Storage key: ${STORAGE_KEY}`}</Text>
            <Text variant="caption" tone="soft">{`Schema version: v${SCHEMA_VERSION}`}</Text>
          </View>
        ) : null}
      </Panel>

      <Panel>
        <PanelHead
          label="Reminders"
          aside={<Text variant="caption" tone={prefs.enabled ? 'accent' : 'soft'}>{prefs.enabled ? 'On' : 'Off'}</Text>}
        />
        <SettingRow
          title="Daily reminders"
          value={prefs.enabled}
          onChange={(value) => void enableNotifications(value)}
        />
        {permission === 'denied' ? (
          <View style={styles.permissionBlock}>
            <Text variant="caption" tone="default">
              Android is blocking LifeSpire notifications. Allow them in system settings.
            </Text>
            <Button variant="secondary" small onPress={() => void Linking.openSettings()}>
              Open system settings
            </Button>
          </View>
        ) : null}
        <View style={styles.notificationOptions}>
          <SettingRow
            title="Today’s map is ready"
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
      </Panel>

      {__DEV__ ? <DevSection /> : null}

      <SaveImportDialog
        result={importResult}
        onClose={() => setImportResult(null)}
        onConfirm={(next) => {
          if (!importDocument(next)) return false
          setImportResult(null)
          return true
        }}
      />

      <Dialog
        visible={resetOpen}
        eyebrow="Local data"
        title="Reset local data?"
        description="This removes the local save from this device and returns LifeSpire to onboarding."
        onClose={() => setResetOpen(false)}
        actions={
          <>
            <Button variant="quiet" onPress={() => setResetOpen(false)}>Keep my data</Button>
            <Button variant="danger" disabled={resetPhrase !== 'RESET'} onPress={confirmReset}>
              Reset everything
            </Button>
          </>
        }
      >
        <Field label="Type RESET to confirm">
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
  value,
  onChange,
}: {
  title: string
  value: boolean
  onChange: (value: boolean) => void
}) {
  const { colors } = useTheme()
  return (
    <View style={[styles.settingRow, { borderColor: colors.hairline }]}>
      <View style={styles.settingBody}>
        <Text variant="bodySm">{title}</Text>
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
  const syncStatus = useSyncStore((state) => state.status)
  const syncError = useSyncStore((state) => state.lastError)
  const user = useAuthStore((state) => state.user)
  const authStatus = useAuthStore((state) => state.status)
  const [syncOpen, setSyncOpen] = useState(false)
  const signedIn = authStatus === 'authenticated' && user !== null

  return (
    <>
      <Panel>
        <PanelHead
          label="Sync"
          aside={
            signedIn ? (
              <Text variant="caption" tone="soft">
                {SYNC_LABEL[syncStatus]}
              </Text>
            ) : undefined
          }
        />
        {signedIn && user ? (
          <View style={styles.syncSummary}>
            <Text variant="bodySm">
              Signed in as <Text variant="bodySm" tone="accent">{user.email}</Text>
            </Text>
            <Text variant="caption" tone="soft">
              Signing out keeps a copy here; offline edits sync on reconnect.
            </Text>
            {syncError ? (
              <Text variant="caption" tone="default" accessibilityRole="alert">
                {syncError}
              </Text>
            ) : null}
            <View style={styles.syncActions}>
              <Button variant="quiet" onPress={() => void useAuthStore.getState().logout()}>
                Sign out
              </Button>
              <Button variant="secondary" onPress={() => setSyncOpen(true)}>
                Manage sync
              </Button>
            </View>
          </View>
        ) : (
          <View style={styles.syncSummary}>
            <Chip variant="quiet">Local only</Chip>
            <Button variant="secondary" onPress={() => setSyncOpen(true)}>
              Set up sync
            </Button>
          </View>
        )}
      </Panel>

      <SyncDialog visible={syncOpen} onClose={() => setSyncOpen(false)} />
    </>
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
  choice: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderRadius: radius.md, minHeight: 48, paddingVertical: space.sm },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: space.sm, marginTop: space.sm },
  settingBody: { flex: 1, gap: 2 },
  permissionBlock: { gap: space.xs, marginVertical: space.sm },
  notificationOptions: { marginTop: space.sm, gap: space.sm },
  actions: { gap: space.sm, marginVertical: space.sm },
  syncSummary: { gap: space.sm },
  syncActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, flexWrap: 'wrap' },
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
  details: { gap: 2 },
})
