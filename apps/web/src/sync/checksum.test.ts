import { describe, expect, it } from 'vitest'
import { checksumDocument } from './checksum'

describe('checksumDocument', () => {
  it('is stable for the same document', () => {
    const doc = { a: 1, nested: { b: [1, 2, 3] } }
    expect(checksumDocument(doc)).toBe(checksumDocument(structuredClone(doc)))
  })

  it('changes when content changes', () => {
    expect(checksumDocument({ gold: 1 })).not.toBe(checksumDocument({ gold: 2 }))
  })

  it('returns a non-empty hex string', () => {
    expect(checksumDocument({})).toMatch(/^[0-9a-f]+$/)
  })
})
