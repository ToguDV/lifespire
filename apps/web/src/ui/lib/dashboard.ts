import { availableNodeIds, currentDay } from '../../domain/selectors'
import type { Day, Run } from '../../domain/types'

export type HomePhase =
  | 'no-run'
  | 'day-available'
  | 'day-in-progress'
  | 'day-completed'
  | 'day-missed'
  | 'day-locked'
  | 'run-closed'
  | 'no-open-day'

export type HomeCta =
  | 'begin-run'
  | 'open-day'
  | 'continue-day'
  | 'review-day'
  | 'review-week'
  | 'none'

export interface HomeState {
  phase: HomePhase
  /** Day whose local date is today, independently of `currentDay(run)`. */
  today: Day | null
  cta: HomeCta
  availableChoices: number
  hasSelection: boolean
  /** Locked days still ahead in the run. */
  daysAhead: number
  isWaitingForMidnight: boolean
}

const EMPTY_STATE: HomeState = {
  phase: 'no-run',
  today: null,
  cta: 'begin-run',
  availableChoices: 0,
  hasSelection: false,
  daysAhead: 0,
  isWaitingForMidnight: false,
}

/**
 * Derives the camp dashboard state from persisted data and an injected local
 * day key. Reading today's date instead of `currentDay(run)` is what lets the
 * screen say "the day is sealed" after the boss, when the next day is locked.
 */
export function homeState(run: Run | null, todayKey: string): HomeState {
  if (!run) return EMPTY_STATE

  if (run.status === 'closed') {
    return {
      phase: 'run-closed',
      today: run.days.find((day) => day.date === todayKey) ?? null,
      cta: 'review-week',
      availableChoices: 0,
      hasSelection: false,
      daysAhead: 0,
      isWaitingForMidnight: false,
    }
  }

  const daysAhead = run.days.filter((day) => day.status === 'locked').length
  const today = run.days.find((day) => day.date === todayKey) ?? null

  if (!today) {
    const openDay = currentDay(run)
    return {
      phase: openDay ? 'day-locked' : 'no-open-day',
      today: null,
      cta: openDay ? 'none' : 'review-week',
      availableChoices: 0,
      hasSelection: false,
      daysAhead,
      isWaitingForMidnight: false,
    }
  }

  if (today.status === 'completed') {
    return {
      phase: 'day-completed',
      today,
      cta: 'review-day',
      availableChoices: 0,
      hasSelection: false,
      daysAhead,
      isWaitingForMidnight: true,
    }
  }

  if (today.status === 'missed') {
    return {
      phase: 'day-missed',
      today,
      cta: 'review-week',
      availableChoices: 0,
      hasSelection: false,
      daysAhead,
      isWaitingForMidnight: true,
    }
  }

  if (today.status === 'locked') {
    return {
      phase: 'day-locked',
      today,
      cta: 'none',
      availableChoices: 0,
      hasSelection: false,
      daysAhead,
      isWaitingForMidnight: false,
    }
  }

  if (today.status === 'available' || !today.map) {
    return {
      phase: 'day-available',
      today,
      cta: 'open-day',
      availableChoices: 0,
      hasSelection: false,
      daysAhead,
      isWaitingForMidnight: false,
    }
  }

  const choices = availableNodeIds(today.map, today)
  return {
    phase: 'day-in-progress',
    today,
    cta: 'continue-day',
    availableChoices: choices.length,
    hasSelection: today.map.currentNodeId !== null,
    daysAhead,
    isWaitingForMidnight: false,
  }
}

export type WeekMarker = 'completed' | 'missed' | 'today' | 'locked'

/** Timeline marker for one day. Completed and missed always win over "today". */
export function weekMarker(day: Day, todayKey: string): WeekMarker {
  if (day.status === 'completed') return 'completed'
  if (day.status === 'missed') return 'missed'
  if (day.date === todayKey) return 'today'
  return 'locked'
}
