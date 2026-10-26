import { currentDay } from '@lifespire/core'
import type { Day, GameMap, Run } from '@lifespire/core'

export interface MapDayState {
  day: Day | null
  map: GameMap | null
  resolvedCount: number
  sealedDay: boolean
  lockedDay: boolean
  hasMap: boolean
  canOpen: boolean
  closedRun: boolean
}

/**
 * Mirrors the web map state machine: today's sealed/missed day wins over the
 * next active day, so the screen can still offer its summary after midnight.
 */
export function deriveMapDayState(run: Run | null, today: string): MapDayState {
  const activeDay = currentDay(run)
  const todayDay = run?.days.find((candidate) => candidate.date === today) ?? null
  const day =
    todayDay && (todayDay.status === 'completed' || todayDay.status === 'missed')
      ? todayDay
      : activeDay
  const map = day?.map ?? null
  const sealedDay = day?.status === 'completed' || day?.status === 'missed'
  const lockedDay = day?.status === 'locked'
  return {
    day,
    map,
    resolvedCount: day?.path.length ?? 0,
    sealedDay,
    lockedDay,
    hasMap: Boolean(map) && !sealedDay && !lockedDay,
    canOpen: Boolean(day) && !sealedDay && !lockedDay && !map,
    closedRun: !run || run.status === 'closed' || !day,
  }
}
