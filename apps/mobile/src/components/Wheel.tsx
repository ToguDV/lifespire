import { useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { WHEEL_SECTORS } from '@lifespire/core'
import type { WheelOutcome } from '@lifespire/core'
import {
  WHEEL_RECAP_DELAY_MS,
  WHEEL_SPIN_DURATION_MS,
  WHEEL_SPIN_TURNS,
  nextWheelRotation,
  sectorIndexAtRotation,
  wheelSectorDegrees,
} from '@lifespire/app-core/ui/wheel'
import { useTheme } from '../theme/ThemeProvider'
import { useReducedMotion } from '../theme/motion'
import { fonts, space } from '../theme/tokens'
import { playFeedback } from '../state/feedback'
import { Button } from './Button'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { Text } from './Text'
import {
  WHEEL_FRAME_SIZE,
  WHEEL_HUB_SIZE,
  WHEEL_ICON_SIZE,
  WHEEL_RING_WIDTH,
  WHEEL_SIZE,
  sectorIconPosition,
  sectorPath,
} from './wheelGeometry'

export type WheelPhase = 'idle' | 'spinning' | 'revealed'

export interface WheelResult {
  outcome: WheelOutcome
  taskTitle: string | null
  xp: number
  gold: number
  progress: number
}

const SECTOR_ICON: Record<WheelOutcome, IconName> = {
  task: 'scroll',
  gold: 'coin',
  xp: 'star',
  rest: 'campfire',
}

function outcomeLine(result: WheelResult): string {
  if (result.outcome === 'task') return `Task: ${result.taskTitle ?? 'a task'}`
  if (result.outcome === 'gold') return 'Gold'
  if (result.outcome === 'xp') return 'Experience'
  return 'Rest'
}

function rewardLine(result: WheelResult): string {
  if (result.outcome === 'task') {
    return `+${result.xp} XP · +${result.gold} gold${
      result.progress > 0 ? ' · +1 toward weekly target' : ''
    }`
  }
  if (result.outcome === 'gold') return `+${result.gold} gold`
  return `+${result.xp} XP`
}

/**
 * Wheel of outcomes: a 200x200 disc with a static hub and pointer. The spin is
 * only started by the player, runs for 9.1s with four turns and easeOutQuart,
 * then holds the settled outcome for the recap delay.
 */
export function Wheel({
  segmentIndex,
  result,
  onRecap,
  onPhaseChange,
}: {
  segmentIndex: number
  result: WheelResult
  onRecap: () => void
  onPhaseChange?: (phase: WheelPhase) => void
}) {
  const { colors } = useTheme()
  const reduced = useReducedMotion()
  const [phase, setPhase] = useState<WheelPhase>('idle')
  const [rotation] = useState(() => new Animated.Value(0))
  const [pointer] = useState(() => new Animated.Value(0))
  const [winner] = useState(() => new Animated.Value(0))
  const [card] = useState(() => new Animated.Value(0))
  const mounted = useRef(true)
  const started = useRef(false)
  const phaseRef = useRef<WheelPhase>('idle')
  const reducedRef = useRef(reduced)
  const listener = useRef<string | null>(null)
  const animationRef = useRef<Animated.CompositeAnimation | null>(null)
  const recapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onRecapRef = useRef(onRecap)
  const onPhaseChangeRef = useRef(onPhaseChange)
  const sectorDegrees = wheelSectorDegrees()

  useEffect(() => {
    reducedRef.current = reduced
  }, [reduced])

  useEffect(() => {
    onRecapRef.current = onRecap
  }, [onRecap])

  useEffect(() => {
    onPhaseChangeRef.current = onPhaseChange
  }, [onPhaseChange])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (recapTimer.current) clearTimeout(recapTimer.current)
      if (listener.current) {
        rotation.removeListener(listener.current)
        listener.current = null
      }
      animationRef.current?.stop()
      animationRef.current = null
    }
  }, [rotation])

  const changePhase = (next: WheelPhase) => {
    phaseRef.current = next
    setPhase(next)
    onPhaseChangeRef.current?.(next)
  }

  const flickPointer = () => {
    pointer.stopAnimation()
    pointer.setValue(0)
    Animated.sequence([
      Animated.timing(pointer, {
        toValue: 1,
        duration: 55,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(pointer, {
        toValue: 0,
        duration: 55,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start()
  }

  const spin = async () => {
    if (started.current || phaseRef.current !== 'idle') return
    started.current = true
    // Block "Skip this step" as soon as the player asks for a spin, before the
    // async native preference check below.
    onPhaseChangeRef.current?.('spinning')

    // Ask the OS at press time: the hook starts at false until the native
    // preference resolves, and a reduced-motion user must never see a frame of
    // the spin. As on web, they go straight to the recap.
    let shouldReduce = reducedRef.current
    try {
      shouldReduce = await AccessibilityInfo.isReduceMotionEnabled()
    } catch {
      // Keep the hook value when the platform cannot answer.
    }
    if (!mounted.current) return
    if (shouldReduce) {
      onRecapRef.current()
      return
    }

    changePhase('spinning')
    AccessibilityInfo.announceForAccessibility('Spinning…')

    const target = nextWheelRotation(0, segmentIndex, WHEEL_SPIN_TURNS, sectorDegrees)
    let lastSector = sectorIndexAtRotation(0, sectorDegrees)
    rotation.setValue(0)
    pointer.setValue(0)
    winner.setValue(0)
    card.setValue(0)

    let crossings = 0
    listener.current = rotation.addListener(({ value }) => {
      const sector = sectorIndexAtRotation(value, sectorDegrees)
      if (sector === lastSector) return
      lastSector = sector
      crossings += 1
      // One tick every two sectors: 40 impacts in nine seconds is too busy for
      // a haptic channel (web uses a soft audio tick for every crossing).
      if (crossings % 2 === 0) playFeedback('wheelTick')
      flickPointer()
    })

    const animation = Animated.timing(rotation, {
      toValue: target,
      duration: WHEEL_SPIN_DURATION_MS,
      easing: Easing.out(Easing.poly(4)),
      useNativeDriver: true,
    })
    animationRef.current = animation
    animation.start(({ finished }) => {
      if (listener.current) {
        rotation.removeListener(listener.current)
        listener.current = null
      }
      animationRef.current = null
      if (!finished || !mounted.current) return

      changePhase('revealed')
      playFeedback('wheelReveal')
      // Single announcement for the settled outcome: the result card below is
      // focusable with the same label plus a polite live region, so it
      // announces once on appearance. The manual announceForAccessibility call
      // that used to sit here double-announced with the card focus.

      if (!reducedRef.current) {
        Animated.parallel([
          Animated.timing(winner, {
            toValue: 1,
            duration: 650,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(card, {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start()
      } else {
        card.setValue(1)
      }

      recapTimer.current = setTimeout(() => {
        recapTimer.current = null
        onRecapRef.current()
      }, WHEEL_RECAP_DELAY_MS)
    })
  }

  const revealed = phase === 'revealed'
  const sectorColor: Record<WheelOutcome, string> = {
    task: colors.wheelTask,
    gold: colors.wheelGold,
    xp: colors.wheelXp,
    rest: colors.wheelRest,
  }
  const rotate = rotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  })
  const pointerRotate = pointer.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-18deg'],
  })
  const winnerOpacity = winner.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0.6, 0],
  })
  const winnerScale = winner.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  })
  const cardOpacity = card.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  })
  const cardScale = card.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  })

  return (
    <View style={styles.container}>
      <View style={styles.stage}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.winnerGlow,
            {
              borderColor: colors.wheelIcon,
              opacity: winnerOpacity,
              transform: [{ scale: winnerScale }],
            },
          ]}
        />
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel="Wheel of outcomes"
          style={[
            styles.frame,
            shadows,
            {
              borderColor: colors.hairlineStrong,
              backgroundColor: colors.surfaceRaised,
            },
          ]}
        >
          <Animated.View
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={[styles.disc, { transform: [{ rotate }] }]}
          >
            <Svg
              accessible={false}
              width={WHEEL_SIZE}
              height={WHEEL_SIZE}
              viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}
            >
              {WHEEL_SECTORS.map((outcome, index) => {
                const isWinner = revealed && index === segmentIndex
                return (
                  <Path
                    key={`sector-${index}`}
                    d={sectorPath(index, sectorDegrees)}
                    fill={sectorColor[outcome]}
                    opacity={revealed && !isWinner ? 0.45 : 1}
                    stroke={isWinner ? colors.wheelIcon : colors.wheelStroke}
                    strokeWidth={isWinner ? 2 : 1}
                  />
                )
              })}
            </Svg>
            {WHEEL_SECTORS.map((outcome, index) => {
              const position = sectorIconPosition(index, sectorDegrees)
              return (
                <View
                  key={`icon-${index}`}
                  pointerEvents="none"
                  style={[
                    styles.sectorIcon,
                    {
                      left: position.x - WHEEL_ICON_SIZE / 2,
                      top: position.y - WHEEL_ICON_SIZE / 2,
                    },
                  ]}
                >
                  <Icon
                    name={SECTOR_ICON[outcome]}
                    size={WHEEL_ICON_SIZE}
                    color={colors.wheelIcon}
                  />
                </View>
              )
            })}
          </Animated.View>

          <View
            pointerEvents="none"
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={styles.hubLayer}
          >
            <View
              style={[
                styles.hub,
                {
                  backgroundColor: revealed
                    ? sectorColor[result.outcome]
                    : colors.wheelTask,
                  borderColor: colors.wheelStroke,
                },
              ]}
            >
              {revealed ? (
                <Icon
                  name={SECTOR_ICON[result.outcome]}
                  size={22}
                  color={colors.wheelIcon}
                />
              ) : (
                <RNText
                  allowFontScaling={false}
                  style={[styles.hubText, { color: colors.wheelIcon }]}
                >
                  ?
                </RNText>
              )}
            </View>
          </View>
        </View>

        <Animated.View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[styles.pointer, { transform: [{ rotate: pointerRotate }] }]}
        >
          <View style={styles.pointerShadow} />
          <View style={[styles.pointerTip, { borderTopColor: colors.wheelIcon }]} />
        </Animated.View>
      </View>

      {phase === 'idle' ? (
        <Button icon="wheel" onPress={() => void spin()} full>
          Spin the wheel
        </Button>
      ) : null}

      {phase === 'spinning' ? (
        <Text variant="bodyMd" tone="muted" accessibilityLabel="Spinning…">
          Spinning…
        </Text>
      ) : null}

      {revealed ? (
        <Animated.View
          accessible
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${outcomeLine(result)}. ${rewardLine(result)}`}
          style={[
            styles.result,
            {
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.hairlineStrong,
              opacity: cardOpacity,
              transform: [{ scale: cardScale }],
            },
          ]}
        >
          <Text variant="headingMd" style={{ color: colors.inkStrong }}>
            {outcomeLine(result)}
          </Text>
          <Text variant="bodyMd" style={{ color: colors.ink }}>
            {rewardLine(result)}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  )
}

const shadows = {
  shadowColor: '#000000',
  shadowOpacity: 0.35,
  shadowRadius: 30,
  shadowOffset: { width: 0, height: 12 },
  elevation: 10,
} as const

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  stage: { width: WHEEL_FRAME_SIZE, height: WHEEL_FRAME_SIZE },
  frame: {
    width: WHEEL_FRAME_SIZE,
    height: WHEEL_FRAME_SIZE,
    borderRadius: WHEEL_FRAME_SIZE / 2,
    borderWidth: WHEEL_RING_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  winnerGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: WHEEL_FRAME_SIZE,
    height: WHEEL_FRAME_SIZE,
    borderRadius: WHEEL_FRAME_SIZE / 2,
    borderWidth: 2,
    zIndex: 2,
  },
  disc: { width: WHEEL_SIZE, height: WHEEL_SIZE },
  sectorIcon: { position: 'absolute', width: WHEEL_ICON_SIZE, height: WHEEL_ICON_SIZE },
  hubLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hub: {
    width: WHEEL_HUB_SIZE,
    height: WHEEL_HUB_SIZE,
    borderRadius: WHEEL_HUB_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubText: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 26,
  },
  pointer: {
    position: 'absolute',
    top: -2,
    left: (WHEEL_FRAME_SIZE - 20) / 2,
    width: 20,
    height: 18,
    zIndex: 3,
    // Honored by RN 0.88 on Android (processTransformOrigin /
    // BaseViewConfig): the flick pivots around the top-center hinge, so no
    // manual translate compensation is needed.
    transformOrigin: '50% 0%',
  },
  pointerShadow: {
    position: 'absolute',
    top: 2,
    left: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 18,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(0, 0, 0, 0.4)',
  },
  pointerTip: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 18,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  result: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: space.xs,
    padding: space.sm,
    borderWidth: 1,
    borderRadius: 12,
  },
})
