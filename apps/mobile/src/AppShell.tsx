import { useCallback, useEffect } from 'react'
import { BackHandler, Linking, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Notifications from 'expo-notifications'
import { currentDay } from '@lifespire/core'
import type { View as AppView } from '@lifespire/core'
import { msUntilNextLocalMidnight } from '@lifespire/app-core/state/clock'
import { useTheme } from './theme/ThemeProvider'
import { layout, space } from './theme/tokens'
import { AnimatedNumber } from './components/AnimatedNumber'
import { ConflictDialog } from './components/ConflictDialog'
import { Icon } from './components/Icon'
import { IconButton } from './components/IconButton'
import { DayPips } from './components/Progress'
import { RewardToast, Toast } from './components/Toast'
import { Text } from './components/Text'
import { DaySummaryScreen } from './screens/DaySummaryScreen'
import { GoalsScreen } from './screens/GoalsScreen'
import { HomeScreen } from './screens/HomeScreen'
import { MapScreen } from './screens/MapScreen'
import { NodeScreen } from './screens/NodeScreen'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { RecoveryScreen } from './screens/RecoveryScreen'
import { RewardScreen } from './screens/RewardScreen'
import { RunSummaryScreen } from './screens/RunSummaryScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { devError } from './lib/devLogger'
import { useNotificationSync } from './notifications/scheduler'
import { useAppStore } from './state/store'

const TABS: Array<{ view: AppView; label: string; icon: 'map' | 'tent' | 'banner' | 'gem' }> = [
  { view: { name: 'map' }, label: 'Map', icon: 'map' },
  { view: { name: 'home' }, label: 'Camp', icon: 'tent' },
  { view: { name: 'goals' }, label: 'Goals', icon: 'banner' },
  { view: { name: 'profile' }, label: 'Relics', icon: 'gem' },
]

function tabForView(view: AppView): string {
  if (
    view.name === 'map' ||
    view.name === 'node' ||
    view.name === 'reward' ||
    view.name === 'day-summary' ||
    view.name === 'run-summary'
  ) {
    return 'map'
  }
  if (view.name === 'home') return 'home'
  if (view.name === 'goals') return 'goals'
  if (view.name === 'profile') return 'profile'
  return ''
}

export function AppShell() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const document = useAppStore((state) => state.document)
  const storageIssue = useAppStore((state) => state.storageIssue)
  const storageWarning = useAppStore((state) => state.storageWarning)
  const view = useAppStore((state) => state.view)
  const toast = useAppStore((state) => state.toast)
  const rewardToast = useAppStore((state) => state.rewardToast)
  const navigate = useAppStore((state) => state.navigate)
  const showToast = useAppStore((state) => state.showToast)
  const clearRewardToast = useAppStore((state) => state.clearRewardToast)
  const run = document.run
  const profile = document.profile
  const day = currentDay(run)
  const todayKey = useAppStore((state) => state.todayKey)
  const today = run?.days.find((candidate) => candidate.date === todayKey()) ?? null
  const labelDay = today ?? day
  useNotificationSync()
  const summaryDay =
    view.name === 'day-summary'
      ? (run?.days.find((candidate) => candidate.id === view.dayId) ?? null)
      : null

  const guardedView: AppView = storageIssue
    ? { name: 'recovery', reason: storageIssue.reason }
    : !profile
      ? { name: 'onboarding' }
      : view.name === 'onboarding'
        ? { name: 'home' }
        : view.name === 'day-summary' && (!run || !summaryDay)
          ? { name: 'home' }
          : (view.name === 'map' || view.name === 'node' || view.name === 'reward') &&
              (!run || run.status === 'closed' || !day)
            ? run?.status === 'closed'
              ? { name: 'run-summary' }
              : { name: 'home' }
            : view

  const dismissToast = useCallback(() => showToast(null), [showToast])
  const dismissRewardToast = useCallback(() => clearRewardToast(), [clearRewardToast])

  useEffect(() => {
    if (!rewardToast) return
    if (
      guardedView.name === 'node' ||
      guardedView.name === 'reward' ||
      guardedView.name === 'day-summary' ||
      guardedView.name === 'run-summary'
    ) {
      clearRewardToast()
    }
  }, [guardedView.name, rewardToast, clearRewardToast])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        try {
          useAppStore.getState().reconcile()
        } catch (error) {
          devError('app', 'midnight reconcile failed', error)
        }
        schedule()
      }, msUntilNextLocalMidnight())
    }
    schedule()
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const handleUrl = (url: string | null | undefined) => {
      if (!url) return
      const path = url.replace(/^lifespire:\/\//, '').split(/[/?#]/)[0]
      if (path === 'map') useAppStore.getState().navigate({ name: 'map' })
      else if (path === 'camp' || path === 'home') useAppStore.getState().navigate({ name: 'home' })
      else if (path === 'goals') useAppStore.getState().navigate({ name: 'goals' })
      else if (path === 'relics' || path === 'profile') useAppStore.getState().navigate({ name: 'profile' })
    }
    void Linking.getInitialURL()
      .then(handleUrl)
      .catch((error: unknown) => {
        devError('navigation', 'could not read the initial deep link', error)
      })
    const subscription = Linking.addEventListener('url', (event) => handleUrl(event.url))
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { url?: unknown } | null
      if (typeof data?.url === 'string') handleUrl(data.url)
    })
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        const data = response?.notification.request.content.data as { url?: unknown } | null
        if (typeof data?.url === 'string') {
          handleUrl(data.url)
          void Notifications.clearLastNotificationResponseAsync().catch((error: unknown) => {
            devError('notifications', 'could not clear the last notification response', error)
          })
        }
      })
      .catch((error: unknown) => {
        devError('notifications', 'could not read the last notification response', error)
      })
    return () => {
      subscription.remove()
      notificationSubscription.remove()
    }
  }, [])

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const state = useAppStore.getState()
      if (state.view.name === 'reward') return true
      if (state.history.length > 0) {
        state.back()
        return true
      }
      if (state.view.name !== 'home') {
        state.navigate({ name: 'home' })
        return true
      }
      return false
    })
    return () => subscription.remove()
  }, [])

  if (storageIssue) return <RecoveryScreen reason={storageIssue.reason} />
  if (!profile) return <OnboardingScreen />
  if (guardedView.name === 'onboarding') return <OnboardingScreen />
  if (guardedView.name === 'recovery') return <RecoveryScreen reason={guardedView.reason} />

  const renderScreen = () => {
    switch (guardedView.name) {
      case 'home':
        return <HomeScreen />
      case 'map':
        return <MapScreen />
      case 'node':
        // Remount per node so a resolved wheel can never leak its phase or
        // resolution guard into the next step.
        return <NodeScreen key={guardedView.nodeId} nodeId={guardedView.nodeId} />
      case 'reward':
        return <RewardScreen nodeId={guardedView.nodeId} />
      case 'day-summary':
        return <DaySummaryScreen dayId={guardedView.dayId} />
      case 'run-summary':
        return <RunSummaryScreen />
      case 'goals':
        return <GoalsScreen />
      case 'profile':
        return <ProfileScreen />
      case 'settings':
        return <SettingsScreen />
      default:
        return <HomeScreen />
    }
  }

  const activeTab = tabForView(guardedView)
  const immersive = guardedView.name === 'reward'
  const dayLabel = labelDay
    ? `Day ${labelDay.index + 1} of 7`
    : !run
      ? 'No run yet'
      : run.status === 'closed'
        ? 'Week sealed'
        : 'Week spent'

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {!immersive ? (
      <View style={[styles.topbar, { borderColor: colors.hairline, backgroundColor: colors.background }]}>
        <View style={styles.brandRow}>
          <Icon name="spire" size={20} color={colors.ink} />
          <Text variant="headingSm">LifeSpire</Text>
        </View>
        <View style={styles.dayBlock}>
          {run ? <DayPips days={run.days} currentIndex={labelDay?.index} /> : null}
          <Text variant="caption" tone="muted">{dayLabel}</Text>
        </View>
        <View style={styles.topbarRight}>
          {profile ? (
            <View style={styles.resource} accessibilityLabel={`${profile.gold} gold, level ${profile.level}`}>
              <Icon name="coin" size={13} color={colors.accentDeep} />
              <AnimatedNumber value={profile.gold} />
              <View style={[styles.level, { borderColor: colors.accent }]}>
                <Text variant="micro" tone="deep">{profile.level}</Text>
              </View>
            </View>
          ) : null}
          <IconButton
            icon="settings"
            label="Settings"
            active={guardedView.name === 'settings'}
            onPress={() => navigate({ name: 'settings' })}
            size={36}
          />
        </View>
      </View>
      ) : null}

      {storageWarning === 'write-failed' && !storageIssue ? (
        <View style={[styles.warning, { backgroundColor: colors.surfaceSunken, borderColor: colors.hairlineStrong }]}>
          <Icon name="lock" size={14} color={colors.inkStrong} />
          <Text variant="caption" tone="danger" style={styles.warningText}>
            Changes are not being saved on this device. Export a copy from Settings.
          </Text>
          <Text variant="caption" tone="danger" onPress={() => navigate({ name: 'settings' })}>
            Open
          </Text>
        </View>
      ) : null}

      <View style={styles.content}>{renderScreen()}</View>

      {!immersive ? (
      <View
        style={[
          styles.tabbar,
          {
            borderColor: colors.hairline,
            backgroundColor: colors.background,
            paddingBottom: Math.max(insets.bottom, space.xs),
          },
        ]}
      >
        {TABS.map((tab) => {
          const active = activeTab === tabForView(tab.view)
          return (
            <Pressable
              key={tab.label}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: active }}
              onPress={() => navigate(tab.view)}
              android_ripple={{ color: colors.accentWash, borderless: true }}
              style={styles.tab}
            >
              {active ? <View style={[styles.tabBar, { backgroundColor: colors.accent }]} /> : null}
              <Icon name={tab.icon} size={21} color={active ? colors.inkStrong : colors.inkSoft} />
              <Text variant="micro" style={active ? { color: colors.inkStrong } : { color: colors.inkSoft }}>
                {tab.label.toUpperCase()}
              </Text>
            </Pressable>
          )
        })}
      </View>
      ) : null}

      <Toast message={toast} onDismiss={dismissToast} />
      {rewardToast ? <RewardToast event={rewardToast} onDismiss={dismissRewardToast} /> : null}
      <ConflictDialog />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topbar: {
    minHeight: layout.topbarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: layout.screenPadding,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dayBlock: { flex: 1, alignItems: 'center', gap: 2 },
  topbarRight: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  resource: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  level: { minWidth: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  warning: { flexDirection: 'row', alignItems: 'center', gap: space.xs, borderBottomWidth: 1, paddingHorizontal: layout.screenPadding, paddingVertical: space.xs },
  warningText: { flex: 1 },
  content: { flex: 1 },
  tabbar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.xs,
    minHeight: layout.tabbarHeight,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 44 },
  tabBar: {
    position: 'absolute',
    top: 0,
    width: 26,
    height: 2,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
})
