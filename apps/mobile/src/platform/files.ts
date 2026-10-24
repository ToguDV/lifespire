import * as DocumentPicker from 'expo-document-picker'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'

export interface PickedSave {
  text: string
  name: string
  size: number
}

export async function shareTextFile(filename: string, text: string): Promise<void> {
  const file = new File(Paths.cache, filename)
  file.create({ overwrite: true })
  await file.write(text)
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.')
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Export LifeSpire save',
    UTI: 'public.json',
  })
}

/** Picks a JSON save and returns its text; the size gate runs before parsing. */
export async function pickSaveFile(maxBytes: number): Promise<PickedSave | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  })
  if (result.canceled) return null
  const asset = result.assets[0]
  if (!asset) return null
  const file = new File(asset.uri)
  const size = asset.size ?? file.size
  if (size > maxBytes) {
    throw new Error(`That file is too large. Saves are limited to ${Math.floor(maxBytes / 1024 / 1024)} MB.`)
  }
  return { text: await file.text(), name: asset.name, size }
}
