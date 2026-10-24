import { SCHEMA_VERSION } from '../../domain/balance'
import { parseDocument } from '../../domain/schema'
import { levelForXp } from '../../domain/selectors'
import type { GameDocument, Run } from '../../domain/types'

/** Imports are local text files; anything larger is almost certainly wrong. */
export const MAX_SAVE_BYTES = 2 * 1024 * 1024

/** Pure size gate so the file picker can reject oversized saves unread. */
export function isSaveFileTooLarge(size: number): boolean {
  return size > MAX_SAVE_BYTES
}

export interface ImportSummary {
  schemaVersion: number
  profileName: string | null
  level: number | null
  gold: number | null
  relics: number
  goals: number
  routines: number
  runStatus: Run['status'] | null
  runDay: number | null
  daysPlayed: number
}

export interface ImportSuccess {
  ok: true
  document: GameDocument
  summary: ImportSummary
}

export interface ImportFailure {
  ok: false
  reason: 'invalid' | 'future-version'
  message: string
}

export type ImportResult = ImportSuccess | ImportFailure

function runDayNumber(run: Run): number | null {
  const openDay = run.days.find(
    (day) => day.status !== 'completed' && day.status !== 'missed',
  )
  if (openDay) return openDay.index + 1

  const recorded = [...run.days]
    .reverse()
    .find((day) => day.status === 'completed' || day.status === 'missed')
  return recorded ? recorded.index + 1 : null
}

/** Read-only preview data shown before an import replaces local state. */
export function summarizeDocument(document: GameDocument): ImportSummary {
  const run = document.run
  return {
    schemaVersion: document.schemaVersion,
    profileName: document.profile?.name ?? null,
    level: document.profile ? levelForXp(document.profile.xp) : null,
    gold: document.profile?.gold ?? null,
    relics: document.profile?.loot.length ?? 0,
    goals: document.goals.length,
    routines: document.tasks.length,
    runStatus: run?.status ?? null,
    runDay: run ? runDayNumber(run) : null,
    daysPlayed: run?.days.filter((day) => day.status === 'completed').length ?? 0,
  }
}

/** Validates the text read from a file without touching the current document. */
export function readSaveFile(text: string): ImportResult {
  const parsed = parseDocument(text)
  if (!parsed.ok) {
    return {
      ok: false,
      reason: parsed.reason,
      message:
        parsed.reason === 'future-version'
          ? `${parsed.error} Update LifeSpire or use a save from version ${SCHEMA_VERSION}.`
          : `That file is not a valid LifeSpire save. ${parsed.error}`,
    }
  }

  return {
    ok: true,
    document: parsed.value,
    summary: summarizeDocument(parsed.value),
  }
}

/** Local-date filename keeps successive exports easy to tell apart. */
export function saveFileName(localDayKey: string): string {
  return `lifespire-${localDayKey}.json`
}

export function runPreviewLabel(
  summary: Pick<ImportSummary, 'runStatus' | 'runDay' | 'daysPlayed'>,
): string {
  if (!summary.runStatus) return 'No run'
  if (summary.runStatus === 'closed') {
    return `Closed · ${summary.daysPlayed} of 7 days played`
  }
  return summary.runDay ? `Active · day ${summary.runDay} of 7` : 'Active · no open day'
}
