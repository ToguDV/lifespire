import { resolveInstalledVersion } from './installedVersion'

describe('resolveInstalledVersion', () => {
  it('reads the native version and versionCode from a release build', () => {
    expect(
      resolveInstalledVersion({
        expoGo: false,
        configVersion: '0.3.1',
        nativeVersion: '0.3.1',
        nativeBuildVersion: '3001',
      }),
    ).toEqual({ versionName: '0.3.1', versionCode: 3001 })
  })

  it('uses the embedded config version inside Expo Go', () => {
    expect(
      resolveInstalledVersion({
        expoGo: true,
        configVersion: '0.3.1',
        nativeVersion: '58.0.0',
        nativeBuildVersion: '580000',
      }),
    ).toEqual({ versionName: '0.3.1', versionCode: 0 })
  })

  it('falls back to the config version when the native value is unusable', () => {
    expect(
      resolveInstalledVersion({
        expoGo: false,
        configVersion: '0.3.1',
        nativeVersion: 'nightly',
        nativeBuildVersion: null,
      }),
    ).toEqual({ versionName: '0.3.1', versionCode: 0 })
  })

  it('degrades to the baseline instead of throwing on malformed data', () => {
    expect(
      resolveInstalledVersion({
        expoGo: false,
        configVersion: null,
        nativeVersion: null,
        nativeBuildVersion: '-1',
      }),
    ).toEqual({ versionName: '0.0.0', versionCode: 0 })
  })
})
