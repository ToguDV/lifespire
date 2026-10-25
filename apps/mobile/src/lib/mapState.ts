import { currentDay } from '@lifespire/core'
import type { Day, GameMap, MapNode, Run } from '@lifespire/core'

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

/** Copy shown in the Next step panel when there is no choice to render. */
export function railLedeCopy(run: Run | null, day: Day | null, map: GameMap | null): string {
  const runClosed = !run || run.status === 'closed' || !day
  const daySealed = day?.status === 'completed' || day?.status === 'missed'
  const dayLocked = day?.status === 'locked'
  if (!run) return 'Start a run from camp to draw the first map.'
  if (runClosed) return 'The week is sealed. Read the run summary for its path and totals.'
  if (daySealed) {
    return 'This day is sealed. Read the day summary for its rewards and weekly progress.'
  }
  if (dayLocked) return 'This day has not begun. Only today’s day can be played.'
  if (map) {
    return 'No step is open on this path. The next choice appears once this milestone can resolve nodes.'
  }
  return 'Open today’s path to draw the map. Once drawn, it will not change.'
}

/** Foot note under the Next step panel. */
export function railFoot(run: Run | null, day: Day | null, current: MapNode | null): string {
  const runClosed = !run || run.status === 'closed' || !day
  const daySealed = day?.status === 'completed' || day?.status === 'missed'
  const dayLocked = day?.status === 'locked'
  if (runClosed || daySealed || dayLocked) return 'No step can be chosen on this day.'
  if (current) return 'The chosen step stays current until the daily loop arrives.'
  return 'Locked steps open as the path unfolds.'
}
