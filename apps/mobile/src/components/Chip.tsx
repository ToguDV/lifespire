import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { fonts, radius } from '../theme/tokens'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { Text } from './Text'

export type ChipVariant = 'default' | 'accent' | 'quiet'

export function Chip({
  children,
  icon,
  variant = 'default',
}: {
  children: ReactNode
  icon?: IconName
  variant?: ChipVariant
}) {
  const { colors } = useTheme()
  return (
    <View
      style={[
        styles.chip,
        {
          borderColor: variant === 'accent' ? colors.accent : colors.hairline,
          backgroundColor:
            variant === 'accent' ? colors.accentSoft : variant === 'quiet' ? 'transparent' : colors.surface,
        },
      ]}
    >
      {icon ? (
        <Icon
          name={icon}
          size={13}
          color={variant === 'accent' ? colors.accentDeep : variant === 'quiet' ? colors.inkSoft : colors.inkMuted}
        />
      ) : null}
      <Text
        variant="caption"
        style={[
          styles.label,
          {
            color:
              variant === 'accent' ? colors.accentDeep : variant === 'quiet' ? colors.inkSoft : colors.inkMuted,
          },
        ]}
      >
        {children}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    minHeight: 26,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: radius.full,
  },
  label: {
    fontFamily: fonts.uiBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    lineHeight: 12,
  },
})
