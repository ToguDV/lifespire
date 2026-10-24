import { StyleSheet, View } from 'react-native'
import { currentDay, xpIntoLevel, xpToNextLevel } from '@lifespire/core'
import type { Run } from '@lifespire/core'
import {
  formatDayKey,
  formatShortDayKey,
} from '@lifespire/app-core/ui/format'
import { homeState, weekMarker } from '@lifespire/app-core/ui/dashboard'
import type { HomeCta, HomePhase, WeekMarker } from '@lifespire/app-core/ui/dashboard'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { AimRow } from '../components/AimRow'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { Panel, PanelHead, ScreenHead } from '../components/Panel'
import { DayPips, Progress } from '../components/Progress'
import { Screen } from '../components/Screen'
import { Stat, StatStrip } from '../components/Stat'
import { Text } from '../components/Text'
import { useAppStore } from '../state/store'

const PHASE_META: Record<HomePhase, { label: string; icon: 'moon' | 'compass' | 'check' | 'lock' | 'crown' }> = {
  'no-run': { label: 'Before the run', icon: 'moon' },
  'day-available': { label: 'Day open', icon: 'compass' },
  'day-in-progress': { label: 'In progress', icon: 'check' },
  'day-completed': { label: 'Day sealed', icon: 'check' },
  'day-missed': { label: 'Day missed', icon: 'moon' },
  'day-locked': { label: 'Ahead', icon: 'lock' },
  'run-closed': { label: 'Week sealed', icon: 'crown' },
  'no-open-day': { label: 'Week spent', icon: 'crown' },
}

const CTA_COPY: Record<HomeCta, string> = {
  'begin-run': 'Begin a run',
  'open-day': "Open today's map",
  'continue-day': 'Continue the climb',
  'review-day': 'Read today’s summary',
  'review-week': 'Read the week',
  none: '',
}

export function HomeScreen() {
  const { colors } = useTheme()
  const document = useAppStore((state) => state.document)
  const navigate = useAppStore((state) => state.navigate)
  const openDay = useAppStore((state) => state.openDay)
  const startRun = useAppStore((state) => state.startRun)
  const todayKey = useAppStore((state) => state.todayKey)
  const run = document.run
  const profile = document.profile
  const today = todayKey()
  const state = homeState(run, today)
  const current = currentDay(run)
  const labelDay = state.today ?? current
  const meta = PHASE_META[state.phase]
  const cta = CTA_COPY[state.cta]

  const act = () => {
    switch (state.cta) {
      case 'begin-run':
        startRun()
        return
      case 'open-day':
        openDay()
        navigate({ name: 'map' })
        return
      case 'continue-day':
        navigate({ name: 'map' })
        return
      case 'review-day':
        if (state.today) navigate({ name: 'day-summary', dayId: state.today.id })
        return
      case 'review-week':
        navigate({ name: 'run-summary' })
        return
      default:
        return
    }
  }

  return (
    <Screen>
      <ScreenHead
        kicker={`Camp · ${formatDayKey(today)}`}
        title={profile ? `Welcome back, ${profile.name}` : 'Camp'}
        subtitle={
          <Text variant="bodyMd" tone="muted">
            {meta.label}
            {run ? (labelDay ? ` · Day ${labelDay.index + 1} of 7` : ' · Week sealed') : ' · No run yet'}
          </Text>
        }
        aside={
          <View style={[styles.phaseChip, { borderColor: colors.hairline, backgroundColor: colors.surface }]}>
            <Icon name={meta.icon} size={14} color={colors.accent} />
            <Text variant="caption" tone="muted">
              {meta.label}
            </Text>
          </View>
        }
      />

      {run ? (
        <>
          <Panel>
            <PanelHead label="The week" aside={<DayPips days={run.days} currentIndex={labelDay?.index} />} />
            <WeekStrip run={run} todayKey={today} />
            <Text variant="caption" tone="muted" style={styles.weekNote}>
              {state.isWaitingForMidnight
                ? 'The next day opens at local midnight.'
                : state.daysAhead > 0
                  ? `${state.daysAhead} ${state.daysAhead === 1 ? 'day' : 'days'} still ahead.`
                  : 'The week is complete.'}
            </Text>
          </Panel>

          <Panel>
            <PanelHead label="Today's path" aside={<Icon name={meta.icon} size={16} color={colors.accent} />} />
            <Text variant="headingMd">
              {state.phase === 'day-in-progress'
                ? state.hasSelection
                  ? 'A step is waiting'
                  : `${state.availableChoices} ${state.availableChoices === 1 ? 'path' : 'paths'} open`
                : state.phase === 'day-available'
                  ? 'The map is still folded'
                  : state.phase === 'day-completed'
                    ? 'The day is sealed'
                    : state.phase === 'run-closed'
                      ? 'The week is sealed'
                      : meta.label}
            </Text>
            <Text variant="bodySm" tone="muted" style={styles.ctaCopy}>
              {state.phase === 'day-in-progress'
                ? 'Choose one connected node, complete it in the world, then mark it here.'
                : state.phase === 'day-available'
                  ? 'Open the day to draw its layers, its choices and the daily boss.'
                  : state.phase === 'day-completed'
                    ? 'Read what the day granted, or wait for the next map at midnight.'
                    : state.phase === 'run-closed'
                      ? 'The weekly bonus is already in your profile. Begin a new run when you are ready.'
                      : 'There is no playable day right now.'}
            </Text>
            {cta ? (
              <Button onPress={act} full>
                {cta}
              </Button>
            ) : null}
          </Panel>

          <Panel>
            <PanelHead label="Weekly targets" aside={<Text variant="caption" tone="soft">{run.objectives.length}</Text>} />
            <View style={styles.aims}>
              {run.objectives.map((objective) => {
                const goal = document.goals.find((candidate) => candidate.id === objective.goalId)
                return (
                  <AimRow
                    key={objective.goalId}
                    icon={goal?.icon ?? 'banner'}
                    title={objective.goalTitle}
                    subtitle={`${objective.progress} of ${objective.target} kept`}
                    progress={objective.progress}
                    target={objective.target}
                  />
                )
              })}
            </View>
          </Panel>
        </>
      ) : (
        <Panel>
          <EmptyState
            icon="tent"
            title="No run yet"
            action={
              <Button onPress={() => startRun()} disabled={!profile}>
                Begin a run
              </Button>
            }
          >
            {profile
              ? 'Your goals and routines are ready. Begin a seven-day run to draw the first map.'
              : 'Finish onboarding to begin.'}
          </EmptyState>
        </Panel>
      )}

      {profile ? (
        <Panel>
          <PanelHead label="The traveller" aside={<Text variant="caption" tone="soft">Level {profile.level}</Text>} />
          <View style={styles.profileRow}>
            <View style={[styles.avatar, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
              <Text variant="headingMd" tone="deep">
                {profile.name.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileBody}>
              <Text variant="headingSm">{profile.name}</Text>
              <Text variant="caption" tone="muted">
                {xpIntoLevel(profile.xp)} / 100 XP · {profile.loot.length} relics
              </Text>
              <Progress value={xpIntoLevel(profile.xp)} max={100} label="Experience to next level" />
            </View>
            <View style={styles.gold}>
              <Icon name="coin" size={16} color={colors.accentDeep} />
              <AnimatedNumber value={profile.gold} />
            </View>
          </View>
          <StatStrip>
            <Stat label="Level" value={profile.level} />
            <Stat label="XP" value={profile.xp} />
            <Stat label="Next level" value={`${xpToNextLevel(profile.xp)} XP`} />
          </StatStrip>
        </Panel>
      ) : null}

      <View style={styles.links}>
        <Button variant="quiet" icon="banner" onPress={() => navigate({ name: 'goals' })} full>
          Review goals and routines
        </Button>
      </View>
    </Screen>
  )
}

const WEEK_WORD: Record<WeekMarker, string> = {
  completed: 'kept',
  missed: 'missed',
  today: 'today',
  locked: 'ahead',
}

function WeekStrip({ run, todayKey }: { run: Run; todayKey: string }) {
  const { colors } = useTheme()
  return (
    <View style={styles.weekStrip}>
      {run.days.map((day) => {
        const marker = weekMarker(day, todayKey)
        return (
          <View
            key={day.id}
            accessibilityLabel={`Day ${day.index + 1}, ${WEEK_WORD[marker]}`}
            style={[
              styles.weekDay,
              {
                borderColor:
                  marker === 'today'
                    ? colors.accent
                    : marker === 'completed'
                      ? colors.ink
                      : colors.hairline,
                backgroundColor:
                  marker === 'completed'
                    ? colors.ink
                    : marker === 'today'
                      ? colors.accentSoft
                      : colors.surface,
              },
            ]}
          >
            <Text
              variant="micro"
              tone={marker === 'completed' ? 'inverse' : marker === 'today' ? 'deep' : 'soft'}
            >
              {day.index + 1}
            </Text>
            <Text
              variant="caption"
              tone={marker === 'completed' ? 'inverse' : marker === 'today' ? 'deep' : 'muted'}
            >
              {formatShortDayKey(day.date)}
            </Text>
            <Text
              variant="caption"
              tone={marker === 'completed' ? 'inverse' : marker === 'today' ? 'deep' : 'soft'}
            >
              {WEEK_WORD[marker]}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  phaseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  weekStrip: { flexDirection: 'row', gap: space.xxs },
  weekDay: {
    flex: 1,
    minHeight: 62,
    borderWidth: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingVertical: space.xxs,
  },
  weekNote: { marginTop: space.sm },
  ctaCopy: { marginTop: space.xs, marginBottom: space.md },
  aims: { gap: space.sm },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  avatar: { width: 48, height: 48, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  profileBody: { flex: 1, gap: 2 },
  gold: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  links: { gap: space.sm },
})
