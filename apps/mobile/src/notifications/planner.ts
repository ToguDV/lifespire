import { dayKey, parseDayKey } from '@lifespire/core'
import type { Day, GameDocument, Run } from '@lifespire/core'
import type { NotificationPrefs } from './prefs'

export type NotificationKind = 'day-open' | 'evening' | 'run-end'

export interface PlannedNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  triggerAt: Date
  data: { app: 'lifespire'; kind: NotificationKind; url: string }
}

export interface NotificationPlanInput {
  document: GameDocument
  prefs: NotificationPrefs
  now: Date
  permission: 'granted' | 'denied' | 'undetermined'
}

const MIN_LEAD_MS = 30_000

function atTime(day: string, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number)
  const date = parseDayKey(day)
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0)
  return date
}

function dayOpenCopy(day: Day): { title: string; body: string } {
  if (day.status === 'in_progress') {
    return {
      title: 'Your path is waiting',
      body: 'One step is enough. Continue today’s climb before midnight.',
    }
  }
  return {
    title: 'Today’s map is ready',
    body: 'Choose a path and keep one small promise.',
  }
}

function eveningCopy(day: Day): { title: string; body: string } {
  if (day.status === 'locked') {
    return {
      title: 'Today’s map is ready',
      body: 'The day is open. One small step is enough before midnight.',
    }
  }
  if (day.status === 'in_progress') {
    return {
      title: 'The day is still open',
      body: 'Your path is unfinished. One small step before midnight is enough.',
    }
  }
  return {
    title: 'There is still time',
    body: 'Today’s map is unopened. One small step is enough.',
  }
}

/**
 * Pure plan for local reminders. It only uses persisted state and an injected
 * clock, so the notification rules are unit-testable without the OS.
 */
export function buildNotificationPlan({
  document,
  prefs,
  now,
  permission,
}: NotificationPlanInput): PlannedNotification[] {
  if (!prefs.enabled || permission !== 'granted') return []
  const run: Run | null = document.run
  if (!document.profile || !run || run.status !== 'active') return []
  const today = dayKey(now, run.timeZone ?? null)
  const planned: PlannedNotification[] = []
  const lastDay = run.days[run.days.length - 1]

  for (const day of run.days) {
    if (day.date < today) continue
    if (day.status === 'completed' || day.status === 'missed') continue
    if (prefs.dailyOpen && (day.date > today || day.status === 'available')) {
      const triggerAt = atTime(day.date, prefs.dailyTime)
      if (triggerAt.getTime() > now.getTime() + MIN_LEAD_MS) {
        const copy = dayOpenCopy(day)
        planned.push({
          id: `lifespire:day-open:${day.id}`,
          kind: 'day-open',
          title: copy.title,
          body: copy.body,
          triggerAt,
          data: { app: 'lifespire', kind: 'day-open', url: 'lifespire://map' },
        })
      }
    }
    if (prefs.eveningNudge && day.id !== lastDay?.id) {
      const triggerAt = atTime(day.date, prefs.eveningTime)
      if (triggerAt.getTime() > now.getTime() + MIN_LEAD_MS) {
        const copy = eveningCopy(day)
        planned.push({
          id: `lifespire:evening:${day.id}`,
          kind: 'evening',
          title: copy.title,
          body: copy.body,
          triggerAt,
          data: { app: 'lifespire', kind: 'evening', url: 'lifespire://map' },
        })
      }
    }
  }

  if (prefs.runEnd && lastDay && lastDay.status !== 'completed' && lastDay.status !== 'missed') {
    const triggerAt = atTime(lastDay.date, prefs.eveningTime)
    if (triggerAt.getTime() > now.getTime() + MIN_LEAD_MS) {
      planned.push({
        id: `lifespire:run-end:${run.id}`,
        kind: 'run-end',
        title: 'The week ends today',
        body: 'Close the day to seal the run and receive its weekly bonus.',
        triggerAt,
        data: { app: 'lifespire', kind: 'run-end', url: 'lifespire://map' },
      })
    }
  }

  return planned
}
