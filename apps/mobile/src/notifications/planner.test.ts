import { createDemoSetup, createEmptyDocument, createRun } from '@lifespire/core'
import type { GameDocument } from '@lifespire/core'
import { buildNotificationPlan } from './planner'
import { DEFAULT_NOTIFICATION_PREFS } from './prefs'
import type { NotificationPrefs } from './prefs'

const PREFS: NotificationPrefs = {
  ...DEFAULT_NOTIFICATION_PREFS,
  enabled: true,
}

function documentAt(now: Date): GameDocument {
  const setup = createDemoSetup(now)
  const run = createRun({
    setup: { goals: setup.goals, tasks: setup.tasks },
    now,
    runId: 'run_plan',
    timeZone: null,
  })
  return {
    ...createEmptyDocument(),
    profile: {
      id: 'profile_plan',
      name: 'Wren',
      xp: 0,
      level: 1,
      gold: 0,
      loot: [],
      createdAt: now.toISOString(),
    },
    goals: [...setup.goals],
    tasks: [...setup.tasks],
    run,
  }
}

describe('buildNotificationPlan', () => {
  const now = new Date(2026, 9, 24, 8, 0, 0)
  const document = documentAt(now)

  it('returns nothing when disabled', () => {
    expect(
      buildNotificationPlan({
        document,
        prefs: { ...PREFS, enabled: false },
        now,
        permission: 'granted',
      }),
    ).toEqual([])
  })

  it('returns nothing without permission', () => {
    expect(
      buildNotificationPlan({ document, prefs: PREFS, now, permission: 'denied' }),
    ).toEqual([])
    expect(
      buildNotificationPlan({ document, prefs: PREFS, now, permission: 'undetermined' }),
    ).toEqual([])
  })

  it('returns nothing without a run', () => {
    expect(
      buildNotificationPlan({
        document: { ...document, run: null },
        prefs: PREFS,
        now,
        permission: 'granted',
      }),
    ).toEqual([])
  })

  it('schedules today, the remaining days and a single run-end note', () => {
    const plan = buildNotificationPlan({ document, prefs: PREFS, now, permission: 'granted' })
    expect(plan.filter((item) => item.kind === 'day-open')).toHaveLength(7)
    expect(plan.filter((item) => item.kind === 'evening')).toHaveLength(6)
    expect(plan.filter((item) => item.kind === 'run-end')).toHaveLength(1)

    const todayOpen = plan.find((item) => item.kind === 'day-open' && item.triggerAt.getDate() === 24)
    expect(todayOpen).toBeDefined()
    expect(todayOpen?.triggerAt.getHours()).toBe(9)
    expect(todayOpen?.data.url).toBe('lifespire://map')
  })

  it('skips a day that is already sealed', () => {
    const sealed = {
      ...document,
      run: {
        ...document.run!,
        days: document.run!.days.map((day, index) =>
          index === 0 ? { ...day, status: 'completed' as const } : day,
        ),
      },
    }
    const plan = buildNotificationPlan({ document: sealed, prefs: PREFS, now, permission: 'granted' })
    expect(plan.filter((item) => item.kind === 'day-open')).toHaveLength(6)
    expect(plan.filter((item) => item.kind === 'evening')).toHaveLength(5)
  })

  it('does not schedule past times', () => {
    const late = new Date(2026, 9, 24, 22, 0, 0)
    const plan = buildNotificationPlan({ document, prefs: PREFS, now: late, permission: 'granted' })
    expect(plan.find((item) => item.kind === 'day-open' && item.triggerAt.getDate() === 24)).toBeUndefined()
  })

  it('honours the per-reminder switches', () => {
    const plan = buildNotificationPlan({
      document,
      prefs: { ...PREFS, dailyOpen: false, eveningNudge: false, runEnd: false },
      now,
      permission: 'granted',
    })
    expect(plan).toEqual([])
  })
})
