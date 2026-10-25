import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'
import type { ScrollViewInstance } from 'react-native'
import Svg, { Circle, Defs, G, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg'
import type { Day, GameMap, Goal, MapNode, Run } from '@lifespire/core'
import { nodeProgress, nodeStatus } from '@lifespire/core'
import type { NodeStatus } from '@lifespire/core'
import {
  buildMapLayout,
  classifyMapEdges,
  mapScrollTarget,
} from '@lifespire/app-core/ui/mapLayout'
import type { MapLabelSide, MapNodeLayout } from '@lifespire/app-core/ui/mapLayout'
import { NODE_TYPE_ICON, goalIconFor, romanDay } from '@lifespire/app-core/ui/format'
import { nodeAriaLabel, nodeTitle } from '@lifespire/app-core/ui/nodeCopy'
import { playFeedback } from '../state/feedback'
import { useTheme } from '../theme/ThemeProvider'
import { useReducedMotion } from '../theme/motion'
import { useScreenReader } from '../lib/useScreenReader'
import { fonts, layout as layoutTokens, radius, shadows } from '../theme/tokens'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { Text } from './Text'

const NODE_TARGET = 54
const NODE_SIZE = 45
const NODE_SIZE_DENSE = 40
const NODE_AVAILABLE = 50
const NODE_AVAILABLE_DENSE = 44
const BOSS_WIDTH = 76
const BOSS_HEIGHT = 82
const LABEL_MAX_WIDTH = 78
const LABEL_MAX_WIDTH_DENSE = 64
const BOSS_LABEL_MAX_WIDTH = 124
const LABEL_LINE_HEIGHT = 14

/**
 * Hand-tuned contour silhouettes, ported from the web map. Each decision layer
 * gets its own line; the camp and boss have theirs. Pure decoration.
 */
const LAYER_CONTOURS = [
  'M-30 0c100-26 150 32 245 4s150-62 245-38 90 22 120 8',
  'M-20 0c92-22 140 34 232 8s148-56 238-36 92 14 130-2',
  'M-30 0c96-24 150 34 244 8s150-54 240-34 90 10 120-4',
  'M-20 0c88-22 142 32 234 8s150-52 238-32 92 8 128-4',
]
const CAMP_CONTOUR = 'M-30 0c104-18 162 24 268 4s180-24 352-12'
const BOSS_CONTOUR = 'M-30 0c112-16 166 22 270 4s190-20 350-10'
const DECOR_PATH = 'M84 520c8-4 16-4 24 0M448 300c8-4 16-4 24 0M92 156c8-4 16-4 24 0'
/** Camp y of the classic four-layer canvas, anchoring the small decorations. */
const DECOR_BASE_Y = 660
const BOSS_POINTS = '42,2 80,23 80,67 42,88 4,67 4,23'

function nodeIcon(node: MapNode, goals: Goal[]): IconName {
  if (node.task) return goalIconFor(goals, node.task.goalId) ?? 'banner'
  return NODE_TYPE_ICON[node.type]
}

function medallionSize(status: NodeStatus, dense: boolean): number {
  if (status === 'available' || status === 'current') {
    return dense ? NODE_AVAILABLE_DENSE : NODE_AVAILABLE
  }
  return dense ? NODE_SIZE_DENSE : NODE_SIZE
}

export function MapCanvas({
  map,
  day,
  goals,
  run,
  onSelect,
}: {
  map: GameMap
  day: Day
  goals: Goal[]
  run: Run
  onSelect: (nodeId: string) => void
}) {
  const { colors } = useTheme()
  const { width } = useWindowDimensions()
  const reduced = useReducedMotion()
  const screenReader = useScreenReader()
  const [revealed, setRevealed] = useState<string | null>(null)
  const scrollRef = useRef<ScrollViewInstance>(null)
  const scrolledRef = useRef(false)
  const layout = useMemo(() => buildMapLayout(map), [map])
  const edges = useMemo(() => classifyMapEdges(layout, map, day), [layout, map, day])
  // Screen padding (16 each side) plus the 8px scroll gutter inside the frame.
  const canvasWidth = Math.min(width - layoutTokens.screenPadding * 2 - 16, 560)
  const scale = canvasWidth / layout.width
  const canvasHeight = layout.height * scale

  const allNodes = useMemo(() => [...layout.layers.flat(), layout.boss], [layout])
  const targetId = mapScrollTarget(map, day)
  const resolvedCount = day.path.length
  const lastEntry = day.path[day.path.length - 1]
  const lastResolvedId = lastEntry?.nodeId ?? null
  const bossStatus = nodeStatus(map, day, layout.boss.id)
  const bossOpen = bossStatus === 'available' || bossStatus === 'current'
  const prevBossOpen = useRef(bossOpen)

  useEffect(() => {
    if (bossOpen && !prevBossOpen.current) playFeedback('bossUnlock')
    prevBossOpen.current = bossOpen
  }, [bossOpen])

  useEffect(() => {
    if (scrolledRef.current) return
    const target = targetId === 'start' ? layout.start : allNodes.find((node) => node.id === targetId)
    if (!target) return
    const viewport = Math.max(360, Math.min(canvasHeight, 620))
    const y = (target.top / 100) * canvasHeight
    const timer = setTimeout(() => {
      // Only mark the map centred once the scroll actually runs; an early
      // cleanup (rotation, settled width) must leave the next attempt free.
      scrolledRef.current = true
      scrollRef.current?.scrollTo({ y: Math.max(0, y - viewport * 0.55), animated: false })
    }, 80)
    return () => clearTimeout(timer)
  }, [allNodes, targetId, canvasHeight, layout.start])

  const toX = (leftPercent: number) => (leftPercent / 100) * canvasWidth
  const toY = (topPercent: number) => (topPercent / 100) * canvasHeight
  const groupLabel = `Day map. Camp at the bottom, ${layout.layers.length} layers above, and the boss at the top.`

  return (
    <View
      style={[styles.frame, { backgroundColor: colors.surface, borderColor: colors.hairline, ...shadows.soft }]}
    >
      <Text accessible accessibilityRole="text" accessibilityLabel={groupLabel} style={styles.hiddenLabel}>
        {groupLabel}
      </Text>
      <View style={styles.meta} pointerEvents="none">
        <Text variant="micro" tone="soft">
          THE ASCENT · {resolvedCount} OF {map.layers.length + 1} RESOLVED
        </Text>
        <Text style={[styles.metaDay, { color: colors.inkSoft }]}>Day {romanDay(day.index)}</Text>
      </View>
      <View style={[styles.inset, { borderColor: colors.hairline }]} pointerEvents="none" />

      <ScrollView
        ref={scrollRef}
        nestedScrollEnabled
        style={[styles.scroll, { maxHeight: Math.max(360, canvasHeight > 620 ? 620 : canvasHeight) }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: canvasWidth, height: canvasHeight }}>
          <Svg width={canvasWidth} height={canvasHeight} viewBox={`0 0 ${layout.width} ${layout.height}`}>
            <Defs>
              <RadialGradient id="mapWash" cx="50%" cy="8%" r="90%">
                <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.075} />
                <Stop offset="60%" stopColor={colors.accent} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width={layout.width} height={layout.height} fill="url(#mapWash)" />
            <G stroke={colors.hairline} strokeWidth={1} opacity={0.75} fill="none">
              {layout.layers.map((layer, index) => (
                <Path
                  key={layer[0]?.id ?? index}
                  d={LAYER_CONTOURS[index % LAYER_CONTOURS.length]}
                  transform={`translate(0 ${layer[0]?.y ?? 0})`}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <Path
                d={CAMP_CONTOUR}
                transform={`translate(0 ${layout.start.y + 4})`}
                vectorEffect="non-scaling-stroke"
              />
              <Path
                d={BOSS_CONTOUR}
                transform={`translate(0 ${layout.boss.y})`}
                vectorEffect="non-scaling-stroke"
              />
            </G>
            <G stroke={colors.hairline} strokeWidth={1} opacity={0.55} fill="none">
              <Path
                d={DECOR_PATH}
                transform={`translate(0 ${layout.start.y - DECOR_BASE_Y})`}
                vectorEffect="non-scaling-stroke"
              />
            </G>
            {bossOpen ? (
              <Circle
                cx={layout.boss.x}
                cy={layout.boss.y}
                r={56}
                fill={colors.accentWash}
                stroke={colors.hairline}
                strokeWidth={1}
                strokeDasharray="2 7"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            {edges.map((edge) => (
              <Path
                key={edge.id}
                d={edge.d}
                fill="none"
                stroke={
                  edge.tone === 'done'
                    ? colors.ink
                    : edge.tone === 'open'
                      ? colors.accent
                      : colors.hairlineStrong
                }
                strokeWidth={edge.tone === 'done' ? 1.7 : 1.5}
                strokeLinecap="round"
                strokeDasharray={edge.tone === 'open' ? '3 7' : edge.tone === 'veiled' ? '1 8' : undefined}
                opacity={edge.tone === 'done' ? 0.78 : 1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </Svg>

          <CampMark x={toX(layout.start.left) - 22} y={toY(layout.start.top) - 19} />

          {allNodes.map((nodeLayout) => (
            <MapNodeView
              key={nodeLayout.id}
              nodeLayout={nodeLayout}
              map={map}
              day={day}
              run={run}
              goals={goals}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              reduced={reduced}
              screenReader={screenReader}
              revealed={revealed === nodeLayout.id}
              justDone={
                nodeLayout.id === lastResolvedId &&
                nodeStatus(map, day, nodeLayout.id) === 'completed'
              }
              onReveal={() => setRevealed(nodeLayout.id)}
              onSelect={() => {
                setRevealed(null)
                onSelect(nodeLayout.id)
              }}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.compass} pointerEvents="none">
        <Icon name="compass" size={26} color={colors.inkSoft} />
      </View>
    </View>
  )
}

function CampMark({ x, y }: { x: number; y: number }) {
  const { colors } = useTheme()
  return (
    <View style={[styles.campWrap, { left: x, top: y }]} pointerEvents="none">
      <View
        style={[styles.camp, { backgroundColor: colors.surface, borderColor: colors.hairlineStrong }]}
        accessibilityRole="image"
        accessibilityLabel="Camp, start of the day"
      >
        <Icon name="tent" size={18} color={colors.inkMuted} />
      </View>
      <Text variant="micro" tone="soft" style={styles.campLabel}>
        CAMP
      </Text>
    </View>
  )
}

function MapNodeView({
  nodeLayout,
  map,
  day,
  run,
  goals,
  canvasWidth,
  canvasHeight,
  reduced,
  screenReader,
  revealed,
  justDone,
  onReveal,
  onSelect,
}: {
  nodeLayout: MapNodeLayout
  map: GameMap
  day: Day
  run: Run
  goals: Goal[]
  canvasWidth: number
  canvasHeight: number
  reduced: boolean
  screenReader: boolean
  revealed: boolean
  justDone: boolean
  onReveal: () => void
  onSelect: () => void
}) {
  const { colors } = useTheme()
  const status = nodeStatus(map, day, nodeLayout.id)
  const isBoss = nodeLayout.type === 'boss'
  const selectable = status === 'available' || status === 'current'
  const showLabel = revealed && (selectable || isBoss)
  // Web only shrinks the medallion on five-node layers; the label cap tightens
  // from three nodes. Keep them separate so four-node lanes match web.
  const wide = nodeLayout.layerSize >= 5
  const denseLabel = nodeLayout.layerSize >= 3
  const icon = nodeIcon(nodeLayout.node, goals)
  const goalCrest = nodeLayout.node.task ? goalIconFor(goals, nodeLayout.node.task.goalId) : null
  const label = nodeTitle(nodeLayout.node)
  const progress = nodeProgress(run, nodeLayout.node)
  const ariaLabel = nodeAriaLabel(nodeLayout.node, status, progress)
  const cx = (nodeLayout.left / 100) * canvasWidth
  const cy = (nodeLayout.top / 100) * canvasHeight
  const [stamp] = useState(() => new Animated.Value(1))
  const [checkPop] = useState(() => new Animated.Value(1))

  useEffect(() => {
    if (!justDone) return
    if (reduced) {
      stamp.setValue(1)
      checkPop.setValue(1)
      return
    }
    stamp.setValue(0.82)
    checkPop.setValue(0)
    const animation = Animated.parallel([
      Animated.timing(stamp, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.timing(checkPop, { toValue: 1, duration: 260, useNativeDriver: true }),
    ])
    animation.start()
    return () => animation.stop()
  }, [justDone, reduced, stamp, checkPop])

  const press = () => {
    if (!selectable) return
    // TalkBack activates a node once: the accessible name already announces the
    // step, so skip the visual-only first-tap reveal.
    if (!revealed && !screenReader) {
      onReveal()
      return
    }
    onSelect()
  }

  const checkScale = checkPop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] })

  if (isBoss) {
    return (
      <View style={[styles.bossWrap, { left: cx - BOSS_WIDTH / 2, top: cy - BOSS_HEIGHT / 2 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ariaLabel}
          accessibilityState={{ selected: status === 'current', disabled: !selectable }}
          disabled={!selectable}
          onPress={press}
          android_ripple={selectable ? { color: colors.accentWash, borderless: true } : undefined}
          style={({ pressed }) => [styles.bossButton, { opacity: pressed && selectable ? 0.82 : 1 }]}
        >
          <Animated.View
            style={[styles.bossInner, justDone ? { transform: [{ scale: stamp }] } : null]}
          >
            <Svg width={BOSS_WIDTH} height={BOSS_HEIGHT} viewBox="0 0 84 90">
              <Polygon
                points={BOSS_POINTS}
                fill={
                  status === 'completed'
                    ? colors.doneFill
                    : bossOpenFill(status)
                      ? colors.accentSoft
                      : colors.surfaceRaised
                }
                stroke={
                  status === 'completed'
                    ? colors.doneRim
                    : bossOpenFill(status)
                      ? colors.accent
                      : colors.hairlineStrong
                }
                strokeWidth={1.2}
                strokeDasharray={bossOpenFill(status) || status === 'completed' ? undefined : '3 5'}
                vectorEffect="non-scaling-stroke"
              />
            </Svg>
            <View style={styles.bossIcon}>
              <Icon
                name={icon}
                size={24}
                color={
                  status === 'completed'
                    ? colors.doneInk
                    : bossOpenFill(status)
                      ? colors.accentDeep
                      : colors.inkSoft
                }
              />
            </View>
            {status === 'completed' ? (
              <Animated.View
                style={[
                  styles.seal,
                  styles.sealBottom,
                  { backgroundColor: colors.accent, borderColor: colors.surface },
                  justDone ? { opacity: checkPop, transform: [{ scale: checkScale }] } : null,
                ]}
              >
                <Icon name="check" size={9} color={colors.onAccent} />
              </Animated.View>
            ) : null}
          </Animated.View>
        </Pressable>
        {showLabel ? (
          <View
            style={styles.labelAbove}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text style={[styles.labelBoss, { color: selectable ? colors.inkStrong : colors.ink }]} numberOfLines={2}>
              {label}
            </Text>
          </View>
        ) : null}
      </View>
    )
  }

  const size = medallionSize(status, wide)
  const iconSize = wide ? 19 : 21
  const eliteMark =
    nodeLayout.type === 'elite' && goalCrest ? (
      <View style={[styles.seal, styles.sealTop, { backgroundColor: colors.surfaceRaised, borderColor: colors.surface }]}>
        <Icon name="elite" size={9} color={colors.accentDeep} />
      </View>
    ) : null
  const medallion =
    status === 'completed' ? (
      <View style={[styles.medallion, { width: size, height: size, backgroundColor: colors.doneFill, borderColor: colors.doneRim }]}>
        <Icon name={icon} size={iconSize} color={colors.doneInk} />
        {eliteMark}
        <Animated.View
          style={[
            styles.seal,
            styles.sealBottom,
            { backgroundColor: colors.accent, borderColor: colors.surface },
            justDone ? { opacity: checkPop, transform: [{ scale: checkScale }] } : null,
          ]}
        >
          <Icon name="check" size={9} color={colors.onAccent} />
        </Animated.View>
      </View>
    ) : status === 'skipped' ? (
      <View style={[styles.medallion, styles.medallionDashed, { width: size, height: size, backgroundColor: colors.surfaceSunken, borderColor: colors.hairlineStrong }]}>
        <Icon name={icon} size={iconSize} color={colors.inkSoft} />
        {eliteMark}
        <View style={[styles.seal, styles.sealBottom, { backgroundColor: colors.surfaceRaised, borderColor: colors.surface }]}>
          <Text style={[styles.skipGlyph, { color: colors.inkSoft }]}>–</Text>
        </View>
      </View>
    ) : status === 'locked' ? (
      <View style={[styles.medallion, styles.medallionDashed, styles.medallionFaded, { width: size, height: size, borderColor: colors.hairlineStrong }]}>
        <Icon name={icon} size={iconSize} color={colors.inkSoft} />
        {eliteMark}
      </View>
    ) : (
      <Halo current={status === 'current'} size={size}>
        <View style={[styles.medallion, { width: size, height: size, backgroundColor: colors.surfaceRaised, borderColor: colors.accent }]}>
          <Icon name={icon} size={iconSize} color={colors.accentDeep} />
          {eliteMark}
        </View>
      </Halo>
    )

  return (
    <View style={[styles.nodeWrap, { left: cx - NODE_TARGET / 2, top: cy - NODE_TARGET / 2 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ariaLabel}
        accessibilityState={{ selected: status === 'current', disabled: !selectable }}
        disabled={!selectable}
        onPress={press}
        android_ripple={selectable ? { color: colors.accentWash, borderless: true } : undefined}
        style={({ pressed }) => [styles.nodeButton, { opacity: pressed && selectable ? 0.78 : 1 }]}
      >
        <Animated.View style={justDone ? { transform: [{ scale: stamp }] } : undefined}>{medallion}</Animated.View>
      </Pressable>
      {showLabel ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <NodeLabel
            text={label}
            side={nodeLayout.labelSide}
            size={size}
            dense={denseLabel}
            cx={cx}
            canvasWidth={canvasWidth}
            strong={selectable}
          />
        </View>
      ) : null}
    </View>
  )
}

function bossOpenFill(status: NodeStatus): boolean {
  return status === 'available' || status === 'current'
}

/** Wash halo plus the outer moss ring. The current node gets a stronger ring. */
function Halo({ current, size, children }: { current: boolean; size: number; children: ReactNode }) {
  const { colors } = useTheme()
  const ring = size + (current ? 14 : 10)
  return (
    <View style={{ width: size + 12, height: size + 12, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: size + 8,
          height: size + 8,
          borderRadius: radius.full,
          backgroundColor: colors.accentSoft,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: ring,
          height: ring,
          borderRadius: radius.full,
          borderWidth: current ? 2 : 1,
          borderColor: colors.accent,
          opacity: current ? 1 : 0.28,
        }}
      />
      {children}
    </View>
  )
}

function NodeLabel({
  text,
  side,
  size,
  dense,
  cx,
  canvasWidth,
  strong,
}: {
  text: string
  side: MapLabelSide
  size: number
  dense: boolean
  cx: number
  canvasWidth: number
  strong: boolean
}) {
  const { colors } = useTheme()
  const color = strong ? colors.inkStrong : colors.ink
  const center = NODE_TARGET / 2
  const maxLabel = dense ? LABEL_MAX_WIDTH_DENSE : LABEL_MAX_WIDTH
  if (side === 'below') {
    return (
      <View
        style={[styles.labelBelow, { left: center, top: center + size / 2 + 5, width: maxLabel }]}
        pointerEvents="none"
      >
        <Text style={[styles.labelText, { color }]} numberOfLines={2}>
          {text}
        </Text>
      </View>
    )
  }
  const maxWidth = Math.min(
    maxLabel,
    side === 'left' ? cx - size / 2 - 7 - 6 : canvasWidth - (cx + size / 2 + 7) - 6,
  )
  if (maxWidth < 48) {
    return (
      <View
        style={[styles.labelBelow, { left: center, top: center + size / 2 + 5, width: maxLabel }]}
        pointerEvents="none"
      >
        <Text style={[styles.labelText, { color }]} numberOfLines={2}>
          {text}
        </Text>
      </View>
    )
  }
  return (
    <View
      style={[
        side === 'left' ? styles.labelLeft : styles.labelRight,
        {
          top: center,
          width: maxWidth,
          ...(side === 'left' ? { right: center + size / 2 + 7 } : { left: center + size / 2 + 7 }),
        },
      ]}
      pointerEvents="none"
    >
      <Text
        style={[styles.labelText, side === 'left' ? styles.labelTextRight : styles.labelTextLeft, { color }]}
        numberOfLines={2}
      >
        {text}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: {
    position: 'relative',
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  hiddenLabel: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  meta: {
    position: 'absolute',
    top: 15,
    left: 18,
    right: 18,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaDay: {
    fontFamily: fonts.displayItalic,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  inset: {
    position: 'absolute',
    top: 7,
    left: 7,
    right: 7,
    bottom: 7,
    zIndex: 1,
    borderWidth: 1,
    borderRadius: 12,
    opacity: 0.45,
  },
  scroll: { width: '100%', zIndex: 2 },
  scrollContent: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 8 },
  compass: { position: 'absolute', right: 18, bottom: 16, zIndex: 3, opacity: 0.5 },
  campWrap: {
    position: 'absolute',
    width: 44,
    alignItems: 'center',
    overflow: 'visible',
  },
  camp: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  campLabel: { marginTop: 2 },
  nodeWrap: {
    position: 'absolute',
    width: NODE_TARGET,
    height: NODE_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  nodeButton: {
    width: NODE_TARGET,
    height: NODE_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallion: {
    borderWidth: 1,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallionDashed: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  medallionFaded: { opacity: 0.52 },
  seal: {
    position: 'absolute',
    width: 15,
    height: 15,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealTop: { top: -2, right: -2 },
  sealBottom: { right: -1, bottom: -1 },
  skipGlyph: { fontFamily: fonts.uiBold, fontSize: 11, lineHeight: 12 },
  bossWrap: { position: 'absolute', width: BOSS_WIDTH, overflow: 'visible' },
  bossButton: { width: BOSS_WIDTH, height: BOSS_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  bossInner: {
    width: BOSS_WIDTH,
    height: BOSS_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bossIcon: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  labelBelow: {
    position: 'absolute',
    transform: [{ translateX: '-50%' }],
    alignItems: 'center',
    overflow: 'visible',
  },
  labelLeft: {
    position: 'absolute',
    transform: [{ translateY: '-50%' }],
    alignItems: 'flex-end',
  },
  labelRight: {
    position: 'absolute',
    transform: [{ translateY: '-50%' }],
    alignItems: 'flex-start',
  },
  labelAbove: {
    position: 'absolute',
    left: BOSS_WIDTH / 2,
    top: -4,
    width: BOSS_LABEL_MAX_WIDTH,
    transform: [{ translateX: '-50%' }, { translateY: '-100%' }],
    alignItems: 'center',
  },
  labelText: {
    fontFamily: fonts.display,
    fontSize: 12,
    lineHeight: LABEL_LINE_HEIGHT,
    textAlign: 'center',
  },
  labelTextLeft: { textAlign: 'left' },
  labelTextRight: { textAlign: 'right' },
  labelBoss: {
    fontFamily: fonts.display,
    fontSize: 14,
    lineHeight: 16,
    textAlign: 'center',
  },
})
