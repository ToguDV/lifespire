import { dayKey, serializeDocument } from '@lifespire/core'
import type { GameDocument } from '@lifespire/core'
import { isSaveFileTooLarge, readSaveFile } from '@lifespire/app-core/ui/importSave'
import type { ImportResult } from '@lifespire/app-core/ui/importSave'
import { pickSaveFile, shareTextFile } from '../platform/files'

export async function exportDocument(document: GameDocument): Promise<void> {
  const date = dayKey(new Date())
  await shareTextFile(`lifespire-${date}.json`, serializeDocument(document))
}

export async function exportRaw(text: string): Promise<void> {
  const date = dayKey(new Date())
  await shareTextFile(`lifespire-recovery-${date}.json`, text)
}

export interface PickedSaveResult {
  canceled: true
}

export async function pickAndValidateSave(): Promise<ImportResult | PickedSaveResult> {
  const picked = await pickSaveFile(2 * 1024 * 1024)
  if (!picked) return { canceled: true }
  if (isSaveFileTooLarge(picked.size)) {
    return { ok: false, reason: 'invalid', message: 'That file is too large.' }
  }
  return readSaveFile(picked.text)
}
