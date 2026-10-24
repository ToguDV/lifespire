import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import type { ScrollViewInstance } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import type { Day, GameMap, Goal, MapNode } from '@lifespire/core'
import { nodeStatus } from '@lifespire/core'
import {
  buildMapLayout,
  classifyMapEdges,
  mapScrollTarget,
} from '@lifespire/app-core/ui/mapLayout'
import { NODE_TYPE_ICON, goalIconFor } from '@lifespire/app-core/ui/format'
import { useTheme } from '../theme/ThemeProvider'
import { layout as layoutTokens, radius, space } from '../theme/tokens'
import { Icon } from './Icon'
import { Text } from './Text'

const NODE_SIZE = 46
const BOSS_SIZE = 58

function statusColors(
  status: ReturnType<typeof nodeStatus>,
  colors: ReturnType<typeof useTheme>['colors'],
): { fill: string; border: string; ink: string } {
  switch (status) {
    case 'completed':
      return { fill: colors.ink, border: colors.ink, ink: colors.onAccent }
    case 'skipped':
      return { fill: colors.surfaceSunken, border: colors.hairlineStrong, ink: colors.inkSoft }
    case 'current':
      return { fill: colors.accentSoft, border: colors.accent, ink: colors.accentDeep }
    case 'available':
      return { fill: colors.surfaceRaised, border: colors.accent, ink: colors.ink }
    default:
      return { fill: colors.surfaceSunken, border: colors.hairline, ink: colors.inkSoft }
  }
}

function nodeIcon(node: MapNode, goals: Goal[]) {
  if (node.task) return goalIconFor(goals, node.task.goalId) ?? 'banner'
  return NODE_TYPE_ICON[node.type]
}

export function MapCanvas({
  map,
  day,
  goals,
  onSelect,
}: {
  map: GameMap
  day: Day
  goals: Goal[]
  onSelect: (nodeId: string) => void
}) {
  const { colors } = useTheme()
  const { width } = useWindowDimensions()
  const [revealed, setRevealed] = useState<string | null>(null)
  const scrollRef = useRef<ScrollViewInstance>(null)
  const scrolledRef = useRef(false)
  const layout = useMemo(() => buildMapLayout(map), [map])
  const edges = useMemo(() => classifyMapEdges(layout, map, day), [layout, map, day])
  const canvasWidth = Math.min(width - layoutTokens.screenPadding * 2, 560)
  const scale = canvasWidth / layout.width
  const canvasHeight = layout.height * scale

  const allNodes = useMemo(() => [...layout.layers.flat(), layout.boss], [layout])
  const targetId = mapScrollTarget(map, day)

  useEffect(() => {
    if (scrolledRef.current) return
    const target = targetId === 'start' ? layout.start : allNodes.find((node) => node.id === targetId)
    if (!target) return
    scrolledRef.current = true
    const viewport = Math.max(360, Math.min(canvasHeight, 620))
    const y = (target.top / 100) * canvasHeight
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - viewport * 0.55), animated: false })
    }, 80)
    return () => clearTimeout(timer)
  }, [allNodes, targetId, canvasHeight, layout.start])

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.scroll, { maxHeight: Math.max(360, canvasHeight > 620 ? 620 : canvasHeight) }]}
      contentContainerStyle={{ height: canvasHeight + space.xl }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ width: canvasWidth, height: canvasHeight }}>
        <Svg width={canvasWidth} height={canvasHeight} viewBox={`0 0 ${layout.width} ${layout.height}`}>
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
                    : colors.hairline
              }
              strokeWidth={edge.tone === 'veiled' ? 1.4 : 2.2}
              strokeDasharray={edge.tone === 'veiled' ? '4 6' : undefined}
              opacity={edge.tone === 'veiled' ? 0.7 : 1}
            />
          ))}
        </Svg>

        <View
          style={[
            styles.camp,
            {
              left: (layout.start.left / 100) * canvasWidth - 22,
              top: (layout.start.top / 100) * canvasHeight - 22,
              backgroundColor: colors.surface,
              borderColor: colors.hairlineStrong,
            },
          ]}
        >
          <Icon name="tent" size={18} color={colors.inkMuted} />
        </View>

        {allNodes.map((nodeLayout) => {
          const status = nodeStatus(map, day, nodeLayout.id)
          const palette = statusColors(status, colors)
          const isBoss = nodeLayout.type === 'boss'
          const size = isBoss ? BOSS_SIZE : NODE_SIZE
          const icon = status === 'locked' ? 'lock' : nodeIcon(nodeLayout.node, goals)
          const selectable = status === 'available' || status === 'current'
          const label =
            nodeLayout.node.task?.title ??
            (nodeLayout.type === 'boss'
              ? 'Daily boss'
              : nodeLayout.type === 'rest'
                ? 'Rest'
                : nodeLayout.type === 'treasure'
                  ? 'Treasure'
                  : 'Wheel')
          const showLabel = revealed === nodeLayout.id || status === 'current'
          return (
            <View
              key={nodeLayout.id}
              style={[
                styles.nodeWrap,
                {
                  left: (nodeLayout.left / 100) * canvasWidth - size / 2,
                  top: (nodeLayout.top / 100) * canvasHeight - size / 2,
                  width: size,
                },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${label}, ${status}`}
                accessibilityState={{ selected: status === 'current', disabled: !selectable }}
                onPress={() => {
                  if (!selectable) return
                  if (!showLabel) {
                    setRevealed(nodeLayout.id)
                    return
                  }
                  onSelect(nodeLayout.id)
                }}
                android_ripple={{ color: colors.accentWash, borderless: true }}
                style={({ pressed }) => [
                  styles.node,
                  {
                    width: size,
                    height: size,
                    borderRadius: isBoss ? radius.lg : radius.full,
                    backgroundColor: palette.fill,
                    borderColor: palette.border,
                    opacity: pressed ? 0.78 : 1,
                    transform: isBoss ? [{ rotate: '45deg' }] : undefined,
                  },
                ]}
              >
                <View style={isBoss ? { transform: [{ rotate: '-45deg' }] } : undefined}>
                  <Icon
                    name={status === 'completed' ? 'check' : icon}
                    size={isBoss ? 22 : 18}
                    color={palette.ink}
                  />
                </View>
              </Pressable>
              {showLabel ? (
                <View
                  style={[
                    styles.label,
                    {
                      backgroundColor: colors.surfaceRaised,
                      borderColor: colors.hairline,
                    },
                  ]}
                >
                  <Text variant="caption" numberOfLines={2} style={styles.labelText}>
                    {label}
                  </Text>
                </View>
              ) : null}
            </View>
          )
        })}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { width: '100%' },
  camp: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeWrap: { position: 'absolute', alignItems: 'center' },
  node: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: space.xs,
    maxWidth: 132,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space.xs,
    paddingVertical: 2,
  },
  labelText: { textAlign: 'center' },
})
