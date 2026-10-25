import { createEmptyDocument, serializeDocument } from '@lifespire/core'
import { getNow } from '@lifespire/app-core/state/clock'
import { pickSaveFile, shareTextFile } from '../platform/files'
import { exportDocument, exportDocumentAs, exportRaw, pickAndValidateSave } from './exportImport'

jest.mock('../platform/files', () => ({
  pickSaveFile: jest.fn(),
  shareTextFile: jest.fn(),
}))

jest.mock('@lifespire/app-core/state/clock', () => ({
  getNow: jest.fn(),
}))

const mockGetNow = jest.mocked(getNow)

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

  it('names the export file from the shared clock', async () => {
    mockGetNow.mockReturnValue(new Date(2026, 9, 24, 12, 0, 0))

    await exportDocument(createEmptyDocument())

    expect(mockGetNow).toHaveBeenCalled()
    expect(mockShare).toHaveBeenCalledWith(
      'lifespire-2026-10-24.json',
      expect.any(String),
    )
  })

  it('names the recovery export from the shared clock', async () => {
    mockGetNow.mockReturnValue(new Date(2026, 9, 24, 12, 0, 0))

    await exportRaw('{}')

    expect(mockGetNow).toHaveBeenCalled()
    expect(mockShare).toHaveBeenCalledWith('lifespire-recovery-2026-10-24.json', '{}')
  })

  it('accepts an explicit date for deterministic filenames', async () => {
    const at = new Date(2026, 0, 5, 9, 0, 0)

    await exportDocument(createEmptyDocument(), at)

    expect(mockShare).toHaveBeenCalledWith(
      'lifespire-2026-01-05.json',
      expect.any(String),
    )

    await exportRaw('{}', at)

    expect(mockShare).toHaveBeenCalledWith('lifespire-recovery-2026-01-05.json', '{}')
  })
})
