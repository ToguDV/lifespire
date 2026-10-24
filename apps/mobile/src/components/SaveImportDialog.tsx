import { StyleSheet, View } from 'react-native'
import type { GameDocument } from '@lifespire/core'
import type { ImportResult } from '@lifespire/app-core/ui/importSave'
import { space } from '../theme/tokens'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { Text } from './Text'

export function SaveImportDialog({
  result,
  onClose,
  onConfirm,
}: {
  result: ImportResult | null
  onClose: () => void
  onConfirm: (document: GameDocument) => void
}) {
  if (!result) return null
  if (!result.ok) {
    return (
      <Dialog
        visible
        title="That save cannot be imported"
        onClose={onClose}
        actions={<Button onPress={onClose}>Close</Button>}
      >
        <Text variant="bodySm" tone="danger">
          {result.message}
        </Text>
        <Text variant="caption" tone="soft" style={styles.note}>
          Your current save and the local storage were not changed.
        </Text>
      </Dialog>
    )
  }

  const summary = result.summary
  return (
    <Dialog
      visible
      title="Import this save?"
      onClose={onClose}
      actions={
        <>
          <Button variant="quiet" onPress={onClose}>Cancel</Button>
          <Button onPress={() => onConfirm(result.document)}>Replace my save</Button>
        </>
      }
    >
      <Text variant="bodySm" tone="muted">
        The current save is copied to a backup first. The imported document is validated before
        anything is replaced.
      </Text>
      <View style={styles.rows}>
        <Row label="Schema" value={`v${summary.schemaVersion}`} />
        <Row label="Traveller" value={summary.profileName ?? 'No profile'} />
        <Row label="Level / gold" value={`${summary.level ?? '—'} · ${summary.gold ?? '—'}`} />
        <Row label="Relics" value={String(summary.relics)} />
        <Row label="Goals / routines" value={`${summary.goals} / ${summary.routines}`} />
        <Row
          label="Run"
          value={
            summary.runStatus
              ? `${summary.runStatus} · day ${summary.runDay ?? '—'} · ${summary.daysPlayed} played`
              : 'No run'
          }
        />
      </View>
    </Dialog>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="caption" tone="muted">{label}</Text>
      <Text variant="bodySm" style={styles.value}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  rows: { gap: space.xs, marginTop: space.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  value: { flex: 1, textAlign: 'right' },
  note: { marginTop: space.sm },
})
