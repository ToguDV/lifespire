import { dayKey, serializeDocument } from '@lifespire/core'
import type { GameDocument } from '@lifespire/core'
import { isSaveFileTooLarge, readSaveFile } from '@lifespire/app-core/ui/importSave'
import type { ImportResult } from '@lifespire/app-core/ui/importSave'
import { pickSaveFile, shareTextFile } from '../platform/files'

/** Serializes a document under an explicit filename chosen by the caller. */
export async function exportDocumentAs(
  document: GameDocument,
  filename: string,
): Promise<void> {
  await shareTextFile(filename, serializeDocument(document))
}

export async function exportDocument(document: GameDocument): Promise<void> {
  const date = dayKey(new Date())
  await exportDocumentAs(document, `lifespire-${date}.json`)
}

export async function exportRaw(text: string): Promise<void> {
  const date = dayKey(new Date())
  await shareTextFile(`lifespire-recovery-${date}.json`, text)
}

/** A validated or rejected file keeps the name shown in the import preview. */
export type PickedImportResult = ImportResult & { fileName?: string }

export interface PickedSaveCanceled {
  canceled: true
}

export type PickedSaveResult = PickedImportResult | PickedSaveCanceled

export async function pickAndValidateSave(): Promise<PickedSaveResult> {
  const picked = await pickSaveFile(2 * 1024 * 1024)
  if (!picked) return { canceled: true }
  if (isSaveFileTooLarge(picked.size)) {
    return {
      ok: false,
      reason: 'invalid',
      message: 'That file is too large.',
      fileName: picked.name,
    }
  }
  return { ...readSaveFile(picked.text), fileName: picked.name }
}
