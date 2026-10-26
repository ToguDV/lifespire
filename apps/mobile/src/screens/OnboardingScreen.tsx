import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Svg, { Circle, G, Path } from 'react-native-svg'
import {
  MAX_GOALS,
  MAX_WEEKLY_OBJECTIVE,
  MIN_ACTIVE_TASKS,
  MIN_GOALS,
  MIN_WEEKLY_OBJECTIVE,
  RUN_DAYS,
  createDemoSetup,
  draftToSetup,
  validateSetup,
} from '@lifespire/core'
import type { Goal, GoalInput, OnboardingDraft, Task, TaskInput } from '@lifespire/core'
import { createEmptyDraft, withSuggestedObjectives } from '@lifespire/core'
import { EFFORT_LABEL, GOAL_ICON_LABEL } from '@lifespire/app-core/ui/format'
import { getNow } from '@lifespire/app-core/state/clock'
import { useTheme } from '../theme/ThemeProvider'
import { fonts, radius, space } from '../theme/tokens'
import { Button } from '../components/Button'
import { EffortDots } from '../components/EffortDots'
import { Field, Input } from '../components/Field'
import { GoalFormDialog } from '../components/GoalFormDialog'
import { Icon } from '../components/Icon'
import { IconButton } from '../components/IconButton'
import { Panel } from '../components/Panel'
import { Screen } from '../components/Screen'
import { TaskFormDialog } from '../components/TaskFormDialog'
import { Text } from '../components/Text'
import { ThemeToggle } from '../components/ThemeToggle'
import { upsertDraftGoal, upsertDraftTask } from '../lib/draftContent'
import { useAppStore } from '../state/store'

const STEP_LABELS = ['Name', 'Goals', 'Routines', 'Review'] as const

export function OnboardingScreen() {
  const { colors } = useTheme()
  const document = useAppStore((state) => state.document)
  const updateDraft = useAppStore((state) => state.updateOnboardingDraft)
  const beginJourney = useAppStore((state) => state.beginJourney)
  const draft: OnboardingDraft = document.onboardingDraft ?? createEmptyDraft()
  const step = draft.mode === 'custom' ? draft.step : 0
  const [goalDialog, setGoalDialog] = useState<Goal | null | undefined>(undefined)
  const [taskDialog, setTaskDialog] = useState<Task | null | undefined>(undefined)
  const [formError, setFormError] = useState<string | null>(null)

  const validation = useMemo(
    () => validateSetup(draft.goals, draft.tasks),
    [draft.goals, draft.tasks],
  )

  const patch = (next: Partial<OnboardingDraft>) => updateDraft(next)

  const startDemo = () => {
    beginJourney(createDemoSetup(getNow()))
  }

  const startCustom = () => {
    patch({ mode: 'custom', step: 1 })
  }

  const saveGoal = (input: GoalInput) => {
    patch({
      goals: upsertDraftGoal(draft.goals, input, {
        newId: useAppStore.getState().newId,
        now: getNow,
      }),
    })
    setGoalDialog(undefined)
  }

  const saveTask = (input: TaskInput) => {
    patch({
      tasks: upsertDraftTask(draft.tasks, input, {
        newId: useAppStore.getState().newId,
        now: getNow,
      }),
    })
    setTaskDialog(undefined)
  }

  const removeGoal = (goal: Goal) => {
    patch({
      goals: draft.goals.filter((candidate) => candidate.id !== goal.id),
      tasks: draft.tasks.filter((task) => task.goalId !== goal.id),
    })
  }

  const removeTask = (task: Task) => {
    patch({ tasks: draft.tasks.filter((candidate) => candidate.id !== task.id) })
  }

  const goNext = () => {
    setFormError(null)
    if (step === 1) {
      patch({ step: 2 })
      return
    }
    if (step === 2) {
      if (draft.goals.length === 0) {
        setFormError('Add at least one goal to continue.')
        return
      }
      patch({ step: 3 })
      return
    }
    if (step === 3) {
      const active = draft.tasks.filter((task) => task.active)
      if (active.length < MIN_ACTIVE_TASKS) {
        setFormError(`Add at least ${MIN_ACTIVE_TASKS} active routines to continue.`)
        return
      }
      patch({
        step: 4,
        goals: withSuggestedObjectives(draft.goals, draft.tasks),
      })
      return
    }
    patch({ step: Math.max(1, step - 1) })
  }

  const goBack = () => {
    setFormError(null)
    if (step <= 1) {
      patch({ mode: null, step: 0 })
      return
    }
    patch({ step: step - 1 })
  }

  const finish = () => {
    const result = beginJourney(draftToSetup(draft))
    if (!result) setFormError('This path cannot begin yet.')
  }

  const applySuggestions = () => {
    patch({ goals: withSuggestedObjectives(draft.goals, draft.tasks) })
  }

  if (step === 0) {
    return (
      <Screen bottomInset={false}>
        <View style={styles.brandRow}>
          <View style={styles.brand}>
            <Icon name="spire" size={26} color={colors.ink} />
            <Text variant="headingMd">LifeSpire</Text>
          </View>
          <ThemeToggle />
        </View>

        <View style={styles.hero}>
          <View style={styles.kicker}>
            <View style={[styles.kickerMark, { backgroundColor: colors.accent }]} />
            <Text variant="micro" tone="muted">
              A SEVEN-DAY RUN
            </Text>
          </View>
          <Text variant="displayLg" accessibilityRole="header">
            A day is a{' '}
            <Text style={[styles.pathWord, { color: colors.accentDeep }]}>path</Text>.
          </Text>
          <Text variant="bodyLg" tone="muted">
            Turn the routines that matter into a seven-day climb. Choose a route, keep a small
            promise, gather what you find.
          </Text>
        </View>

        <WelcomeArt />

        <View style={styles.welcomeActions}>
          <Button onPress={startDemo} full>
            Begin with demo data
          </Button>
          <CreatePathButton onPress={startCustom} />
        </View>

        <View style={styles.privacyRow}>
          <Icon name="lock" size={14} color={colors.inkSoft} />
          <Text variant="caption" tone="soft" style={styles.privacyText}>
            Your data stays on this device. Sync is optional.
          </Text>
        </View>
      </Screen>
    )
  }

  const copy =
    step === 1
      ? {
          title: 'Who walks this path?',
          body: 'A name is optional.',
        }
      : step === 2
        ? {
            title: 'What are you climbing toward?',
            body: `Choose ${MIN_GOALS}–${MAX_GOALS} goals.`,
          }
        : step === 3
          ? {
              title: 'Which small steps will you keep?',
              body: `Add at least ${MIN_ACTIVE_TASKS} active routines.`,
            }
          : {
              title: 'Ready to begin?',
              body: 'Check the week before it begins.',
            }

  const activeRoutineCount = draft.tasks.filter((task) => task.active).length

  return (
    <Screen bottomInset={false}>
      <View style={styles.wizardHead}>
        <View style={styles.brand}>
          <Icon name="spire" size={24} color={colors.ink} />
          <Text variant="headingMd">LifeSpire</Text>
        </View>
        <ThemeToggle />
      </View>

      <View style={styles.kicker}>
        <View style={[styles.kickerMark, { backgroundColor: colors.accent }]} />
        <Text variant="micro" tone="muted">
          CREATE YOUR PATH
        </Text>
      </View>
      <Text variant="displayMd" accessibilityRole="header" accessibilityLiveRegion="polite">{copy.title}</Text>
      <Text variant="bodyMd" tone="muted" style={styles.wizardCopy}>
        {copy.body}
      </Text>

      <View style={styles.steps}>
        {STEP_LABELS.map((label, index) => {
          const number = index + 1
          const current = number === step
          return (
            <View
              key={label}
              style={[
                styles.step,
                {
                  backgroundColor: current ? colors.accentSoft : 'transparent',
                  borderColor: current ? colors.accentDeep : colors.hairline,
                },
              ]}
            >
              <Text variant="micro" tone={current ? 'deep' : 'muted'}>
                {number}
              </Text>
              <Text variant="caption" tone={current ? 'deep' : 'muted'}>
                {label}
              </Text>
            </View>
          )
        })}
      </View>

      {step === 1 ? (
        <Panel>
          <Field label="Name">
            <Input
              value={draft.name}
              onChangeText={(name) => patch({ name })}
              placeholder="Traveller"
              autoFocus
              returnKeyType="done"
            />
          </Field>
        </Panel>
      ) : null}

      {step === 2 ? (
        <View style={styles.list}>
          {draft.goals.map((goal) => (
            <Panel key={goal.id}>
              <View style={styles.goalRow}>
                <View
                  style={[
                    styles.crest,
                    { backgroundColor: colors.surfaceRaised, borderColor: colors.hairline },
                  ]}
                >
                  <Icon name={goal.icon} size={18} color={colors.accentDeep} />
                </View>
                <View style={styles.goalBody}>
                  <Text variant="headingSm">{goal.title}</Text>
                  <Text variant="caption" tone="muted">
                    {goal.category} · target {goal.weeklyObjective} · {GOAL_ICON_LABEL[goal.icon]}
                  </Text>
                </View>
                <IconButton
                  icon="edit"
                  label={`Edit ${goal.title}`}
                  onPress={() => setGoalDialog(goal)}
                />
                <IconButton
                  icon="archive"
                  label={`Remove ${goal.title}`}
                  onPress={() => removeGoal(goal)}
                />
              </View>
            </Panel>
          ))}
          <Button
            variant="secondary"
            icon="plus"
            onPress={() => setGoalDialog(null)}
            disabled={draft.goals.length >= MAX_GOALS}
            full
          >
            Add goal
          </Button>
          <Text variant="caption" tone="soft">
            {`${draft.goals.length} / ${MAX_GOALS} goals`}
          </Text>
          {formError ? (
            <Text variant="caption" tone="default" accessibilityRole="alert">
              {formError}
            </Text>
          ) : null}
        </View>
      ) : null}

      {step === 3 ? (
        <View style={styles.list}>
          {draft.tasks.map((task) => {
            const goal = draft.goals.find((candidate) => candidate.id === task.goalId)
            return (
              <Panel key={task.id}>
                <View style={styles.goalRow}>
                  <View style={styles.taskBody}>
                    <Text variant="headingSm">{task.title}</Text>
                    <Text variant="caption" tone="muted">
                      {goal?.title ?? 'No goal'} · {EFFORT_LABEL[task.effort]}
                    </Text>
                  </View>
                  <EffortDots effort={task.effort} showLabel={false} />
                  <IconButton
                    icon="edit"
                    label={`Edit ${task.title}`}
                    onPress={() => setTaskDialog(task)}
                  />
                  <IconButton
                    icon="archive"
                    label={`Remove ${task.title}`}
                    onPress={() => removeTask(task)}
                  />
                </View>
              </Panel>
            )
          })}
          <Button
            variant="secondary"
            icon="plus"
            onPress={() => setTaskDialog(null)}
            disabled={draft.goals.length === 0}
            full
          >
            Add routine
          </Button>
          <Text variant="caption" tone="muted">
            Active routines: {activeRoutineCount} · minimum {MIN_ACTIVE_TASKS}
          </Text>
          {formError ? (
            <Text variant="caption" tone="default" accessibilityRole="alert">
              {formError}
            </Text>
          ) : null}
        </View>
      ) : null}

      {step === 4 ? (
        <View style={styles.list}>
          <Panel>
            <Text variant="headingLg">{draft.name.trim() || 'Wayfarer'}</Text>
            <Text variant="caption" tone="muted" style={styles.reviewCounts}>
              {draft.goals.length} {draft.goals.length === 1 ? 'goal' : 'goals'} ·{' '}
              {activeRoutineCount} active {activeRoutineCount === 1 ? 'routine' : 'routines'} ·{' '}
              {RUN_DAYS} days
            </Text>
          </Panel>

          {draft.goals.map((goal) => {
            const routines = draft.tasks.filter((task) => task.goalId === goal.id && task.active)
            return (
              <Panel key={goal.id}>
                <View style={styles.goalRow}>
                  <View
                    style={[
                      styles.crest,
                      { backgroundColor: colors.surfaceRaised, borderColor: colors.hairline },
                    ]}
                  >
                    <Icon name={goal.icon} size={18} color={colors.accentDeep} />
                  </View>
                  <View style={styles.goalBody}>
                    <Text variant="headingSm">{goal.title}</Text>
                    <Text variant="caption" tone="muted">
                      {routines.length} {routines.length === 1 ? 'routine' : 'routines'}
                    </Text>
                  </View>
                  <View style={styles.stepper}>
                    <Button
                      variant="secondary"
                      small
                      accessibilityLabel={`Decrease target for ${goal.title}`}
                      onPress={() =>
                        patch({
                          goals: draft.goals.map((candidate) =>
                            candidate.id === goal.id
                              ? {
                                  ...candidate,
                                  weeklyObjective: Math.max(
                                    MIN_WEEKLY_OBJECTIVE,
                                    candidate.weeklyObjective - 1,
                                  ),
                                }
                              : candidate,
                          ),
                        })
                      }
                    >
                      −
                    </Button>
                    <Text variant="headingSm">{goal.weeklyObjective}</Text>
                    <Button
                      variant="secondary"
                      small
                      accessibilityLabel={`Increase target for ${goal.title}`}
                      onPress={() =>
                        patch({
                          goals: draft.goals.map((candidate) =>
                            candidate.id === goal.id
                              ? {
                                  ...candidate,
                                  weeklyObjective: Math.min(
                                    MAX_WEEKLY_OBJECTIVE,
                                    candidate.weeklyObjective + 1,
                                  ),
                                }
                              : candidate,
                          ),
                        })
                      }
                    >
                      +
                    </Button>
                  </View>
                </View>
                <View style={styles.routineList}>
                  {routines.map((routine) => (
                    <Text key={routine.id} variant="caption" tone="muted">
                      · {routine.title} ({EFFORT_LABEL[routine.effort]})
                    </Text>
                  ))}
                </View>
              </Panel>
            )
          })}

          <Button variant="secondary" onPress={applySuggestions} full>
            Use routine-based suggestions
          </Button>

          {!validation.ok ? (
            <Panel>
              <Text variant="headingSm" tone="default">
                Before you begin
              </Text>
              {validation.errors.map((error) => (
                <Text key={error} variant="bodySm" tone="default">
                  · {error}
                </Text>
              ))}
            </Panel>
          ) : null}
          {formError ? (
            <Text variant="caption" tone="default" accessibilityRole="alert">
              {formError}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.footer}>
        <Button variant="quiet" icon="arrow-left" onPress={goBack}>
          Back
        </Button>
        {step === 4 ? (
          <Button onPress={finish} disabled={!validation.ok}>
            Begin the run
          </Button>
        ) : (
          <Button onPress={goNext}>Continue</Button>
        )}
      </View>

      <GoalFormDialog
        visible={goalDialog !== undefined}
        goal={goalDialog ?? null}
        goals={draft.goals}
        onClose={() => setGoalDialog(undefined)}
        onSubmit={saveGoal}
      />
      <TaskFormDialog
        visible={taskDialog !== undefined}
        task={taskDialog ?? null}
        goals={draft.goals}
        onClose={() => setTaskDialog(undefined)}
        onSubmit={saveTask}
      />
    </Screen>
  )
}

function CreatePathButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      android_ripple={{ color: colors.accentWash }}
      style={({ pressed }) => [
        styles.createPath,
        { borderColor: colors.hairlineStrong, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <Text variant="button" style={{ color: colors.ink }}>
        Create my own path
      </Text>
      <Icon name="chevron-right" size={17} color={colors.inkMuted} />
    </Pressable>
  )
}

function WelcomeArt() {
  const { colors } = useTheme()
  return (
    <View style={[styles.art, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
      <View
        pointerEvents="none"
        style={[styles.artInset, { borderColor: colors.hairline }]}
      />
      <Svg
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        width="100%"
        height="100%"
        viewBox="0 0 560 640"
        preserveAspectRatio="xMidYMid meet"
      >
        <G fill="none" stroke={colors.hairline} strokeWidth={1}>
          <Path d="M-40 580c110-38 170 26 280-2s180-58 360-20" />
          <Path d="M-40 500c110-34 170 24 280-4s180-54 360-18" />
          <Path d="M-40 420c110-30 170 20 280-6s180-50 360-16" />
          <Path d="M-40 340c110-26 170 18 280-8s180-46 360-14" />
          <Path d="M-40 260c110-22 170 14 280-10s180-42 360-12" />
          <Path d="M-40 180c110-18 170 10 280-12s180-38 360-10" />
          <Path d="M462 138c10-4 18-4 28 0" />
          <Path d="M96 280c8-3 15-3 23 0" />
          <Path d="M476 552c8-3 15-3 23 0" />
        </G>

        <Path
          d="M138 606C172 568 202 530 240 494C272 466 306 446 330 412C344 392 348 370 356 348"
          fill="none"
          stroke={colors.hairlineStrong}
          strokeWidth={1.4}
          strokeDasharray="3 7"
          strokeLinecap="round"
        />
        <Path
          d="M356 348C366 326 374 316 382 306"
          fill="none"
          stroke={colors.accentDeep}
          strokeWidth={1.6}
          strokeLinecap="round"
        />

        <Circle cx={382} cy={215} r={112} fill={colors.accentWash} stroke={colors.hairline} />
        <Circle cx={382} cy={215} r={84} fill="none" stroke={colors.hairline} />

        <G
          fill="none"
          stroke={colors.accentDeep}
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M352 306V216h60v90" />
          <Path d="m338 216 44-102 44 102z" />
          <Path d="M370 306v-26a12 12 0 0 1 24 0v26" />
          <Path d="M378 268v-28a4 4 0 0 1 8 0v28" />
          <Path d="m382 88 6 12-6 12-6-12z" />
          <Path d="M344 306h76M350 312h64" />
        </G>

        <G fill="none" stroke={colors.hairline} strokeWidth={1.2} strokeLinecap="round">
          <Path d="M64 482l11-22 11 22zM75 482v9" />
          <Path d="M94 506l7-14 7 14zM101 506v6" />
          <Path d="M488 460l12-24 12 24zM500 460v10" />
          <Path d="M458 492l8-16 8 16zM466 492v7" />
        </G>

        <Path
          d="M96 84a16 16 0 1 0 12 26 18 18 0 1 1-12-26"
          fill="none"
          stroke={colors.accentDeep}
          strokeWidth={1.3}
          strokeLinecap="round"
        />

        <G fill="none" stroke={colors.accentDeep} strokeWidth={1.3}>
          <Circle cx={138} cy={606} r={15} />
          <Circle cx={240} cy={494} r={16} />
          <Circle cx={330} cy={412} r={17} />
          <Circle cx={356} cy={348} r={19} strokeWidth={1.6} />
        </G>
        <G
          fill="none"
          stroke={colors.accentDeep}
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M133 610l5-8 5 8zM138 610v3" />
          <Path d="m235 489 3 5 6-6" />
          <Path d="M325 407h10M325 411h10M325 415h7" />
          <Path d="M351 343h10M351 347h10M351 351h7" />
        </G>
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  hero: { gap: space.sm },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  kickerMark: { width: 5, height: 5, borderRadius: 1, transform: [{ rotate: '45deg' }] },
  pathWord: { fontFamily: fonts.displayItalic },
  art: {
    height: 300,
    borderWidth: 1,
    borderRadius: radius.xxl,
    overflow: 'hidden',
  },
  artInset: {
    position: 'absolute',
    top: 7,
    right: 7,
    bottom: 7,
    left: 7,
    zIndex: 1,
    borderWidth: 1,
    borderRadius: radius.xxl - 7,
    opacity: 0.45,
  },
  welcomeActions: { gap: space.sm, marginTop: space.xs },
  createPath: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
  // 6px icon-text rhythm; no token covers it.
  privacyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 0 },
  privacyText: { flex: 1 },
  wizardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wizardCopy: { marginTop: space.xs },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  list: { gap: space.sm },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  crest: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalBody: { flex: 1, gap: 2 },
  taskBody: { flex: 1, gap: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  routineList: { gap: 2, marginTop: space.xs },
  reviewCounts: { marginTop: space.xxs },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
})
