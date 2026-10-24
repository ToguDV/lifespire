import { describe, expect, it } from 'vitest'
import { normalizeBaseUrl, resolveSyncBaseUrl } from './api'

describe('sync base URL', () => {
  it('normalizes user input to the origin', () => {
    expect(normalizeBaseUrl('https://sync.example.com/')).toBe('https://sync.example.com')
    expect(normalizeBaseUrl('  http://localhost:3000/v1  ')).toBe('http://localhost:3000')
    expect(normalizeBaseUrl('notaurl')).toBeNull()
    expect(normalizeBaseUrl('ftp://files.example.com')).toBeNull()
    expect(normalizeBaseUrl('')).toBeNull()
  })

  it('prefers the stored override over the build default', () => {
    expect(resolveSyncBaseUrl('https://build.example.com', 'https://custom.example.com/')).toBe(
      'https://custom.example.com',
    )
    expect(resolveSyncBaseUrl('https://build.example.com', null)).toBe(
      'https://build.example.com',
    )
    expect(resolveSyncBaseUrl(undefined, null)).toBe('')
  })

  it('ignores a corrupt stored value', () => {
    expect(resolveSyncBaseUrl('https://build.example.com', 'notaurl')).toBe(
      'https://build.example.com',
    )
  })
})
