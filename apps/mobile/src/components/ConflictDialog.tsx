import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { Text } from './Text'
import { syncEngine, useSyncStore } from '../sync/setup'
import { space } from '../theme/tokens'

export function ConflictDialog() {
  const conflict = useSyncStore((state) => state.conflict)
  const [busy, setBusy] = useState(false)

  if (!conflict) return null
  const keepMine = async () => {
    setBusy(true)
    try {
      await syncEngine.resolveKeepMine()
    } finally {
      setBusy(false)
    }
  }
  const keepCloud = () => {
    syncEngine.resolveKeepCloud()
  }

  return (
    <Dialog
      visible
      title="This save changed elsewhere"
      onClose={() => syncEngine.discardConflict()}
      dismissable={!busy}
      actions={
        <>
          <Button variant="quiet" onPress={() => syncEngine.discardConflict()} disabled={busy}>
            Decide later
          </Button>
          <Button variant="secondary" onPress={keepCloud} disabled={busy}>
            Keep cloud
          </Button>
          <Button onPress={() => void keepMine()} loading={busy}>
            Keep mine
          </Button>
        </>
      }
    >
      <Text variant="bodySm" tone="muted">
        The cloud copy is newer than this device's last sync, and the automatic merge could not
        safely combine them. Choose which version to keep. A local backup is kept before either
        choice.
      </Text>
      <View style={styles.meta}>
        <Text variant="caption" tone="soft">
          Cloud updated {new Date(conflict.remoteUpdatedAt).toLocaleString()}
        </Text>
        <Text variant="caption" tone="soft">
          Cloud version {conflict.remoteVersion}
        </Text>
      </View>
      {conflict.conflicts.length > 0 ? (
        <View style={styles.reasons}>
          <Text variant="caption" tone="danger">Why the merge stopped:</Text>
          {conflict.conflicts.map((reason) => (
            <Text key={reason} variant="caption" tone="muted">· {reason}</Text>
          ))}
        </View>
      ) : null}
    </Dialog>
  )
}

const styles = StyleSheet.create({
  meta: { gap: 2, marginTop: space.sm },
  reasons: { gap: 2, marginTop: space.sm },
})
