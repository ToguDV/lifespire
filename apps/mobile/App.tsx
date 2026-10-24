import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import Storage from 'expo-sqlite/kv-store'
import { createDemoSetup, SCHEMA_VERSION } from '@lifespire/core'

export default function App() {
  const setup = useMemo(() => createDemoSetup(new Date('2026-10-24T09:00:00Z')), [])
  const stored = useMemo(() => {
    Storage.setItemSync('lifespire:spike', 'ok')
    return Storage.getItemSync('lifespire:spike')
  }, [])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LifeSpire spike</Text>
      <Text>{setup.name}</Text>
      <Text>
        schema {SCHEMA_VERSION} · goals {setup.goals.length} · routines {setup.tasks.length}
      </Text>
      <Text>storage: {stored}</Text>
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#F1F0EA',
  },
  title: { fontSize: 24, fontWeight: '600' },
})
