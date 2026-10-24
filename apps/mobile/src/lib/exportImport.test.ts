import { createEmptyDocument, serializeDocument } from '@lifespire/core'
import { pickSaveFile, shareTextFile } from '../platform/files'
import { exportDocumentAs, pickAndValidateSave } from './exportImport'

jest.mock('../platform/files', () => ({
  pickSaveFile: jest.fn(),
  shareTextFile: jest.fn(),
}))

const mockPick = jest.mocked(pickSaveFile)
const mockShare = jest.mocked(shareTextFile)

describe('mobile save files', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('keeps the picked filename on a valid save', async () => {
    const document = createEmptyDocument()
    mockPick.mockResolvedValue({
      text: serializeDocument(document),
      name: 'backup.json',
      size: 128,
    })

    await expect(pickAndValidateSave()).resolves.toMatchObject({
      ok: true,
      document,
      fileName: 'backup.json',
    })
  })

  it('keeps the picked filename when validation fails', async () => {
    mockPick.mockResolvedValue({
      text: '{"schemaVersion":3}',
      name: 'broken.json',
      size: 20,
    })

    await expect(pickAndValidateSave()).resolves.toMatchObject({
      ok: false,
      fileName: 'broken.json',
    })
  })

  it('keeps the picked filename when the file is too large', async () => {
    mockPick.mockResolvedValue({
      text: '{}',
      name: 'huge.json',
      size: 3 * 1024 * 1024,
    })

    await expect(pickAndValidateSave()).resolves.toEqual({
      ok: false,
      reason: 'invalid',
      message: 'That file is too large.',
      fileName: 'huge.json',
    })
  })

  it('returns canceled when the picker closes', async () => {
    mockPick.mockResolvedValue(null)

    await expect(pickAndValidateSave()).resolves.toEqual({ canceled: true })
    expect(mockShare).not.toHaveBeenCalled()
  })

  it('serializes a document under the requested filename', async () => {
    const document = createEmptyDocument()

    await exportDocumentAs(document, 'lifespire-cloud-2026-10-24.json')

    expect(mockShare).toHaveBeenCalledWith(
      'lifespire-cloud-2026-10-24.json',
      serializeDocument(document),
    )
  })
})
