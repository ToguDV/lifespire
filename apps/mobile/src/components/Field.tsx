import { useState } from 'react'
import type { ReactNode } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import type { TextInputProps } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { fonts, radius } from '../theme/tokens'
import { Text } from './Text'

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string | null
  hint?: string
  children: ReactNode
}) {
  const { colors } = useTheme()
  return (
    <View style={styles.field}>
      <Text variant="caption" tone="muted" style={styles.label}>
        {label}
      </Text>
      {children}
      {error ? (
        <View style={styles.errorRow} accessibilityRole="alert">
          <View style={[styles.errorBadge, { borderColor: colors.inkStrong }]}>
            <Text style={[styles.errorMark, { color: colors.inkStrong }]}>!</Text>
          </View>
          <Text variant="caption" style={[styles.errorText, { color: colors.inkStrong }]}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="caption" tone="soft">
          {hint}
        </Text>
      ) : null}
    </View>
  )
}

type InputProps = TextInputProps & {
  /** Mirrors the web form attribute; React Native forwards it and Android ignores it. */
  minLength?: number
}

export function Input({ style, onFocus, onBlur, ...rest }: InputProps) {
  const { colors } = useTheme()
  const [focused, setFocused] = useState(false)
  return (
    <View style={styles.inputWrap}>
      <TextInput
        {...rest}
        allowFontScaling
        maxFontSizeMultiplier={2}
        placeholderTextColor={colors.inkSoft}
        onFocus={(event) => {
          setFocused(true)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setFocused(false)
          onBlur?.(event)
        }}
        style={[
          styles.input,
          {
            backgroundColor: colors.surfaceRaised,
            borderColor: focused ? colors.accent : colors.hairlineStrong,
            color: colors.ink,
          },
          style,
        ]}
      />
      {focused ? (
        <View
          pointerEvents="none"
          style={[styles.focusRing, { borderColor: colors.accentSoft }]}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: {
    fontFamily: fonts.uiBold,
    fontSize: 10.9,
    lineHeight: 14,
    letterSpacing: 0.65,
    textTransform: 'uppercase',
  },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  errorBadge: {
    width: 11,
    height: 11,
    marginTop: 3,
    borderWidth: 1,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorMark: { fontSize: 8, lineHeight: 9, fontFamily: fonts.uiBold },
  errorText: { flex: 1, fontFamily: fonts.uiBold, lineHeight: 18 },
  inputWrap: { width: '100%' },
  input: {
    width: '100%',
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 0,
    fontFamily: fonts.ui,
    fontSize: 13.6,
    lineHeight: 20,
  },
  focusRing: {
    position: 'absolute',
    top: -3,
    right: -3,
    bottom: -3,
    left: -3,
    borderWidth: 3,
    borderRadius: radius.sm + 3,
  },
})
