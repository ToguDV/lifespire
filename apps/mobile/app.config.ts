import type { ExpoConfig, ConfigContext } from 'expo/config'
import manifest from './package.json'

const APP_NAME = 'LifeSpire'
const APP_SLUG = 'lifespire'
const ANDROID_PACKAGE = 'com.lifespire.app'
const BASE_VERSION = '0.1.0'

/**
 * The APK version comes from `apps/mobile/package.json`, which travels with the
 * project to the EAS builder. Runner environment variables do not, so the
 * release script bumps this manifest together with the root and desktop ones.
 */
function resolveVersion(): string {
  return /^\d+\.\d+\.\d+$/.test(manifest.version) ? manifest.version : BASE_VERSION
}

/**
 * `android.versionCode` must only ever grow. Deriving it from the semantic
 * version keeps it monotonic across releases without a manual bump. Minor and
 * patch are expected to stay below 1000; anything else falls back to the base
 * version so a malformed manifest cannot publish an invalid code.
 */
export function versionCodeFor(version: string): number {
  const parts = version.split('.')
  const valid = parts.length === 3 && parts.every((part) => /^\d+$/.test(part))
  if (!valid) return versionCodeFor(BASE_VERSION)

  const [major = 0, minor = 0, patch = 0] = parts.map((part) => Number.parseInt(part, 10))
  if (minor > 999 || patch > 999) return versionCodeFor(BASE_VERSION)
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
    versionCode: versionCodeFor(APP_VERSION),
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
