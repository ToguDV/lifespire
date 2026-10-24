import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { Alegreya_400Regular } from '@expo-google-fonts/alegreya/400Regular'
import { Alegreya_400Regular_Italic } from '@expo-google-fonts/alegreya/400Regular_Italic'
import { Alegreya_600SemiBold } from '@expo-google-fonts/alegreya/600SemiBold'
import { Alegreya_600SemiBold_Italic } from '@expo-google-fonts/alegreya/600SemiBold_Italic'
import { Alegreya_700Bold } from '@expo-google-fonts/alegreya/700Bold'
import { AlegreyaSans_400Regular } from '@expo-google-fonts/alegreya-sans/400Regular'
import { AlegreyaSans_500Medium } from '@expo-google-fonts/alegreya-sans/500Medium'
import { AlegreyaSans_700Bold } from '@expo-google-fonts/alegreya-sans/700Bold'
import { AppShell } from './src/AppShell'
import { devError, installDevLogging } from './src/lib/devLogger'
import { ErrorBoundary } from './src/components/ErrorBoundary'
import { initSync } from './src/sync/setup'
import { useTheme } from './src/theme/ThemeProvider'
import { useAppStore } from './src/state/store'

installDevLogging()

void SplashScreen.preventAutoHideAsync().catch((error: unknown) => {
  devError('bootstrap', 'could not hold the splash screen', error)
})

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Alegreya_400Regular,
    Alegreya_400Regular_Italic,
    Alegreya_600SemiBold,
    Alegreya_600SemiBold_Italic,
    Alegreya_700Bold,
    AlegreyaSans_400Regular,
    AlegreyaSans_500Medium,
    AlegreyaSans_700Bold,
  })
  const hydrated = useAppStore((state) => state.hydrated)

  useEffect(() => {
    if (!fontsLoaded && !fontError) return
    void SplashScreen.hideAsync().catch((error: unknown) => {
      devError('bootstrap', 'could not hide the splash screen', error)
    })
  }, [fontsLoaded, fontError])

  useEffect(() => {
    let cleanup: (() => void) | undefined
    let cancelled = false
    void initSync()
      .then((stop) => {
        if (cancelled) stop()
        else cleanup = stop
      })
      .catch((error: unknown) => {
        devError('bootstrap', 'sync initialization failed', error)
      })
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [])

  if ((!fontsLoaded && !fontError) || !hydrated) return null

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <Root />
      </ErrorBoundary>
    </SafeAreaProvider>
  )
}

function Root() {
  const { scheme, colors } = useTheme()
  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <AppShell />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
