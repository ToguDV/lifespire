import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Button } from '../components/Button'
import { Dialog } from '../components/Dialog'
import { Field, Input } from '../components/Field'
import { Icon } from '../components/Icon'
import { Panel, ScreenHead } from '../components/Panel'
import { SaveImportDialog } from '../components/SaveImportDialog'
import { Screen } from '../components/Screen'
import { Text } from '../components/Text'
import { ThemeToggle } from '../components/ThemeToggle'
import { exportRaw, pickAndValidateSave } from '../lib/exportImport'
import type { PickedImportResult } from '../lib/exportImport'
import { devError } from '../lib/devLogger'
import { useAppStore } from '../state/store'

type RecoveryReason = 'corrupt' | 'future-version' | 'import-error'

const COPY: Record<RecoveryReason, { title: string; body: string }> = {
  corrupt: {
    title: 'The local save is incomplete or damaged.',
    body: 'LifeSpire could not read the document stored on this device. It has left the original save untouched instead of replacing it.',
  },
  'future-version': {
    title: 'This save comes from a newer LifeSpire.',
    body: 'The stored document uses a schema version this build does not understand. It has been left untouched so a newer version can still open it.',
  },
  'import-error': {
    title: 'That save could not be imported.',
    body: 'The selected file did not pass validation. Your current local document was not changed.',
  },
}

export function RecoveryScreen({ reason }: { reason: RecoveryReason }) {
  const { colors } = useTheme()
  const importDocument = useAppStore((state) => state.importDocument)
  const exportRawSave = useAppStore((state) => state.exportRawSave)
  const resetAll = useAppStore((state) => state.resetAll)
  const showToast = useAppStore((state) => state.showToast)
  const [importResult, setImportResult] = useState<PickedImportResult | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetPhrase, setResetPhrase] = useState('')
  const [busy, setBusy] = useState(false)
  const copy = COPY[reason]

  const importBackup = async () => {
    setBusy(true)
    try {
      const result = await pickAndValidateSave()
      if ('canceled' in result) return
      setImportResult(result)
    } catch (error) {
      devError('files', 'recovery import failed', error)
      showToast(error instanceof Error ? error.message : 'Could not read that file.')
    } finally {
      setBusy(false)
    }
  }

  const rawSave = () => {
    const raw = exportRawSave()
    if (!raw) {
      showToast('There is no raw save to export.')
      return
    }
    void exportRaw(raw).catch((error: unknown) => {
      devError('files', 'raw save export failed', error)
      showToast(error instanceof Error ? error.message : 'Could not share the raw save.')
    })
  }

  const confirmReset = () => {
    if (resetPhrase !== 'RESET') return
    resetAll()
    setResetOpen(false)
    setResetPhrase('')
  }

  return (
    <Screen>
      <View style={styles.brandRow}>
        <View style={styles.brand}>
          <Icon name="spire" size={26} color={colors.ink} />
          <Text variant="headingMd">LifeSpire</Text>
        </View>
        <ThemeToggle />
      </View>

      <ScreenHead
        kicker="Local save"
        title={copy.title}
        subtitle={<Text variant="bodyMd" tone="muted">{copy.body}</Text>}
        aside={
          <View
            style={[
              styles.mark,
              { borderColor: colors.hairlineStrong, backgroundColor: colors.surfaceSunken },
            ]}
          >
            <Icon name="lock" size={22} color={colors.inkStrong} />
          </View>
        }
      />

      <Panel>
        <View
          style={[
            styles.warning,
            { borderColor: colors.hairlineStrong, backgroundColor: colors.surfaceSunken },
          ]}
        >
          <Icon name="lock" size={15} color={colors.accentDeep} />
          <Text variant="bodySm" tone="muted" style={styles.warningText}>
            Nothing has been overwritten. The blocked document stays in storage until you reset it
            or restore a valid save.
          </Text>
        </View>

        <Text variant="bodySm" tone="muted" style={styles.copy}>
          Import a valid JSON export to recover without resetting first. LifeSpire validates the
          file, shows a summary and only replaces the blocked document after you confirm. A
          successful import also unlocks saving again.
        </Text>

        <View style={styles.actions}>
          <Button onPress={() => void importBackup()} loading={busy} full>
            Import save
          </Button>
          <Button variant="secondary" icon="archive" onPress={rawSave} full>
            Export original save
          </Button>
          <Button variant="danger" onPress={() => setResetOpen(true)} full>
            Reset local data
          </Button>
        </View>

        <Text variant="caption" tone="soft" style={styles.note}>
          Resetting removes the blocked save and returns to onboarding. Export the original save
          first if you may need it later.
        </Text>
      </Panel>

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
        description="The blocked save is removed and LifeSpire returns to onboarding."
        onClose={() => setResetOpen(false)}
        actions={
          <>
            <Button variant="quiet" onPress={() => setResetOpen(false)}>Keep the save</Button>
            <Button variant="danger" disabled={resetPhrase !== 'RESET'} onPress={confirmReset}>
              Reset everything
            </Button>
          </>
        }
      >
        <Text variant="bodySm" tone="muted">
          This cannot be undone. Export or copy the original local document first if you may need
          it later.
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

const styles = StyleSheet.create({
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  mark: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  warningText: { flex: 1 },
  copy: { marginTop: space.sm },
  actions: { gap: space.sm, marginTop: space.md },
  note: { marginTop: space.sm },
})
