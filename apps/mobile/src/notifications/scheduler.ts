import * as Notifications from 'expo-notifications'
import { AppState, Platform } from 'react-native'
import { useEffect } from 'react'
import type { GameDocument } from '@lifespire/core'
import { devError, devWarn } from '../lib/devLogger'
import { useAppStore } from '../state/store'
import { buildNotificationPlan } from './planner'
import type { PlannedNotification } from './planner'
import { getNotificationPrefs, useNotificationPrefs } from './prefs'
import type { NotificationPrefs } from './prefs'

export type NotificationPermission = 'granted' | 'denied' | 'undetermined'

const CHANNEL_ID = 'daily-path'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

export async function ensureNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Daily path',
    description: 'A quiet reminder for today’s map and an unfinished day.',
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    vibrationPattern: [0, 30],
    enableVibrate: true,
    showBadge: false,
  })
}

export async function getNotificationPermission(): Promise<NotificationPermission> {
  const settings = await Notifications.getPermissionsAsync()
  if (settings.granted) return 'granted'
  if (settings.status === 'denied') return 'denied'
  return 'undetermined'
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  await ensureNotificationChannel()
  const current = await getNotificationPermission()
  if (current === 'granted') return 'granted'
  const result = await Notifications.requestPermissionsAsync()
  if (result.granted) return 'granted'
  return result.status === 'denied' ? 'denied' : 'undetermined'
}

export async function cancelAppNotifications(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync()
    await Promise.all(
      scheduled
        .filter((request) => {
          const data = request.content.data as { app?: unknown } | null
          return data?.app === 'lifespire'
        })
        .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
    )
  } catch (error) {
    devWarn('notifications', 'could not cancel scheduled notifications', error)
  }
}

export async function applyNotificationPlan(plan: PlannedNotification[]): Promise<void> {
  await cancelAppNotifications()
  for (const item of plan) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: item.title,
          body: item.body,
          data: item.data,
          sound: false,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: item.triggerAt,
          channelId: CHANNEL_ID,
        },
      })
    } catch (error) {
      devError('notifications', 'could not schedule a reminder', error, {
        id: item.id,
        kind: item.kind,
        triggerAt: item.triggerAt.toISOString(),
      })
    }
  }
}

/**
 * Reconciles the OS schedule with the current save and preferences. Called on
 * every document/pref change and when the app returns to the foreground.
 */
export async function syncScheduledNotifications(
  document: GameDocument,
  prefs: NotificationPrefs,
  now: Date = new Date(),
): Promise<NotificationPermission> {
  const permission = await getNotificationPermission()
  if (!prefs.enabled || permission !== 'granted') {
    await cancelAppNotifications()
    return permission
  }
  const plan = buildNotificationPlan({ document, prefs, now, permission })
  await applyNotificationPlan(plan)
  return permission
}

/** Keeps the schedule in sync while the app is mounted. */
export function useNotificationSync(): void {
  const document = useAppStore((state) => state.document)
  const prefs = useNotificationPrefs()

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      if (cancelled) return
      void syncScheduledNotifications(document, prefs).catch((error: unknown) => {
        devError('notifications', 'rescheduling failed', error)
      })
    }, 350)
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncScheduledNotifications(document, prefs).catch((error: unknown) => {
          devError('notifications', 'foreground rescheduling failed', error)
        })
      }
    })
    return () => {
      cancelled = true
      clearTimeout(timer)
      subscription.remove()
    }
  }, [document, prefs])
}

export function scheduleImmediateTest(): void {
  const prefs = getNotificationPrefs()
  if (!prefs.enabled) return
  void Notifications.scheduleNotificationAsync({
    content: {
      title: 'LifeSpire',
      body: 'Local notifications are working on this device.',
      data: { app: 'lifespire', kind: 'test', url: 'lifespire://camp' },
      sound: false,
    },
    trigger: null,
  }).catch((error: unknown) => {
    devWarn('notifications', 'test notification could not be scheduled', error)
  })
}
