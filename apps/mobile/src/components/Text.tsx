import type { ReactNode } from 'react'
import { Text as RNText } from 'react-native'
import type { TextProps, TextStyle } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { type as typography } from '../theme/tokens'
import type { TextVariant } from '../theme/tokens'

export type Tone = 'default' | 'muted' | 'soft' | 'accent' | 'deep' | 'gold' | 'xp' | 'danger' | 'inverse'

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
            : tone === 'gold' || tone === 'xp' || tone === 'danger'
              ? colors.inkStrong
              : tone === 'inverse'
                ? colors.onAccent
                : colors.ink

  return (
    <RNText
      {...rest}
      allowFontScaling
      maxFontSizeMultiplier={2}
      style={[typography[variant], { color: toneColor }, align ? { textAlign: align } : null, style]}
    >
      {children}
    </RNText>
  )
}
