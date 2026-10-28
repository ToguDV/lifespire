import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { devError } from '../lib/devLogger'
import { useTheme } from '../theme/ThemeProvider'
import { space } from '../theme/tokens'
import { Button } from './Button'
import { Panel } from './Panel'
import { Text } from './Text'

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    devError('app', 'render crash', error, { componentStack: info.componentStack ?? '' })
    if (__DEV__) console.error('[LifeSpire][app] component stack', info.componentStack ?? '')
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return <CrashScreen error={this.state.error} onReset={() => this.setState({ error: null })} />
  }
}

function CrashScreen({ error, onReset }: { error: Error; onReset: () => void }) {
  const { colors } = useTheme()
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Panel>
        <Text variant="headingMd">Something broke on the path</Text>
        <Text variant="bodySm" tone="muted" style={styles.copy}>
          Your save is safe. Try again; if this keeps happening, export the save from Settings on
          another device.
        </Text>
        {__DEV__ ? (
          <Text variant="caption" tone="default" style={styles.copy}>
            {error.message}
          </Text>
        ) : null}
        <Button onPress={onReset}>Try again</Button>
      </Panel>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: space.lg },
  copy: { marginVertical: space.sm },
})
