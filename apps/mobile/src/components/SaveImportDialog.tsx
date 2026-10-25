import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { LOOT_CATALOG } from '@lifespire/core'
import type { GameDocument } from '@lifespire/core'
import type { PickedImportResult } from '../lib/exportImport'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { Icon } from './Icon'
import { Text } from './Text'

export function SaveImportDialog({
  result,
  onClose,
  onConfirm,
}: {
  result: PickedImportResult | null
  onClose: () => void
  onConfirm: (document: GameDocument) => boolean
}) {
  const { colors } = useTheme()
  const [confirmError, setConfirmError] = useState<string | null>(null)
  // A new pick replaces the previous result: drop the stale confirm error so
  // a retry starts clean.
  useEffect(() => {
    setConfirmError(null)
  }, [result])
  if (!result) return null
  if (!result.ok) {
    const fileName = result.fileName ?? 'chosen file'
    return (
      <Dialog
        visible
        eyebrow="Local import"
        title="That save cannot be imported"
        onClose={onClose}
        actions={<Button onPress={onClose}>Close</Button>}
      >
        <Text variant="bodySm" tone="default">
          {result.message}
        </Text>
        <Text variant="caption" tone="soft" style={styles.note}>
          File: {fileName}. Your current save and the local storage were not changed.
        </Text>
      </Dialog>
    )
  }

  const summary = result.summary
  const fileName = result.fileName ?? 'chosen file'
  return (
    <Dialog
      visible
      eyebrow="Local import"
      title="Restore this save?"
      description="Review what the file contains before it replaces the data on this device."
      onClose={onClose}
      actions={
        <>
          <Button variant="quiet" onPress={onClose}>Keep current data</Button>
          <Button
            onPress={() => {
              if (onConfirm(result.document)) return
              setConfirmError(
                'That save could not be restored. Your current data was left untouched.',
              )
            }}
          >
            Replace local data
          </Button>
        </>
      }
    >
      <View style={styles.rows}>
        <Row label="Profile" value={summary.profileName ?? 'No profile'} />
        <Row label="Level" value={String(summary.level ?? '—')} />
        <Row label="Gold" value={String(summary.gold ?? '—')} />
        <Row
          label="Run"
          value={
            summary.runStatus
              ? `${summary.runStatus} · day ${summary.runDay ?? '—'}`
              : 'No run'
          }
        />
        <Row label="Relics" value={`${summary.relics} of ${LOOT_CATALOG.length}`} />
        <Row label="Schema" value={`v${summary.schemaVersion}`} />
      </View>
      <ImportWarning fileName={fileName} />
      {confirmError ? (
        <View
          accessibilityRole="alert"
          style={[
            styles.error,
            { borderColor: colors.hairlineStrong, backgroundColor: colors.surfaceSunken },
          ]}
        >
          <Icon name="lock" size={15} color={colors.inkStrong} />
          <Text variant="bodySm" style={[styles.errorText, { color: colors.inkStrong }]}>
            {confirmError}
          </Text>
        </View>
      ) : null}
    </Dialog>
  )
}

function ImportWarning({ fileName }: { fileName: string }) {
  const { colors } = useTheme()
  return (
    <View
      style={[
        styles.warning,
        { borderColor: colors.hairlineStrong, backgroundColor: colors.surfaceSunken },
      ]}
    >
      <Icon name="archive" size={15} color={colors.accentDeep} />
      <Text variant="bodySm" tone="muted" style={styles.warningText}>
        Replacing overwrites the profile, goals, routines, run and collection in los datos
        de este dispositivo. File: {fileName}.
      </Text>
    </View>
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
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginTop: space.md,
  },
  warningText: { flex: 1 },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginTop: space.md,
  },
  errorText: { flex: 1 },
})
