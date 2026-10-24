import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import {
  MAX_GOALS,
  MIN_ACTIVE_TASKS,
  createDemoSetup,
  draftToSetup,
  validateSetup,
} from '@lifespire/core'
import type { Goal, GoalInput, OnboardingDraft, Task, TaskInput } from '@lifespire/core'
import { createEmptyDraft, withSuggestedObjectives } from '@lifespire/core'
import { EFFORT_LABEL, GOAL_ICON_LABEL } from '@lifespire/app-core/ui/format'
import { getNow } from '@lifespire/app-core/state/clock'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
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
import { useAppStore } from '../state/store'

const STEP_LABELS = ['Name', 'Goals', 'Routines', 'Review'] as const

export function OnboardingScreen() {
  const { colors } = useTheme()
  const document = useAppStore((state) => state.document)
  const updateDraft = useAppStore((state) => state.updateOnboardingDraft)
  const beginJourney = useAppStore((state) => state.beginJourney)
  const setTheme = useAppStore((state) => state.setTheme)
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
    const setup = createDemoSetup(getNow())
    beginJourney({ ...setup, name: draft.name.trim() || setup.name })
  }

  const startCustom = () => {
    patch({ mode: 'custom', step: 1 })
  }

  const saveGoal = (input: GoalInput) => {
    const goals = input.id
      ? draft.goals.map((goal) =>
          goal.id === input.id
            ? {
                ...goal,
                title: input.title,
                category: input.category,
                icon: input.icon ?? goal.icon,
                weeklyObjective: input.weeklyObjective,
                active: input.active,
              }
            : goal,
        )
      : [
          ...draft.goals,
          {
            id: useAppStore.getState().newId('goal'),
            title: input.title,
            category: input.category,
            icon: input.icon ?? 'banner',
            weeklyObjective: input.weeklyObjective,
            active: input.active,
            createdAt: getNow().toISOString(),
          },
        ]
    patch({ goals })
    setGoalDialog(undefined)
  }

  const saveTask = (input: TaskInput) => {
    const tasks = input.id
      ? draft.tasks.map((task) =>
          task.id === input.id
            ? {
                ...task,
                goalId: input.goalId,
                title: input.title,
                effort: input.effort,
                active: input.active,
              }
            : task,
        )
      : [
          ...draft.tasks,
          {
            id: useAppStore.getState().newId('task'),
            goalId: input.goalId,
            title: input.title,
            effort: input.effort,
            active: input.active,
            createdAt: getNow().toISOString(),
          },
        ]
    patch({ tasks })
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

  if (step === 0) {
    return (
      <Screen>
        <View style={styles.brandRow}>
          <View style={styles.brand}>
            <Icon name="spire" size={26} color={colors.ink} />
            <Text variant="headingMd">LifeSpire</Text>
          </View>
          <ThemeToggleMini onToggle={() => setTheme(document.settings.theme === 'dark' ? 'light' : 'dark')} />
        </View>

        <View style={styles.hero}>
          <Text variant="micro" tone="accent">
            A SEVEN-DAY RUN
          </Text>
          <Text variant="displayLg">A day is a path.</Text>
          <Text variant="bodyLg" tone="muted">
            Turn the routines that matter into a seven-day climb. Choose a route, keep a small
            promise, gather what you find.
          </Text>
        </View>

        <View style={styles.points}>
          <WelcomePoint icon="map" text="Each day draws its own path of layers and a boss." />
          <WelcomePoint icon="star" text="Completed routines grant XP, gold and weekly progress." />
          <WelcomePoint icon="crown" text="Seven days make a run; the weekly bonus lands at its close." />
        </View>

        <Panel>
          <Field label="What should we call you? (optional)">
            <Input
              value={draft.name}
              onChangeText={(name) => patch({ name })}
              placeholder="Traveller"
              autoComplete="name"
            />
          </Field>
          <View style={styles.welcomeActions}>
            <Button onPress={startDemo} full>
              Begin with demo data
            </Button>
            <Button variant="secondary" onPress={startCustom} full>
              Create my own path
            </Button>
          </View>
          <Text variant="caption" tone="soft" style={styles.note}>
            The demo creates two goals and five routines. Your own path asks for one to ten goals
            and at least four routines.
          </Text>
        </Panel>

        <Text variant="caption" tone="soft" style={[styles.note, { marginTop: 0 }]}>
          Your data stays on this device. Sync is optional.
        </Text>
      </Screen>
    )
  }

  const copy =
    step === 1
      ? {
          title: 'Who walks this path?',
          body: 'A name is optional. It only appears on your profile on this device.',
        }
      : step === 2
        ? {
            title: 'What are you climbing toward?',
            body: 'Choose one to ten goals: the areas you are pursuing, such as movement or making.',
          }
        : step === 3
          ? {
              title: 'Which small steps will you keep?',
              body: `Add at least ${MIN_ACTIVE_TASKS} active routines across your goals. Effort changes the reward, not the weekly progress.`,
            }
          : {
              title: 'Ready to begin?',
              body: 'Review the week. Weekly targets can still be adjusted here; the run starts today.',
            }

  return (
    <Screen>
      <View style={styles.wizardHead}>
        <IconButton icon="arrow-left" label="Back" onPress={goBack} size={38} />
        <Text variant="micro" tone="accent">
          CREATE YOUR PATH · STEP {step} OF 4
        </Text>
        <ThemeToggleMini onToggle={() => setTheme(document.settings.theme === 'dark' ? 'light' : 'dark')} />
      </View>
      <Text variant="displayMd">{copy.title}</Text>
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
                  backgroundColor: current ? colors.accentSoft : colors.surface,
                  borderColor: current ? colors.accent : colors.hairline,
                },
              ]}
            >
              <Text variant="micro" tone={current ? 'deep' : 'soft'}>
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
          {draft.goals.map((goal, index) => (
            <Panel key={goal.id}>
              <View style={styles.goalRow}>
                <View style={[styles.crest, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
                  <Icon name={goal.icon} size={18} color={colors.accentDeep} />
                </View>
                <View style={styles.goalBody}>
                  <Text variant="headingSm">{goal.title}</Text>
                  <Text variant="caption" tone="muted">
                    {goal.category} · target {goal.weeklyObjective} · {GOAL_ICON_LABEL[goal.icon]}
                  </Text>
                </View>
                <IconButton icon="edit" label={`Edit ${goal.title}`} onPress={() => setGoalDialog(goal)} size={36} />
                <IconButton
                  icon="archive"
                  label={`Remove ${goal.title}`}
                  onPress={() => removeGoal(goal)}
                  size={36}
                />
              </View>
              <Text variant="caption" tone="soft">
                Goal {index + 1} of {MAX_GOALS}
              </Text>
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
          {formError ? (
            <Text variant="caption" tone="danger" accessibilityRole="alert">
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
                  <IconButton icon="edit" label={`Edit ${task.title}`} onPress={() => setTaskDialog(task)} size={36} />
                  <IconButton
                    icon="archive"
                    label={`Remove ${task.title}`}
                    onPress={() => removeTask(task)}
                    size={36}
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
            Active routines: {draft.tasks.filter((task) => task.active).length} · minimum {MIN_ACTIVE_TASKS}
          </Text>
          {formError ? (
            <Text variant="caption" tone="danger" accessibilityRole="alert">
              {formError}
            </Text>
          ) : null}
        </View>
      ) : null}

      {step === 4 ? (
        <View style={styles.list}>
          {draft.goals.map((goal) => {
            const routines = draft.tasks.filter((task) => task.goalId === goal.id && task.active)
            return (
              <Panel key={goal.id}>
                <View style={styles.goalRow}>
                  <View style={[styles.crest, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
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
                              ? { ...candidate, weeklyObjective: Math.max(1, candidate.weeklyObjective - 1) }
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
                              ? { ...candidate, weeklyObjective: Math.min(7, candidate.weeklyObjective + 1) }
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
          {!validation.ok ? (
            <Panel>
              <Text variant="headingSm" tone="danger">
                Before you begin
              </Text>
              {validation.errors.map((error) => (
                <Text key={error} variant="bodySm" tone="danger">
                  · {error}
                </Text>
              ))}
            </Panel>
          ) : null}
          {formError ? (
            <Text variant="caption" tone="danger" accessibilityRole="alert">
              {formError}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.footer}>
        <Button variant="quiet" onPress={goBack}>
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

function WelcomePoint({ icon, text }: { icon: 'map' | 'star' | 'crown'; text: string }) {
  const { colors } = useTheme()
  return (
    <View style={styles.point}>
      <View style={[styles.pointIcon, { borderColor: colors.hairline, backgroundColor: colors.surface }]}>
        <Icon name={icon} size={16} color={colors.accent} />
      </View>
      <Text variant="bodySm" tone="muted" style={styles.pointText}>
        {text}
      </Text>
    </View>
  )
}

function ThemeToggleMini({ onToggle }: { onToggle: () => void }) {
  return <IconButton icon="moon" label="Toggle theme" onPress={onToggle} size={38} />
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  hero: { gap: space.sm },
  points: { gap: space.sm },
  point: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pointIcon: { width: 32, height: 32, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pointText: { flex: 1 },
  welcomeActions: { gap: space.sm, marginTop: space.md },
  note: { marginTop: space.sm },
  wizardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wizardCopy: { marginTop: space.xs },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  step: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: space.sm, paddingVertical: 3 },
  list: { gap: space.sm },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  crest: { width: 38, height: 38, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  goalBody: { flex: 1, gap: 2 },
  taskBody: { flex: 1, gap: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  routineList: { gap: 2, marginTop: space.xs },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
})
