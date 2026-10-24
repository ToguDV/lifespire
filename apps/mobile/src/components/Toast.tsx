import { useEffect, useRef } from 'react'
import { Animated, Pressable, StyleSheet, View } from 'react-native'
import type { RewardEvent } from '@lifespire/core'
import { NODE_TYPE_LABEL, RARITY_LABEL, lootIcon } from '@lifespire/app-core/ui/format'
import { useTheme } from '../theme/ThemeProvider'
import { radius, shadows, space } from '../theme/tokens'
import { Icon } from './Icon'
import { Text } from './Text'

export function Toast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  const { colors } = useTheme()
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!message) return
    opacity.setValue(0)
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start()
    const timer = setTimeout(onDismiss, 3600)
    return () => clearTimeout(timer)
  }, [message, onDismiss, opacity])

  if (!message) return null
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.toastWrap, { opacity }]}
    >
      <Pressable
        accessibilityRole="alert"
        accessibilityLabel={message}
        onPress={onDismiss}
        style={[styles.toast, shadows.soft, { backgroundColor: colors.ink, borderColor: colors.inkStrong }]}
      >
        <Text variant="bodySm" tone="inverse" style={styles.toastText}>
          {message}
        </Text>
      </Pressable>
    </Animated.View>
  )
}

export function RewardToast({
  event,
  onDismiss,
}: {
  event: RewardEvent | null
  onDismiss: () => void
}) {
  const { colors } = useTheme()
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!event) return
    opacity.setValue(0)
    Animated.spring(opacity, { toValue: 1, useNativeDriver: true, damping: 18 }).start()
    const timer = setTimeout(onDismiss, 5200)
    return () => clearTimeout(timer)
  }, [event, onDismiss, opacity])

  if (!event) return null
  const isSkip = event.action === 'skip'
  return (
    <Animated.View style={[styles.rewardWrap, { opacity }]}>
      <Pressable
        accessibilityRole="summary"
        accessibilityLabel={`${NODE_TYPE_LABEL[event.nodeType]} ${isSkip ? 'skipped' : 'completed'}`}
        onPress={onDismiss}
        style={[styles.reward, shadows.float, { backgroundColor: colors.surfaceRaised, borderColor: colors.hairline }]}
      >
        <View style={styles.rewardHead}>
          <Icon
            name={isSkip ? 'arrow-left' : event.nodeType === 'boss' ? 'crown' : 'check'}
            size={18}
            color={isSkip ? colors.inkMuted : colors.accent}
          />
          <Text variant="micro" tone={isSkip ? 'muted' : 'accent'}>
            {isSkip ? 'SKIPPED' : 'RECORDED'}
          </Text>
          <Text variant="bodySm" tone="muted" style={styles.rewardType}>
            {NODE_TYPE_LABEL[event.nodeType]}
          </Text>
        </View>
        <Text variant="headingSm" numberOfLines={2}>
          {event.taskTitle ?? event.goalTitle ?? 'The path moves on'}
        </Text>
        {!isSkip ? (
          <View style={styles.rewardRow}>
            {event.xp > 0 ? <Text variant="bodySm" tone="xp">{`+${event.xp} XP`}</Text> : null}
            {event.gold > 0 ? <Text variant="bodySm" tone="gold">{`+${event.gold} gold`}</Text> : null}
            {event.progress > 0 ? <Text variant="bodySm" tone="accent">{`+${event.progress} target`}</Text> : null}
          </View>
        ) : null}
        {event.lootItem ? (
          <View style={styles.lootRow}>
            <Icon name={lootIcon(event.lootItem.catalogId)} size={14} color={colors.accent} />
            <Text variant="bodySm" tone="muted" numberOfLines={1}>
              {event.lootItem.name} · {RARITY_LABEL[event.lootItem.rarity]}
            </Text>
          </View>
        ) : null}
        {event.duplicateGold > 0 ? (
          <Text variant="bodySm" tone="gold">
            {`Duplicate converted · +${event.duplicateGold} gold`}
          </Text>
        ) : null}
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  toastWrap: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: 84,
    alignItems: 'center',
  },
  toast: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    maxWidth: 560,
  },
  toastText: { textAlign: 'center' },
  rewardWrap: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: 84,
  },
  reward: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.md,
    gap: space.xs,
  },
  rewardHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  rewardType: { marginLeft: 'auto' },
  rewardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  lootRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
})
