import { useColorScheme } from 'react-native'
import { useAppStore } from '../state/store'
import { palettes } from './tokens'
import type { ColorScheme, Palette } from './tokens'

export function resolvedScheme(preference: 'light' | 'dark' | 'system', system: string | null | undefined): ColorScheme {
  if (preference === 'system') return system === 'dark' ? 'dark' : 'light'
  return preference
}

export function useTheme(): { scheme: ColorScheme; colors: Palette } {
  const preference = useAppStore((state) => state.document.settings.theme)
  const system = useColorScheme()
  const scheme = resolvedScheme(preference, system)
  return { scheme, colors: palettes[scheme] }
}
