import { useEffect, useRef } from 'react'
import { Animated, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { RewardEvent } from '@lifespire/core'
import { NODE_TYPE_LABEL, RARITY_LABEL } from '@lifespire/app-core/ui/format'
import { useTheme } from '../theme/ThemeProvider'
import { fonts, layout, radius, shadows } from '../theme/tokens'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { Text } from './Text'

export function Toast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!message) return
    opacity.setValue(0)
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start()
    const timer = setTimeout(onDismiss, 5000)
    return () => clearTimeout(timer)
  }, [message, onDismiss, opacity])

  if (!message) return null
  return (
    <Animated.View
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
      style={[
        styles.toastWrap,
        { bottom: layout.tabbarHeight + insets.bottom + 12, opacity },
      ]}
    >
      <View
        style={[
          styles.toast,
          shadows.float,
          { backgroundColor: colors.ink, borderColor: colors.hairlineStrong },
        ]}
      >
        <Text variant="bodySm" tone="inverse" style={styles.toastText}>
          {message}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={onDismiss}
          hitSlop={8}
          style={styles.dismiss}
        >
          <Text variant="micro" tone="inverse" style={styles.dismissLabel}>
            Dismiss
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  )
}

function Bit({
  icon,
  label,
  color,
  bold,
}: {
  icon: IconName
  label: string
  color: string
  bold?: boolean
}) {
  return (
    <View style={styles.bit}>
      <Icon name={icon} size={13} color={color} />
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={1.5}
        style={[styles.bitText, bold ? styles.bitBold : null, { color }]}
      >
        {label}
      </Text>
    </View>
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
  const insets = useSafeAreaInsets()
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
  const title = isSkip
    ? `${NODE_TYPE_LABEL[event.nodeType]} skipped`
    : (event.taskTitle ?? event.goalTitle ?? 'The path moves on')
  return (
    <Animated.View
      style={[styles.rewardWrap, { bottom: layout.tabbarHeight + insets.bottom + 12, opacity }]}
    >
      <Pressable
        accessibilityRole="summary"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${NODE_TYPE_LABEL[event.nodeType]} ${isSkip ? 'skipped' : 'completed'}`}
        onPress={onDismiss}
        style={[
          styles.reward,
          shadows.float,
          { backgroundColor: colors.ink, borderColor: colors.hairlineStrong },
        ]}
      >
        <View style={[styles.seal, { backgroundColor: colors.accent }]}>
          <Icon name={isSkip ? 'arrow-left' : 'check'} size={15} color={colors.onAccent} />
        </View>
        <View style={styles.rewardBody}>
          <Text
            numberOfLines={2}
            maxFontSizeMultiplier={1.5}
            style={[styles.rewardTitle, { color: colors.background }]}
          >
            {title}
          </Text>
          {!isSkip ? (
            <View style={styles.bits}>
              {event.xp > 0 ? (
                <Bit icon="star" label={`+${event.xp} XP`} color={colors.background} />
              ) : null}
              {event.gold > 0 ? (
                <Bit icon="coin" label={`+${event.gold} gold`} color={colors.background} />
              ) : null}
              {event.progress > 0 ? (
                <Bit
                  icon="plus"
                  label={`+${event.progress} target`}
                  color={colors.background}
                  bold
                />
              ) : null}
              {event.lootItem ? (
                <Bit
                  icon="gem"
                  label={`${event.lootItem.name} · ${RARITY_LABEL[event.lootItem.rarity]}`}
                  color={colors.background}
                  bold
                />
              ) : null}
              {event.duplicateGold > 0 ? (
                <Bit
                  icon="coin"
                  label={`+${event.duplicateGold} g duplicate`}
                  color={colors.background}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  toastWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    alignItems: 'center',
  },
  toast: {
    width: '100%',
    maxWidth: 460,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingTop: 10,
    paddingRight: 12,
    paddingBottom: 10,
    paddingLeft: 16,
  },
  toastText: { flex: 1, minWidth: 0 },
  dismiss: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissLabel: {
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    opacity: 0.72,
  },
  rewardWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    alignItems: 'center',
  },
  reward: {
    width: '100%',
    maxWidth: 460,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingTop: 12,
    paddingRight: 12,
    paddingBottom: 12,
    paddingLeft: 14,
  },
  seal: {
    width: 30,
    height: 30,
    flexShrink: 0,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardBody: { flex: 1, minWidth: 0, gap: 5 },
  rewardTitle: {
    fontFamily: fonts.display,
    fontSize: 15.2,
    lineHeight: 18,
  },
  bits: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 4,
    columnGap: 10,
    opacity: 0.92,
  },
  bit: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  bitText: {
    fontFamily: fonts.ui,
    fontSize: 11.5,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  bitBold: { fontFamily: fonts.uiBold },
})
