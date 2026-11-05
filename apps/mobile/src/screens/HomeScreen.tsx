import { StyleSheet, View } from 'react-native'
import { RUN_DAYS, validateSetup } from '@lifespire/core'
import type { Run } from '@lifespire/core'
import { formatShortDayKey } from '@lifespire/app-core/ui/format'
import { homeState, weekMarker } from '@lifespire/app-core/ui/dashboard'
import type { HomePhase, WeekMarker } from '@lifespire/app-core/ui/dashboard'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { AimRow } from '../components/AimRow'
import { Button } from '../components/Button'
import { Chip } from '../components/Chip'
import { Panel, PanelHead } from '../components/Panel'
import { Screen } from '../components/Screen'
import { Text } from '../components/Text'
import { useAppStore } from '../state/store'

const PHASE_META: Record<HomePhase, { label: string; icon: 'moon' | 'compass' | 'check' | 'lock' | 'crown' }> = {
  'no-run': { label: 'Before the journey', icon: 'moon' },
  'day-available': { label: 'Day open', icon: 'compass' },
  'day-in-progress': { label: 'In progress', icon: 'check' },
  'day-completed': { label: 'Day sealed', icon: 'check' },
  'day-missed': { label: 'Day lost', icon: 'moon' },
  'day-locked': { label: 'Ahead', icon: 'lock' },
  'run-closed': { label: 'Week sealed', icon: 'crown' },
  'no-open-day': { label: 'Week spent', icon: 'crown' },
}

export function HomeScreen() {
  const { colors } = useTheme()
  const document = useAppStore((state) => state.document)
  const navigate = useAppStore((state) => state.navigate)
  const openDay = useAppStore((state) => state.openDay)
  const startRun = useAppStore((state) => state.startRun)
  const todayKey = useAppStore((state) => state.todayKey)
  const run = document.run
  const today = todayKey()
  const state = homeState(run, today)
  const meta = PHASE_META[state.phase]
  const setupReady = validateSetup(document.goals, document.tasks).ok
  const dayNumber = state.today ? state.today.index + 1 : 0
  const daysMissed = run?.days.filter((day) => day.status === 'missed').length ?? 0

  const act = () => {
    switch (state.cta) {
      case 'begin-run':
        if (setupReady) startRun()
        else navigate({ name: 'goals' })
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

  const copy = (() => {
    switch (state.phase) {
      case 'no-run':
        return setupReady
          ? { title: 'No journey yet.', line: 'Your quests are ready.' }
          : { title: 'The route needs quests.', line: 'A journey needs one quest and four trials.' }
      case 'day-available':
        return { title: 'Today’s route is ready.', line: 'Open it once; the map will not change.' }
      case 'day-in-progress':
        return {
          title: `Day ${dayNumber} is open.`,
          line: state.hasSelection
            ? 'One step is chosen.'
            : state.availableChoices > 0
              ? `${state.availableChoices} routes ahead.`
              : 'No step is open.',
        }
      case 'day-completed':
        return { title: 'The day is sealed.', line: 'The next route opens at midnight.' }
      case 'day-missed':
        return { title: 'The day passed unclaimed.', line: 'Lost days are not recovered.' }
      case 'day-locked':
        return { title: 'The next day is sealed.', line: 'Only today can be played.' }
      case 'run-closed':
        return { title: 'The week is sealed.', line: 'The totals are yours.' }
      case 'no-open-day':
        return { title: 'The week is spent.', line: 'Begin a new journey from the week summary.' }
    }
  })()

  const cta = (() => {
    switch (state.cta) {
      case 'begin-run':
        return setupReady ? 'Begin a journey' : 'Review your quests'
      case 'open-day':
        return 'Open today’s route'
      case 'continue-day':
        return 'Continue the ascent'
      case 'review-day':
        return state.today ? 'Read the day' : null
      case 'review-week':
        return 'Read the week'
      case 'none':
        return null
    }
  })()

  const kicker = (() => {
    switch (state.phase) {
      case 'no-run':
        return 'Camp · Before the journey'
      case 'run-closed':
        return 'Camp · Week sealed'
      case 'no-open-day':
        return 'Camp · Week spent'
      default:
        return state.today ? `Camp · Day ${dayNumber} of ${RUN_DAYS}` : 'Camp · The week'
    }
  })()

  const goalRows = run
    ? run.objectives.map((objective) => ({
        key: objective.goalId,
        title: objective.goalTitle,
        progress: objective.progress,
        target: objective.target,
        icon: document.goals.find((goal) => goal.id === objective.goalId)?.icon ?? 'banner',
      }))
    : document.goals
        .filter((goal) => goal.active)
        .map((goal) => ({
          key: goal.id,
          title: goal.title,
          progress: 0,
          target: goal.weeklyObjective,
          icon: goal.icon,
        }))

  return (
    <Screen>
      <Panel>
        <View style={styles.hero}>
          <View style={styles.heroHead}>
            <View style={styles.kicker}>
              <View style={[styles.kickerMark, { backgroundColor: colors.accent }]} />
              <Text variant="micro" tone="muted">
                {kicker.toUpperCase()}
              </Text>
            </View>
            <Chip variant={state.phase === 'day-missed' ? 'quiet' : 'default'} icon={meta.icon}>
              {meta.label}
            </Chip>
          </View>
          <Text variant="displayMd" accessibilityRole="header">
            {copy.title}
          </Text>
          <Text variant="bodyMd" tone="muted">
            {copy.line}
          </Text>
          {cta ? (
            <View style={styles.heroAction}>
              <Button onPress={act} full>
                {cta}
              </Button>
            </View>
          ) : null}
        </View>
      </Panel>

      {run ? (
        <Panel>
          <PanelHead label="The week" />
          <WeekStrip run={run} todayKey={today} />
          {daysMissed > 0 ? (
            <Text variant="bodySm" tone="soft" style={styles.missedNote}>
              {daysMissed === 1
                ? '1 day was lost and is not recovered.'
                : `${daysMissed} days were lost and are not recovered.`}
            </Text>
          ) : null}
        </Panel>
      ) : null}

      {goalRows.length > 0 ? (
        <Panel>
          <PanelHead
            label="Weekly quests"
            aside={
              <Button small variant="ghost" onPress={() => navigate({ name: 'goals' })}>
                All quests
              </Button>
            }
          />
          <View style={styles.aims}>
            {goalRows.map((row) => (
              <AimRow
                key={row.key}
                icon={row.icon}
                title={row.title}
                progress={row.progress}
                target={row.target}
              />
            ))}
          </View>
        </Panel>
      ) : null}
    </Screen>
  )
}

const WEEK_WORD: Record<WeekMarker, string> = {
  completed: 'kept',
  missed: 'lost',
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
            accessible
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
  hero: { gap: space.xs },
  heroHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginBottom: space.xxs,
  },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1 },
  kickerMark: { width: 5, height: 5, borderRadius: 1, transform: [{ rotate: '45deg' }] },
  heroAction: { marginTop: space.sm },
  weekStrip: { flexDirection: 'row', gap: space.xxs },
  missedNote: { marginTop: space.sm },
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
  aims: { gap: space.sm },
})
