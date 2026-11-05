import type { ReactNode } from 'react'
import { Text as RNText } from 'react-native'
import type { TextProps, TextStyle } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { type as typography } from '../theme/tokens'
import type { TextVariant } from '../theme/tokens'

export type Tone = 'default' | 'muted' | 'soft' | 'accent' | 'deep' | 'inverse'

export interface TextPropsX extends TextProps {
  variant?: TextVariant
  tone?: Tone
  align?: TextStyle['textAlign']
  children?: ReactNode
}

export function Text({
  variant = 'bodyMd',
  tone = 'default',
  align,
  style,
  children,
  ...rest
}: TextPropsX) {
  const { colors } = useTheme()
  const toneColor =
    tone === 'muted'
      ? colors.inkMuted
      : tone === 'soft'
        ? colors.inkSoft
        : tone === 'accent'
          ? colors.accent
          : tone === 'deep'
            ? colors.accentDeep
            : tone === 'inverse'
              ? colors.onAccent
              : colors.ink
  const variantStyle = typography[variant]
  // Alegreya defaults to old-style figures; ask for lining figures everywhere so
  // numbers keep the cap height even in styles that override the font family.
  const numericStyle: TextStyle = {
    fontVariant: [
      ...new Set(['lining-nums', ...(variantStyle.fontVariant ?? [])]),
    ] as TextStyle['fontVariant'],
  }

  return (
    <RNText
      {...rest}
      allowFontScaling
      maxFontSizeMultiplier={2}
      style={[
        variantStyle,
        numericStyle,
        { color: toneColor },
        align ? { textAlign: align } : null,
        style,
      ]}
    >
      {children}
    </RNText>
  )
}
