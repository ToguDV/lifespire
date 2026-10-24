import type { ExpoConfig, ConfigContext } from 'expo/config'

const APP_NAME = 'LifeSpire'
const APP_SLUG = 'lifespire'
const ANDROID_PACKAGE = 'com.lifespire.app'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_NAME,
  slug: APP_SLUG,
  version: '0.1.0',
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
      },
    ],
    'expo-sharing',
    [
      'expo-notifications',
      {
        color: '#4D6B5A',
        defaultChannel: 'daily-path',
      },
    ],
  ],
  extra: {
    syncBaseUrl: process.env.EXPO_PUBLIC_SYNC_BASE_URL ?? '',
  },
})
