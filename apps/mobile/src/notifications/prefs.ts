import { useSyncExternalStore } from 'react'
import { devWarn } from '../lib/devLogger'
import { kv } from '../platform/storage'

export const NOTIFICATION_PREFS_KEY = 'lifespire:notifications'

export interface NotificationPrefs {
  enabled: boolean
  dailyOpen: boolean
  dailyTime: string
  eveningNudge: boolean
  eveningTime: string
  runEnd: boolean
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: false,
  dailyOpen: true,
  dailyTime: '09:00',
  eveningNudge: true,
  eveningTime: '20:00',
  runEnd: true,
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

export function isTimeValue(value: string): boolean {
  return TIME_PATTERN.test(value)
}

function sanitize(raw: unknown): NotificationPrefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_NOTIFICATION_PREFS }
  const value = raw as Partial<NotificationPrefs>
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_NOTIFICATION_PREFS.enabled,
    dailyOpen:
      typeof value.dailyOpen === 'boolean' ? value.dailyOpen : DEFAULT_NOTIFICATION_PREFS.dailyOpen,
    dailyTime:
      typeof value.dailyTime === 'string' && isTimeValue(value.dailyTime)
        ? value.dailyTime
        : DEFAULT_NOTIFICATION_PREFS.dailyTime,
    eveningNudge:
      typeof value.eveningNudge === 'boolean'
        ? value.eveningNudge
        : DEFAULT_NOTIFICATION_PREFS.eveningNudge,
    eveningTime:
      typeof value.eveningTime === 'string' && isTimeValue(value.eveningTime)
        ? value.eveningTime
        : DEFAULT_NOTIFICATION_PREFS.eveningTime,
    runEnd: typeof value.runEnd === 'boolean' ? value.runEnd : DEFAULT_NOTIFICATION_PREFS.runEnd,
  }
}

let cached: NotificationPrefs | null = null
const listeners = new Set<() => void>()

function readStored(): NotificationPrefs {
  try {
    const raw = kv.getItem(NOTIFICATION_PREFS_KEY)
    return raw ? sanitize(JSON.parse(raw)) : { ...DEFAULT_NOTIFICATION_PREFS }
  } catch (error) {
    devWarn('notifications', 'notification preferences could not be read', error)
    return { ...DEFAULT_NOTIFICATION_PREFS }
  }
}

function snapshot(): NotificationPrefs {
  if (!cached) cached = readStored()
  return cached
}

function emit(): void {
  for (const listener of listeners) listener()
}

export function getNotificationPrefs(): NotificationPrefs {
  return { ...snapshot() }
}

export function setNotificationPrefs(patch: Partial<NotificationPrefs>): NotificationPrefs {
  const next = sanitize({ ...getNotificationPrefs(), ...patch })
  cached = next
  try {
    kv.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(next))
  } catch (error) {
    devWarn('notifications', 'notification preferences could not be saved', error)
  }
  emit()
  return { ...next }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useNotificationPrefs(): NotificationPrefs {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
