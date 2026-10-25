import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { dayKey } from '@lifespire/core'
import type { GameDocument } from '@lifespire/core'
import { getNow } from '@lifespire/app-core/state/clock'
import { summarizeDocument } from '@lifespire/app-core/ui/importSave'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { Text } from './Text'
import { exportDocumentAs } from '../lib/exportImport'
import { devWarn } from '../lib/devLogger'
import { documentStorage } from '../platform/storage'
import { useAppStore } from '../state/store'
import { syncEngine, useSyncStore } from '../sync/setup'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'

function formatWhen(iso: string | null): string {
  if (!iso) return 'unknown time'
  try {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    return date.toLocaleString()
  } catch {
    return iso
  }
}

function backupLocally(action: string): void {
  try {
    documentStorage.backup()
  } catch (error) {
    devWarn('storage', `conflict backup failed before ${action}`, error)
  }
}

function ConflictCopy({
  title,
  document,
  saved,
}: {
  title: string
  document: GameDocument
  saved: string
}) {
  const { colors } = useTheme()
  const summary = summarizeDocument(document)
  return (
    <View
      style={[
        styles.copy,
        { borderColor: colors.hairlineStrong, backgroundColor: colors.surface },
      ]}
    >
      <Text variant="headingSm">{title}</Text>
      <View style={styles.meta}>
        <MetaRow label="Profile" value={summary.profileName ?? 'No profile'} />
        <MetaRow
          label="Progress"
          value={`${summary.gold ?? 0} gold · level ${summary.level ?? 1} · ${summary.goals} goals`}
        />
        <MetaRow
          label="Run"
          value={
            summary.runStatus
              ? `${summary.runStatus} · day ${summary.runDay ?? '—'}`
              : 'No run'
          }
        />
        <MetaRow label="Saved" value={saved} />
      </View>
    </View>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text variant="caption" tone="soft">{label}</Text>
      <Text variant="bodySm">{value}</Text>
    </View>
  )
}

export function ConflictDialog() {
  const { colors } = useTheme()
  const conflict = useSyncStore((state) => state.conflict)
  const showToast = useAppStore((state) => state.showToast)
  const [busy, setBusy] = useState<'mine' | 'cloud' | 'export' | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)

  if (!conflict) return null

  const closeWithoutResolving = () => {
    if (busy) return
    setResolveError(null)
    syncEngine.discardConflict()
  }

  const keepMine = async () => {
    setBusy('mine')
    setResolveError(null)
    try {
      backupLocally('keeping this device')
      await syncEngine.resolveKeepMine()
      const next = useSyncStore.getState()
      if (next.conflict) {
        setResolveError(
          next.lastError ?? 'This device copy could not be uploaded. Try again.',
        )
      }
    } catch (error) {
      setResolveError(
        error instanceof Error ? error.message : 'This device copy could not be uploaded.',
      )
    } finally {
      setBusy(null)
    }
  }

  const keepCloud = async () => {
    setBusy('cloud')
    setResolveError(null)
    try {
      backupLocally('keeping the cloud copy')
      syncEngine.resolveKeepCloud()
      const next = useSyncStore.getState()
      if (next.conflict) {
        setResolveError('The cloud copy could not be applied. Your device copy is still safe.')
      }
    } catch (error) {
      setResolveError(
        error instanceof Error ? error.message : 'The cloud copy could not be applied.',
      )
    } finally {
      setBusy(null)
    }
  }

  const exportBoth = async () => {
    setBusy('export')
    try {
      backupLocally('exporting both copies')
      const stamp = dayKey(getNow())
      const copies: Array<[string, GameDocument]> = [
        [`lifespire-this-device-${stamp}.json`, conflict.local],
        [`lifespire-cloud-${stamp}.json`, conflict.remote],
      ]
      let failed = 0
      for (const [filename, document] of copies) {
        try {
          await exportDocumentAs(document, filename)
        } catch (error) {
          failed += 1
          devWarn('files', 'conflict export could not be shared', error, { filename })
        }
      }
      if (failed === 0) {
        showToast('Both copies shared as JSON files.')
      } else if (failed === copies.length) {
        showToast('Could not share either copy. Nothing was changed.')
      } else {
        showToast('One copy could not be shared. Nothing was changed.')
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog
      visible
      eyebrow="Two versions"
      title="Sync conflict"
      description="This device and the cloud disagree in ways that can't be merged safely, so pick which copy keeps going. Small independent edits merge on their own; these didn't. Both copies are kept safe first."
      onClose={closeWithoutResolving}
      dismissable={!busy}
      actions={
        <>
          <Button
            variant="quiet"
            onPress={() => void exportBoth()}
            disabled={busy !== null}
          >
            {busy === 'export' ? 'Exporting…' : 'Export both'}
          </Button>
          <Button
            variant="secondary"
            onPress={() => void keepCloud()}
            disabled={busy !== null}
          >
            {busy === 'cloud' ? 'Keeping…' : 'Keep cloud'}
          </Button>
          <Button onPress={() => void keepMine()} disabled={busy !== null}>
            {busy === 'mine' ? 'Keeping…' : 'Keep this device'}
          </Button>
        </>
      }
    >
      <View style={styles.copies}>
        <ConflictCopy title="This device" document={conflict.local} saved="this device" />
        <ConflictCopy
          title="Cloud"
          document={conflict.remote}
          saved={formatWhen(conflict.remoteUpdatedAt)}
        />
      </View>
      {resolveError ? (
        <View
          accessibilityRole="alert"
          style={[
            styles.error,
            { borderColor: colors.hairlineStrong, backgroundColor: colors.surfaceSunken },
          ]}
        >
          <Text variant="bodySm" style={{ color: colors.inkStrong }}>
            {resolveError}
          </Text>
        </View>
      ) : null}
      {conflict.conflicts.length > 0 ? (
        <View style={styles.reasons}>
          <Text variant="caption" tone="danger">Why the merge stopped:</Text>
          {conflict.conflicts.slice(0, 5).map((reason) => (
            <Text key={reason} variant="caption" tone="muted">· {reason}</Text>
          ))}
        </View>
      ) : null}
      <Text variant="caption" tone="soft">
        Keep this device uploads it over the cloud version. Keep cloud replaces this device
        (a backup is saved first). Export both shares each copy before you decide.
      </Text>
    </Dialog>
  )
}

const styles = StyleSheet.create({
  copies: { gap: space.sm },
  copy: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
    gap: space.xs,
  },
  meta: { gap: space.xs },
  metaRow: { gap: 1 },
  reasons: { gap: 2 },
  error: {
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: space.sm,
    marginTop: space.xs,
  },
})
