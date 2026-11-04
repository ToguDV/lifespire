import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { useAppStore } from '../state/store'
import { useUpdateStore } from '../state/update'
import { installedVersion } from '../lib/installedVersion'
import {
  FDROID_REPO_URL,
  openFdroidListing,
  openFdroidWebsite,
  openMobileUpdate,
  type MobileUpdate,
} from '../lib/update'
import { useTheme } from '../theme/ThemeProvider'
import { layout, space } from '../theme/tokens'
import { Button } from './Button'
import { Icon } from './Icon'
import { Panel, PanelHead } from './Panel'
import { Text } from './Text'

function formatWhen(value: number | null): string {
  if (!value) return 'never'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return 'unknown'
  }
}

function latestLabel(status: string, latest: MobileUpdate | null): string {
  if (status === 'checking') return 'checking…'
  if (latest) return latest.version
  if (status === 'current') return 'up to date'
  return 'unknown'
}

function statusCopy(status: string, latest: MobileUpdate | null): string {
  if (status === 'checking') return 'Checking the F-Droid repository…'
  if (latest) {
    return latest.source === 'fdroid'
      ? `LifeSpire ${latest.version} is available on F-Droid.`
      : `LifeSpire ${latest.version} is available on GitHub; the F-Droid repository has not caught up yet.`
  }
  if (status === 'current') return 'You are up to date.'
  if (status === 'error') {
    return 'Could not reach the F-Droid repository. You can still open F-Droid or the repository website.'
  }
  return 'Updates are checked automatically, or on demand.'
}

/**
 * Slim banner under the top bar. It only appears when the F-Droid index (or
 * the release manifest fallback) reports a strictly newer build.
 */
export function UpdateBanner() {
  const { colors } = useTheme()
  const status = useUpdateStore((state) => state.status)
  const latest = useUpdateStore((state) => state.latest)
  const showToast = useAppStore((state) => state.showToast)

  const getUpdate = () => {
    if (!latest) return
    void openMobileUpdate(latest).catch(() => {
      showToast('Could not open the update link on this device.')
    })
  }

  if (status !== 'available' || !latest) return null

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: colors.accentSoft, borderColor: colors.hairline }]}
    >
      <Icon name="elite" size={16} color={colors.accentDeep} />
      <Text variant="caption" style={styles.bannerText} numberOfLines={2}>
        LifeSpire {latest.version} is available.
      </Text>
      <Button
        small
        variant="secondary"
        onPress={getUpdate}
        accessibilityLabel={latest.source === 'fdroid' ? 'Open F-Droid' : 'Get update'}
      >
        {latest.source === 'fdroid' ? 'Open F-Droid' : 'Get update'}
      </Button>
    </View>
  )
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="caption" tone="muted" style={styles.rowLabel}>
        {label}
      </Text>
      <Text variant="bodySm" style={styles.rowValue}>
        {value}
      </Text>
    </View>
  )
}

/**
 * Settings > About: installed build, latest F-Droid release, manual check and
 * the repository entry points. The app never downloads or installs an APK.
 */
export function UpdateAboutSection() {
  const installed = useMemo(() => installedVersion(), [])
  const status = useUpdateStore((state) => state.status)
  const latest = useUpdateStore((state) => state.latest)
  const lastCheckedAt = useUpdateStore((state) => state.lastCheckedAt)
  const check = useUpdateStore((state) => state.check)
  const showToast = useAppStore((state) => state.showToast)

  const openFdroid = () => {
    void openFdroidListing().catch(() => {
      showToast('Could not open F-Droid or the repository page on this device.')
    })
  }

  const openWebsite = () => {
    void openFdroidWebsite().catch(() => {
      showToast('Could not open the repository page on this device.')
    })
  }

  const openLatest = () => {
    if (!latest) return
    void openMobileUpdate(latest).catch(() => {
      showToast('Could not open the update link on this device.')
    })
  }

  return (
    <Panel>
      <PanelHead label="About" />
      <Text variant="bodySm" tone="muted">
        Release identity and updates.
      </Text>
      <View style={styles.rows}>
        <AboutRow label="Installed version" value={installed.versionName} />
        <AboutRow
          label="Build"
          value={installed.versionCode > 0 ? String(installed.versionCode) : '—'}
        />
        <AboutRow label="Latest release" value={latestLabel(status, latest)} />
        <AboutRow label="Last checked" value={formatWhen(lastCheckedAt)} />
      </View>
      <Text variant="bodySm" tone={status === 'error' ? 'default' : 'muted'}>
        {statusCopy(status, latest)}
      </Text>
      <View style={styles.actions}>
        <Button
          variant="secondary"
          small
          loading={status === 'checking'}
          onPress={() => void check({ force: true })}
        >
          Check for updates
        </Button>
        <Button variant="secondary" small onPress={openFdroid}>
          Open F-Droid
        </Button>
        {latest?.source === 'manifest' ? (
          <Button variant="primary" small onPress={openLatest}>
            Get update
          </Button>
        ) : null}
        <Button variant="quiet" small onPress={openWebsite}>
          Repository website
        </Button>
      </View>
      <Text variant="caption" tone="soft" selectable>
        Add this repository in F-Droid → Settings → Repositories: {FDROID_REPO_URL}
      </Text>
      <Text variant="caption" tone="soft">
        F-Droid must have this repository added before “Open F-Droid” can show the
        update.
      </Text>
    </Panel>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: layout.screenPadding,
    paddingVertical: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bannerText: { flex: 1 },
  rows: { marginTop: space.sm, gap: space.xxs },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  rowLabel: { width: 150 },
  rowValue: { flex: 1 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    marginTop: space.sm,
  },
})
