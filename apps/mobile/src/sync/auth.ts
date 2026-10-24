import { createAuthStore } from '@lifespire/app-core/sync/authStore'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { kv } from '../platform/storage'

function deviceName(): string {
  const model = Device.modelName?.trim() || 'device'
  const name = `${Platform.OS} ${model}`.replace(/[^\w .()-]/g, '')
  return name.slice(0, 120)
}

/** Auth session persists in the same SQLite KV store; tokens stay in SecureStore. */
export const useAuthStore = createAuthStore({ storage: kv, deviceName: deviceName() })
