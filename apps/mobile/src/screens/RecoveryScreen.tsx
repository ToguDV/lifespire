import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { ImportResult } from '@lifespire/app-core/ui/importSave'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Button } from '../components/Button'
import { Dialog } from '../components/Dialog'
import { Field, Input } from '../components/Field'
import { Icon } from '../components/Icon'
import { Panel, PanelHead, ScreenHead } from '../components/Panel'
import { SaveImportDialog } from '../components/SaveImportDialog'
import { Screen } from '../components/Screen'
import { Text } from '../components/Text'
import { exportRaw, pickAndValidateSave } from '../lib/exportImport'
import { devError } from '../lib/devLogger'
import { useAppStore } from '../state/store'

type RecoveryReason = 'corrupt' | 'future-version' | 'import-error'

const COPY: Record<RecoveryReason, { title: string; body: string }> = {
  corrupt:
    {
      title: 'The local save cannot be read',
      body: 'LifeSpire left the original data untouched. Import a backup or export the raw save so nothing is lost.',
    },
  'future-version': {
    title: 'This save comes from a newer LifeSpire',
    body: 'Update the app to read it. The original data is still on this device and will not be overwritten.',
  },
  'import-error': {
    title: 'That import could not be applied',
    body: 'The previous save is still here. Try another backup or export the raw save.',
  },
}

export function RecoveryScreen({ reason }: { reason: RecoveryReason }) {
  const { colors } = useTheme()
  const importDocument = useAppStore((state) => state.importDocument)
  const exportRawSave = useAppStore((state) => state.exportRawSave)
  const resetAll = useAppStore((state) => state.resetAll)
  const showToast = useAppStore((state) => state.showToast)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
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
      <ScreenHead
        kicker="Recovery"
        title={copy.title}
        subtitle={<Text variant="bodyMd" tone="muted">{copy.body}</Text>}
        aside={
          <View style={[styles.mark, { borderColor: colors.hairlineStrong, backgroundColor: colors.surfaceSunken }]}>
            <Icon name="lock" size={22} color={colors.inkStrong} />
          </View>
        }
      />

      <Panel>
        <PanelHead label="What happened" />
        <Text variant="bodySm" tone="muted">
          {reason === 'corrupt'
            ? 'A save with an unknown shape, a broken migration or unreadable JSON was found under the local save key.'
            : reason === 'future-version'
              ? 'The save uses a schema version newer than this build. Downgrading it could lose data, so writes stay blocked.'
              : 'The imported file was rejected before it could replace the local save.'}
        </Text>
        <Text variant="caption" tone="soft" style={styles.note}>
          Writes are blocked until a valid import or a reset. The app works from memory meanwhile.
        </Text>
        <View style={styles.actions}>
          <Button onPress={() => void importBackup()} loading={busy} full>
            Import a backup
          </Button>
          <Button variant="secondary" icon="archive" onPress={rawSave} full>
            Export raw save
          </Button>
        </View>
      </Panel>

      <Panel>
        <PanelHead label="Start over" aside={<Text variant="caption" tone="danger">Careful</Text>} />
        <Text variant="bodySm" tone="muted">
          The current raw save is copied to a backup before the key is removed. Onboarding starts
          from scratch.
        </Text>
        <Button variant="danger" onPress={() => setResetOpen(true)} full>
          Reset all data
        </Button>
      </Panel>

      <Text variant="caption" tone="soft" style={[styles.note, { marginTop: 0 }]}>
        If you exported a save on web, import that JSON here. Saves use the same versioned
        document on both apps.
      </Text>

      <SaveImportDialog
        result={importResult}
        onClose={() => setImportResult(null)}
        onConfirm={(next) => {
          if (importDocument(next)) setImportResult(null)
        }}
      />

      <Dialog
        visible={resetOpen}
        title="Reset all data?"
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
        <Text variant="bodySm" tone="muted">Type RESET exactly to confirm.</Text>
        <Field label="Confirmation">
          <Input value={resetPhrase} onChangeText={setResetPhrase} autoCapitalize="characters" placeholder="RESET" />
        </Field>
      </Dialog>
    </Screen>
  )
}

const styles = StyleSheet.create({
  mark: { width: 52, height: 52, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  note: { marginTop: space.sm },
  actions: { gap: space.sm, marginTop: space.md },
})
