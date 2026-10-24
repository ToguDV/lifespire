import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import type { Goal, GoalInput, Task, TaskInput } from '@lifespire/core'
import { MAX_GOALS, MIN_ACTIVE_TASKS } from '@lifespire/core'
import { EFFORT_LABEL } from '@lifespire/app-core/ui/format'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Button } from '../components/Button'
import { Dialog } from '../components/Dialog'
import { EffortDots } from '../components/EffortDots'
import { EmptyState } from '../components/EmptyState'
import { GoalFormDialog } from '../components/GoalFormDialog'
import { Icon } from '../components/Icon'
import { IconButton } from '../components/IconButton'
import { Panel, PanelHead, ScreenHead } from '../components/Panel'
import { Progress } from '../components/Progress'
import { Screen } from '../components/Screen'
import { TaskFormDialog } from '../components/TaskFormDialog'
import { Text } from '../components/Text'
import { useAppStore } from '../state/store'

export function GoalsScreen() {
  const { colors } = useTheme()
  const document = useAppStore((state) => state.document)
  const saveGoal = useAppStore((state) => state.saveGoal)
  const archiveGoal = useAppStore((state) => state.archiveGoal)
  const saveTask = useAppStore((state) => state.saveTask)
  const archiveTask = useAppStore((state) => state.archiveTask)
  const run = document.run
  const [goalDialog, setGoalDialog] = useState<Goal | null | undefined>(undefined)
  const [taskDialog, setTaskDialog] = useState<Task | null | undefined>(undefined)
  const [taskGoalId, setTaskGoalId] = useState<string | undefined>(undefined)
  const [archiveTarget, setArchiveTarget] = useState<{ type: 'goal' | 'task'; id: string; title: string } | null>(null)

  const activeGoals = document.goals.filter((goal) => goal.active)
  const archivedGoals = document.goals.filter((goal) => !goal.active)
  const activeTasks = document.tasks.filter((task) => task.active)
  const archivedTasks = document.tasks.filter((task) => !task.active)

  const submitGoal = (input: GoalInput) => {
    if (saveGoal(input).ok) setGoalDialog(undefined)
  }
  const submitTask = (input: TaskInput) => {
    if (saveTask(input).ok) setTaskDialog(undefined)
  }
  const confirmArchive = () => {
    if (!archiveTarget) return
    if (archiveTarget.type === 'goal') archiveGoal(archiveTarget.id)
    else archiveTask(archiveTarget.id)
    setArchiveTarget(null)
  }

  return (
    <Screen>
      <ScreenHead
        kicker="The week's shape"
        title="Goals and routines"
        subtitle={
          <Text variant="bodyMd" tone="muted">
            {activeGoals.length} active {activeGoals.length === 1 ? 'goal' : 'goals'} ·{' '}
            {activeTasks.length} routines. Changes only affect future maps.
          </Text>
        }
        aside={
          <Button small onPress={() => setGoalDialog(null)} disabled={activeGoals.length >= MAX_GOALS}>
            New goal
          </Button>
        }
      />

      {run?.status === 'active' ? (
        <Panel>
          <PanelHead label="This run" aside={<Text variant="caption" tone="soft">Snapshot</Text>} />
          <View style={styles.aims}>
            {run.objectives.map((objective) => (
              <View key={objective.goalId} style={styles.aim}>
                <View style={styles.aimHead}>
                  <Text variant="bodySm" numberOfLines={1} style={styles.aimTitle}>{objective.goalTitle}</Text>
                  <Text variant="caption" tone="muted">{objective.progress}/{objective.target}</Text>
                </View>
                <Progress value={objective.progress} max={objective.target} />
              </View>
            ))}
          </View>
        </Panel>
      ) : null}

      <View style={styles.section}>
        <Text variant="micro" tone="muted">ACTIVE GOALS</Text>
        {activeGoals.length === 0 ? (
          <Panel>
            <EmptyState icon="banner" title="No active goals">
              Add at least one goal before beginning a run.
            </EmptyState>
          </Panel>
        ) : (
          activeGoals.map((goal) => {
            const routines = document.tasks.filter((task) => task.goalId === goal.id && task.active)
            return (
              <Panel key={goal.id}>
                <View style={styles.goalHead}>
                  <View style={[styles.crest, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
                    <Icon name={goal.icon} size={18} color={colors.accentDeep} />
                  </View>
                  <View style={styles.goalBody}>
                    <Text variant="headingMd">{goal.title}</Text>
                    <Text variant="caption" tone="muted">
                      {goal.category} · weekly target {goal.weeklyObjective} · {routines.length}{' '}
                      {routines.length === 1 ? 'routine' : 'routines'}
                    </Text>
                  </View>
                  <IconButton icon="edit" label={`Edit ${goal.title}`} onPress={() => setGoalDialog(goal)} size={36} />
                  <IconButton
                    icon="archive"
                    label={`Archive ${goal.title}`}
                    onPress={() => setArchiveTarget({ type: 'goal', id: goal.id, title: goal.title })}
                    size={36}
                  />
                </View>
                <View style={styles.routines}>
                  {routines.map((task) => (
                    <Pressable
                      key={task.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${task.title}`}
                      onPress={() => setTaskDialog(task)}
                      style={({ pressed }) => [
                        styles.routine,
                        { borderColor: colors.hairline, opacity: pressed ? 0.75 : 1 },
                      ]}
                    >
                      <View style={styles.routineBody}>
                        <Text variant="bodySm" numberOfLines={2}>{task.title}</Text>
                        <Text variant="caption" tone="muted">{EFFORT_LABEL[task.effort]}</Text>
                      </View>
                      <EffortDots effort={task.effort} showLabel={false} />
                      <Icon name="chevron-right" size={15} color={colors.inkSoft} />
                    </Pressable>
                  ))}
                  <Button
                    variant="quiet"
                    small
                    icon="plus"
                    onPress={() => {
                      setTaskGoalId(goal.id)
                      setTaskDialog(null)
                    }}
                  >
                    Add routine
                  </Button>
                </View>
              </Panel>
            )
          })
        )}
        <Text variant="caption" tone="soft">
          A run needs at least {MIN_ACTIVE_TASKS} active routines across its active goals.
        </Text>
      </View>

      {archivedGoals.length > 0 || archivedTasks.length > 0 ? (
        <View style={styles.section}>
          <Text variant="micro" tone="muted">ARCHIVED</Text>
          {archivedGoals.map((goal) => (
            <Panel key={goal.id}>
              <View style={styles.goalHead}>
                <View style={[styles.crest, { backgroundColor: colors.surfaceSunken, borderColor: colors.hairline }]}>
                  <Icon name={goal.icon} size={18} color={colors.inkSoft} />
                </View>
                <View style={styles.goalBody}>
                  <Text variant="headingSm" tone="muted">{goal.title}</Text>
                  <Text variant="caption" tone="soft">Archived goal · {goal.category}</Text>
                </View>
                <Button small variant="secondary" onPress={() => submitGoal({ ...goal, active: true })}>
                  Restore
                </Button>
              </View>
            </Panel>
          ))}
          {archivedTasks.map((task) => {
            const goal = document.goals.find((candidate) => candidate.id === task.goalId)
            return (
              <Panel key={task.id}>
                <View style={styles.goalHead}>
                  <View style={styles.routineBody}>
                    <Text variant="bodySm" tone="muted">{task.title}</Text>
                    <Text variant="caption" tone="soft">{goal?.title ?? 'No goal'} · archived routine</Text>
                  </View>
                  <Button small variant="secondary" onPress={() => submitTask({ ...task, active: true })}>
                    Restore
                  </Button>
                </View>
              </Panel>
            )
          })}
        </View>
      ) : null}

      <GoalFormDialog
        visible={goalDialog !== undefined}
        goal={goalDialog ?? null}
        goals={document.goals}
        onClose={() => setGoalDialog(undefined)}
        onSubmit={submitGoal}
      />
      <TaskFormDialog
        visible={taskDialog !== undefined}
        task={taskDialog ?? null}
        goals={document.goals}
        defaultGoalId={taskGoalId}
        onClose={() => {
          setTaskDialog(undefined)
          setTaskGoalId(undefined)
        }}
        onSubmit={submitTask}
      />

      <Dialog
        visible={archiveTarget !== null}
        title={`Archive ${archiveTarget?.type === 'goal' ? 'goal' : 'routine'}?`}
        onClose={() => setArchiveTarget(null)}
        actions={
          <>
            <Button variant="quiet" onPress={() => setArchiveTarget(null)}>Cancel</Button>
            <Button variant="danger" onPress={confirmArchive}>Archive</Button>
          </>
        }
      >
        <Text variant="bodySm" tone="muted">
          {archiveTarget?.type === 'goal'
            ? `“${archiveTarget.title}” and its routines will stop appearing on new maps. The current map keeps its steps.`
            : `“${archiveTarget?.title}” will stop appearing on new maps. The current map keeps its steps.`}
        </Text>
        <Text variant="caption" tone="soft" style={styles.archiveNote}>
          The domain still guards the last active goal and the minimum number of routines.
        </Text>
      </Dialog>
    </Screen>
  )
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  aims: { gap: space.sm },
  aim: { gap: 4 },
  aimHead: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  aimTitle: { flex: 1 },
  goalHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  crest: { width: 38, height: 38, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  goalBody: { flex: 1, gap: 2 },
  routines: { gap: space.xs, marginTop: space.sm },
  routine: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: radius.md, padding: space.sm },
  routineBody: { flex: 1, gap: 2 },
  archiveNote: { marginTop: space.sm },
})
