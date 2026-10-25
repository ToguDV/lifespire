import { Pressable, StyleSheet } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { layout } from '../theme/tokens'
import { Icon } from './Icon'
import { useAppStore } from '../state/store'

/** Light/night switch. Writes an explicit theme preference. */
export function ThemeToggle() {
  const { scheme, colors } = useTheme()
  const setTheme = useAppStore((state) => state.setTheme)
  const dark = scheme === 'dark'
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: dark }}
      accessibilityLabel={dark ? 'Switch to day theme' : 'Switch to night theme'}
      hitSlop={4}
      onPress={() => setTheme(dark ? 'light' : 'dark')}
      style={({ pressed }) => [styles.base, { opacity: pressed ? 0.75 : 1 }]}
    >
      <Icon name={dark ? 'sun' : 'moon'} size={18} color={colors.inkMuted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    width: layout.minTouch,
    height: layout.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
