import { describe, expect, it } from 'vitest'
import { createDemoSetup } from '../../content/demo'
import { SCHEMA_VERSION } from '../../domain/balance'
import { createRun, openDay } from '../../domain/lifecycle'
import { createEmptyDocument, serializeDocument } from '../../domain/schema'
import type { GameDocument } from '../../domain/types'
import {
  readSaveFile,
  runPreviewLabel,
  saveFileName,
  summarizeDocument,
} from './importSave'

const now = new Date(2026, 9, 20, 9, 0, 0)

function documentWithRun(closed = false): GameDocument {
  const setup = createDemoSetup(now)
  const run = createRun({ setup, now, runId: 'run_import_preview' })
  return {
    ...createEmptyDocument(),
    profile: {
      id: 'profile_import_preview',
      name: 'Wren',
      xp: 240,
      level: 3,
      gold: 75,
      loot: [],
      createdAt: now.toISOString(),
    },
    goals: setup.goals,
    tasks: setup.tasks,
    run: {
      ...run,
      status: closed ? 'closed' : 'active',
      days: run.days.map((day, index) =>
        closed && index < 2
          ? { ...day, status: 'completed' as const, closedAt: now.toISOString() }
          : day,
      ),
      closedAt: closed ? now.toISOString() : null,
    },
  }
}

describe('import preview', () => {
  it('summarizes profile, level, gold, run day, collection and schema', () => {
    const document = documentWithRun()
    const summary = summarizeDocument(document)

    expect(summary).toMatchObject({
      schemaVersion: SCHEMA_VERSION,
      profileName: 'Wren',
      level: 3,
      gold: 75,
      relics: 0,
      goals: document.goals.length,
      routines: document.tasks.length,
      runStatus: 'active',
      runDay: 1,
      daysPlayed: 0,
    })
    expect(runPreviewLabel(summary)).toBe('Active · day 1 of 7')

    const staleLevel = structuredClone(document)
    if (!staleLevel.profile) throw new Error('expected a profile')
    staleLevel.profile.level = 1
    expect(summarizeDocument(staleLevel).level).toBe(3)
  })

  it('summarizes a closed run, an absent run and an absent profile honestly', () => {
    const closed = summarizeDocument(documentWithRun(true))
    expect(closed.runStatus).toBe('closed')
    expect(closed.daysPlayed).toBe(2)
    expect(runPreviewLabel(closed)).toBe('Closed · 2 of 7 days played')

    const empty = summarizeDocument(createEmptyDocument())
    expect(empty).toMatchObject({
      profileName: null,
      level: null,
      gold: null,
      relics: 0,
      runStatus: null,
      runDay: null,
    })
    expect(runPreviewLabel(empty)).toBe('No run')
  })

  it('reads a valid exported document without changing it', () => {
    const document = documentWithRun()
    const result = readSaveFile(serializeDocument(document))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document).toEqual(document)
    expect(result.summary).toEqual(summarizeDocument(document))
  })

  it('accepts a save with a generated day map and rejects an unplayable one', () => {
    const opened = openDay(documentWithRun(), { now })
    const valid = readSaveFile(serializeDocument(opened))
    expect(valid.ok).toBe(true)
    if (valid.ok) {
      expect(valid.document.run?.days[0]?.map).not.toBeNull()
    }

    const broken = structuredClone(opened)
    broken.run!.days[0]!.map!.layers[0] = []
    const invalid = readSaveFile(serializeDocument(broken))
    expect(invalid.ok).toBe(false)
    if (invalid.ok) return
    expect(invalid.reason).toBe('invalid')
    expect(invalid.message).toContain('not a valid LifeSpire save')
    expect(invalid.message).toContain('layers[0]')
  })

  it('rejects malformed JSON, missing fields and future versions clearly', () => {
    const malformed = readSaveFile('{broken')
    expect(malformed.ok).toBe(false)
    if (malformed.ok) return
    expect(malformed.reason).toBe('invalid')
    expect(malformed.message).toContain('not a valid LifeSpire save')
    expect(malformed.message).toContain('valid JSON')

    const missing = readSaveFile(JSON.stringify({ schemaVersion: 1 }))
    expect(missing.ok).toBe(false)
    if (missing.ok) return
    expect(missing.reason).toBe('invalid')
    expect(missing.message).toContain('profile')

    const future = readSaveFile(JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1 }))
    expect(future.ok).toBe(false)
    if (future.ok) return
    expect(future.reason).toBe('future-version')
    expect(future.message).toContain(`version ${SCHEMA_VERSION + 1}`)
    expect(future.message).toContain('Update LifeSpire')
  })

  it('builds a dated local filename', () => {
    expect(saveFileName('2026-10-21')).toBe('lifespire-2026-10-21.json')
  })
})
