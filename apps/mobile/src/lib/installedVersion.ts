import * as Application from 'expo-application'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import { isSemver, type InstalledVersion } from './update'

const FALLBACK: InstalledVersion = { versionName: '0.0.0', versionCode: 0 }

export interface InstalledVersionInput {
  expoGo: boolean
  configVersion: string | null | undefined
  nativeVersion: string | null | undefined
  nativeBuildVersion: string | null | undefined
}

/**
 * Pure resolution of the running build identity. In Expo Go the native module
 * reports Expo Go itself, so the embedded app config wins and the native build
 * number is meaningless; a dev build and a release APK both report LifeSpire.
 */
export function resolveInstalledVersion(input: InstalledVersionInput): InstalledVersion {
  const versionName =
    !input.expoGo && input.nativeVersion && isSemver(input.nativeVersion)
      ? input.nativeVersion
      : input.configVersion && isSemver(input.configVersion)
        ? input.configVersion
        : FALLBACK.versionName

  if (input.expoGo) return { versionName, versionCode: 0 }

  const parsed =
    typeof input.nativeBuildVersion === 'string'
      ? Number.parseInt(input.nativeBuildVersion, 10)
      : Number.NaN
  return {
    versionName,
    versionCode: Number.isInteger(parsed) && parsed > 0 ? parsed : 0,
  }
}

/** Version of the running Android build, never throwing. */
export function installedVersion(): InstalledVersion {
  try {
    return resolveInstalledVersion({
      expoGo: Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
      configVersion: Constants.expoConfig?.version,
      nativeVersion: Application.nativeApplicationVersion,
      nativeBuildVersion: Application.nativeBuildVersion,
    })
  } catch {
    return FALLBACK
  }
}
