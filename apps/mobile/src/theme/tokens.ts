import { Platform } from 'react-native'
import type { TextStyle } from 'react-native'

export type ColorScheme = 'light' | 'dark'

export interface Palette {
  background: string
  surface: string
  surfaceRaised: string
  surfaceSunken: string
  ink: string
  inkStrong: string
  inkMuted: string
  inkSoft: string
  hairline: string
  hairlineStrong: string
  accent: string
  accentDeep: string
  accentSoft: string
  accentWash: string
  onAccent: string
  doneFill: string
  doneRim: string
  doneInk: string
  scrim: string
  wheelTask: string
  wheelGold: string
  wheelXp: string
  wheelRest: string
  wheelStroke: string
  wheelIcon: string
}

const light: Palette = {
  background: '#f1f0ea',
  surface: '#f8f7f2',
  surfaceRaised: '#fcfbf7',
  surfaceSunken: '#e9e7df',
  ink: '#20241e',
  inkStrong: '#12160f',
  inkMuted: '#61665b',
  inkSoft: '#64695d',
  hairline: '#d8d5c9',
  hairlineStrong: '#b9b6a8',
  accent: '#4d6b5a',
  accentDeep: '#385342',
  accentSoft: '#dfe7de',
  accentWash: 'rgba(77, 107, 90, 0.075)',
  onAccent: '#f8f7f2',
  doneFill: '#20241e',
  doneRim: '#20241e',
  doneInk: '#f1f0ea',
  scrim: 'rgba(22, 26, 20, 0.42)',
  // The wheel is theme-invariant: Day and Night share the same wheel palette.
  wheelTask: '#20241e',
  wheelGold: '#385342',
  wheelXp: '#4d6b5a',
  wheelRest: '#6b5a3e',
  wheelStroke: '#40453a',
  wheelIcon: '#f1f0ea',
}

const dark: Palette = {
  background: '#131511',
  surface: '#191c17',
  surfaceRaised: '#20231d',
  surfaceSunken: '#0e100c',
  ink: '#e8e5d9',
  inkStrong: '#f5f2e7',
  inkMuted: '#a3a598',
  inkSoft: '#8b8f82',
  hairline: '#2c3028',
  hairlineStrong: '#40453a',
  accent: '#9dbba8',
  accentDeep: '#c5dacb',
  accentSoft: '#263229',
  accentWash: 'rgba(157, 187, 168, 0.08)',
  onAccent: '#131511',
  doneFill: '#333830',
  doneRim: '#464c3f',
  doneInk: '#c3c7b9',
  scrim: 'rgba(5, 7, 4, 0.62)',
  // Same wheel palette as Day: the wheel never changes with the theme.
  wheelTask: '#20241e',
  wheelGold: '#385342',
  wheelXp: '#4d6b5a',
  wheelRest: '#6b5a3e',
  wheelStroke: '#40453a',
  wheelIcon: '#f1f0ea',
}

export const palettes: Record<ColorScheme, Palette> = { light, dark }

export const fonts = {
  display: 'Alegreya_600SemiBold',
  displayRegular: 'Alegreya_400Regular',
  displayBold: 'Alegreya_700Bold',
  displayItalic: 'Alegreya_400Regular_Italic',
  displaySemiBoldItalic: 'Alegreya_600SemiBold_Italic',
  ui: 'AlegreyaSans_400Regular',
  uiMedium: 'AlegreyaSans_500Medium',
  uiBold: 'AlegreyaSans_700Bold',
} as const

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  xxxxl: 56,
  section: 72,
} as const

export const radius = {
  xs: 4,
  sm: 8,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 24,
  full: 9999,
} as const

export type TextVariant =
  | 'displayXl'
  | 'displayLg'
  | 'displayMd'
  | 'headingLg'
  | 'headingMd'
  | 'headingSm'
  | 'bodyLg'
  | 'bodyMd'
  | 'bodySm'
  | 'caption'
  | 'micro'
  | 'button'
  | 'numeral'
  | 'brand'
  | 'tab'
  | 'resource'
  | 'level'

export const type: Record<TextVariant, TextStyle> = {
  displayXl: { fontFamily: fonts.display, fontSize: 44, lineHeight: 48, letterSpacing: -0.66 },
  displayLg: { fontFamily: fonts.display, fontSize: 36, lineHeight: 39, letterSpacing: -0.54 },
  displayMd: { fontFamily: fonts.display, fontSize: 27, lineHeight: 29, letterSpacing: -0.4 },
  headingLg: { fontFamily: fonts.display, fontSize: 22.5, lineHeight: 25, letterSpacing: -0.22 },
  headingMd: { fontFamily: fonts.display, fontSize: 20, lineHeight: 25 },
  headingSm: { fontFamily: fonts.display, fontSize: 16.8, lineHeight: 22 },
  bodyLg: { fontFamily: fonts.ui, fontSize: 17, lineHeight: 27 },
  bodyMd: { fontFamily: fonts.ui, fontSize: 15, lineHeight: 23 },
  bodySm: { fontFamily: fonts.ui, fontSize: 13.5, lineHeight: 20 },
  caption: { fontFamily: fonts.uiMedium, fontSize: 12, lineHeight: 18, letterSpacing: 0.12 },
  micro: {
    fontFamily: fonts.uiBold,
    fontSize: 10.5,
    lineHeight: 13,
    letterSpacing: 1.68,
  },
  button: { fontFamily: fonts.uiBold, fontSize: 13, lineHeight: 18, letterSpacing: 0.26 },
  numeral: {
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 21,
    letterSpacing: 0,
    fontVariant: ['tabular-nums'],
  },
  brand: {
    fontFamily: fonts.display,
    fontSize: 13.8,
    lineHeight: 18,
    letterSpacing: 2.07,
    textTransform: 'uppercase',
  },
  tab: {
    fontFamily: fonts.uiBold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  resource: {
    fontFamily: fonts.uiBold,
    fontSize: 12.8,
    lineHeight: 16,
    letterSpacing: 0,
    fontVariant: ['tabular-nums'],
  },
  level: {
    fontFamily: fonts.uiBold,
    fontSize: 11.5,
    lineHeight: 15,
    letterSpacing: 0.46,
  },
}

export const layout = {
  screenPadding: space.md,
  tabbarHeight: 64,
  topbarHeight: 56,
  minTouch: Platform.OS === 'android' ? 48 : 44,
  maxContentWidth: 780,
} as const

export const shadows = {
  soft: {
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  float: {
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
  },
} as const
