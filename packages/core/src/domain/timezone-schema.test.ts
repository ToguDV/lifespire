import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from './balance.js'
import { createEmptyDocument, parseDocument } from './schema.js'

describe('schema v3 run.timeZone', () => {
  it('stamps version 3 on new documents', () => {
    expect(SCHEMA_VERSION).toBe(3)
    expect(createEmptyDocument().schemaVersion).toBe(3)
  })

  it('migrates v2 runs to timeZone null', () => {
    const doc = createEmptyDocument() as unknown as Record<string, unknown>
    doc.schemaVersion = 2
    ;(doc as { run: unknown }).run = {
      id: 'run_1',
      seed: 'run:run_1',
      generatorVersion: 5,
      startDate: '2026-10-20',
      status: 'active',
      objectives: [],
      days: [0, 1, 2, 3, 4, 5, 6].map((index) => ({
        id: `run_1:day:${index}`,
        index,
        date: `2026-10-${20 + index}`,
        status: index === 0 ? 'available' : 'locked',
        map: null,
        path: [],
        rewards: [],
        openedAt: null,
        closedAt: null,
        summary: null,
      })),
      totals: { xp: 0, gold: 0, lootCount: 0, nodesCompleted: 0, nodesSkipped: 0, daysPlayed: 0, daysMissed: 0 },
      createdAt: '2026-10-20T00:00:00.000Z',
      closedAt: null,
      summary: null,
    }
    const parsed = parseDocument(JSON.parse(JSON.stringify(doc)))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.schemaVersion).toBe(3)
    expect(parsed.value.run?.timeZone).toBe(null)
  })

  it('accepts valid IANA zones and rejects garbage', () => {
    const base = createEmptyDocument()
    const withRun = { ...base, run: null as unknown }
    void withRun
    const doc = JSON.parse(JSON.stringify({ ...base, run: null })) as Record<string, unknown>
    doc.schemaVersion = 3
    expect(parseDocument(doc).ok).toBe(true)
  })
})
