import { StyleSheet, View } from 'react-native'
import type { Effort } from '@lifespire/core'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Text } from './Text'

export const EFFORT_LEVEL: Record<Effort, number> = { light: 1, medium: 2, high: 3 }

export function EffortDots({ effort, showLabel = true }: { effort: Effort; showLabel?: boolean }) {
  const { colors } = useTheme()
  const level = EFFORT_LEVEL[effort]
  return (
    <View
      style={styles.row}
      accessibilityLabel={`Effort ${effort === 'high' ? 'heavy' : effort}`}
    >
      <View style={styles.dots}>
        {[1, 2, 3].map((dot) => (
          <View
            key={dot}
            style={[
              styles.dot,
              {
                backgroundColor: dot <= level ? colors.accent : 'transparent',
                borderColor: dot <= level ? colors.accent : colors.hairline,
              },
            ]}
          />
        ))}
      </View>
      {showLabel ? (
        <Text variant="caption" tone="muted">
          {effort === 'high' ? 'Heavy' : effort === 'medium' ? 'Medium' : 'Light'}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 5, height: 5, borderRadius: radius.full, borderWidth: 1 },
})
