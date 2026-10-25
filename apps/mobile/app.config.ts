import type { ExpoConfig, ConfigContext } from 'expo/config'

const APP_NAME = 'LifeSpire'
const APP_SLUG = 'lifespire'
const ANDROID_PACKAGE = 'com.lifespire.app'

/**
 * Release tags drive the version when CI builds the APK; local builds keep the
 * manifest default. `android.versionCode` must only ever grow, so it is derived
 * from the semantic version instead of being bumped by hand.
 */
function resolveVersion(): string {
  const raw = (process.env.LIFESPIRE_APP_VERSION ?? '').trim().replace(/^v/, '')
  return /^\d+\.\d+\.\d+$/.test(raw) ? raw : '0.1.0'
}

function resolveVersionCode(version: string): number {
  const [major = 0, minor = 0, patch = 0] = version
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0)
  return major * 1_000_000 + minor * 1_000 + patch
}

const APP_VERSION = resolveVersion()

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_NAME,
  slug: APP_SLUG,
  version: APP_VERSION,
  orientation: 'portrait',
  scheme: 'lifespire',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  android: {
    package: ANDROID_PACKAGE,
    adaptiveIcon: {
      backgroundColor: '#131511',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: true,
    softwareKeyboardLayoutMode: 'resize',
    versionCode: resolveVersionCode(APP_VERSION),
  },
  plugins: [
    'expo-sqlite',
    'expo-secure-store',
    'expo-font',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#F1F0EA',
        dark: { backgroundColor: '#131511' },
      },
    ],
    'expo-sharing',
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#4D6B5A',
        defaultChannel: 'daily-path',
      },
    ],
  ],
  extra: {
    syncBaseUrl: process.env.EXPO_PUBLIC_SYNC_BASE_URL ?? '',
  },
})
