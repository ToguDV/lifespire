import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import type { Goal, GoalInput, Task, TaskInput } from '@lifespire/core'
import { MAX_GOALS } from '@lifespire/core'
import { EFFORT_LABEL } from '@lifespire/app-core/ui/format'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { AimRow } from '../components/AimRow'
import { Button } from '../components/Button'
import { Dialog } from '../components/Dialog'
import { EffortDots } from '../components/EffortDots'
import { EmptyState } from '../components/EmptyState'
import { GoalFormDialog } from '../components/GoalFormDialog'
import { Icon } from '../components/Icon'
import { IconButton } from '../components/IconButton'
import { Panel, PanelHead, ScreenHead } from '../components/Panel'
import { Screen } from '../components/Screen'
import { TaskFormDialog } from '../components/TaskFormDialog'
import { Text } from '../components/Text'
import { useAppStore } from '../state/store'

interface ArchiveState {
  type: 'goal' | 'task'
  id: string
  title: string
}

interface WeekRow {
  goalId: string
  title: string
  progress: number
  target: number
}

export function GoalsScreen() {
  const { colors } = useTheme()
  const document = useAppStore((state) => state.document)
  const saveGoal = useAppStore((state) => state.saveGoal)
  const archiveGoal = useAppStore((state) => state.archiveGoal)
  const saveTask = useAppStore((state) => state.saveTask)
  const archiveTask = useAppStore((state) => state.archiveTask)
  const showToast = useAppStore((state) => state.showToast)
  const run = document.run
  const [goalDialog, setGoalDialog] = useState<Goal | null | undefined>(undefined)
  const [goalError, setGoalError] = useState<string | null>(null)
  const [taskDialog, setTaskDialog] = useState<Task | null | undefined>(undefined)
  const [taskGoalId, setTaskGoalId] = useState<string | undefined>(undefined)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<ArchiveState | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const activeGoals = document.goals.filter((goal) => goal.active)
  const activeGoalIds = new Set(activeGoals.map((goal) => goal.id))
  const activeTasks = document.tasks.filter(
    (task) => task.active && activeGoalIds.has(task.goalId),
  )
  const archivedGoals = document.goals.filter((goal) => !goal.active)
  const archivedTasks = document.tasks.filter((task) => !task.active)
  const archivedCount = archivedGoals.length + archivedTasks.length

  const weekRows: WeekRow[] = run
    ? run.objectives.map((objective) => ({
        goalId: objective.goalId,
        title: objective.goalTitle,
        progress: objective.progress,
        target: objective.target,
      }))
    : activeGoals.map((goal) => ({
        goalId: goal.id,
        title: goal.title,
        progress: 0,
        target: goal.weeklyObjective,
      }))

  const totalTarget = weekRows.reduce((total, row) => total + row.target, 0)
  const totalProgress = weekRows.reduce(
    (total, row) => total + Math.min(row.progress, row.target),
    0,
  )

  const goalsLabel = `${activeGoals.length} active ${activeGoals.length === 1 ? 'goal' : 'goals'}`
  const subtitle =
    activeGoals.length === 0
      ? 'No active goals yet. Add one to shape the next run.'
      : run?.status === 'active'
        ? `${goalsLabel} shape maps from now on. This week's targets stay fixed.`
        : `${goalsLabel} · ${activeTasks.length} active routines.`

  const openGoalDialog = (goal: Goal | null) => {
    setGoalError(null)
    setGoalDialog(goal)
  }

  const closeGoalDialog = () => {
    setGoalDialog(undefined)
    setGoalError(null)
  }

  const openTaskDialog = (task: Task | null, goalId?: string) => {
    setTaskError(null)
    setTaskGoalId(goalId)
    setTaskDialog(task)
  }

  const closeTaskDialog = () => {
    setTaskDialog(undefined)
    setTaskGoalId(undefined)
    setTaskError(null)
  }

  const submitGoal = (input: GoalInput) => {
    const result = saveGoal(input)
    if (result.ok) {
      closeGoalDialog()
      return
    }
    setGoalError(result.errors.join(' '))
  }

  const submitTask = (input: TaskInput) => {
    const result = saveTask(input)
    if (result.ok) {
      closeTaskDialog()
      return
    }
    setTaskError(result.errors.join(' '))
  }

  const requestArchive = (type: 'goal' | 'task', id: string, title: string) => {
    setArchiveError(null)
    setArchiveTarget({ type, id, title })
  }

  const confirmArchive = () => {
    if (!archiveTarget) return
    const result =
      archiveTarget.type === 'goal'
        ? archiveGoal(archiveTarget.id)
        : archiveTask(archiveTarget.id)
    if (result.ok) {
      setArchiveTarget(null)
      setArchiveError(null)
      return
    }
    setArchiveError(result.errors.join(' '))
  }

  const restoreGoal = (goal: Goal) => {
    const result = saveGoal({ ...goal, active: true })
    if (!result.ok) showToast(result.errors.join(' '))
  }

  const restoreTask = (task: Task) => {
    const result = saveTask({ ...task, active: true })
    if (!result.ok) showToast(result.errors.join(' '))
  }

  return (
    <Screen>
      <ScreenHead kicker="The week's shape" title="Goals" subtitle={subtitle} />
      <View style={styles.headerActions}>
        <Button
          small
          variant="secondary"
          icon="plus"
          onPress={() => openTaskDialog(null, activeGoals[0]?.id)}
          disabled={activeGoals.length === 0}
          accessibilityHint={activeGoals.length === 0 ? 'Add an active goal first.' : undefined}
        >
          Add routine
        </Button>
        <Button small variant="secondary" icon="plus" onPress={() => openGoalDialog(null)}>
          Add goal
        </Button>
      </View>

      {activeGoals.length === 0 ? (
        <EmptyState
          icon="banner"
          kicker="The goals"
          title="No active goals yet."
          action={
            <Button icon="plus" onPress={() => openGoalDialog(null)}>
              Add your first goal
            </Button>
          }
        >
          Add a goal and at least four routines before the next run. Maps already drawn keep
          their original steps.
        </EmptyState>
      ) : (
        <View style={styles.goalList}>
          {activeGoals.map((goal) => {
            const routines = activeTasks.filter((task) => task.goalId === goal.id)
            return (
              <Panel key={goal.id}>
                <View style={styles.goalHead}>
                  <View
                    style={[
                      styles.crest,
                      { backgroundColor: colors.surfaceRaised, borderColor: colors.hairline },
                    ]}
                  >
                    <Icon name={goal.icon} size={18} color={colors.accentDeep} />
                  </View>
                  <View style={styles.goalBody}>
                    <Text variant="headingMd">{goal.title}</Text>
                    <Text variant="caption" tone="muted">
                      {goal.category.trim() || 'General'} · weekly target {goal.weeklyObjective} ·{' '}
                      {routines.length} {routines.length === 1 ? 'routine' : 'routines'}
                    </Text>
                  </View>
                  <IconButton
                    icon="edit"
                    label={`Edit goal ${goal.title}`}
                    onPress={() => openGoalDialog(goal)}
                  />
                  <IconButton
                    icon="archive"
                    label={`Archive goal ${goal.title}`}
                    onPress={() => requestArchive('goal', goal.id, goal.title)}
                  />
                </View>
                <View style={styles.routines}>
                  {routines.length === 0 ? (
                    <Text variant="caption" tone="soft">
                      No active routines under this goal yet.
                    </Text>
                  ) : (
                    routines.map((task) => (
                      <View
                        key={task.id}
                        style={[styles.routine, { borderColor: colors.hairline }]}
                      >
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Edit routine ${task.title}`}
                          onPress={() => openTaskDialog(task, goal.id)}
                          android_ripple={{ color: colors.accentWash }}
                          style={({ pressed }) => [
                            styles.routineMain,
                            pressed ? { opacity: 0.75 } : null,
                          ]}
                        >
                          <View style={styles.routineBody}>
                            <Text variant="bodySm" numberOfLines={2}>
                              {task.title}
                            </Text>
                            <Text variant="caption" tone="muted">
                              {EFFORT_LABEL[task.effort]} effort
                            </Text>
                          </View>
                          <EffortDots effort={task.effort} showLabel={false} />
                        </Pressable>
                        <IconButton
                          icon="archive"
                          label={`Archive routine ${task.title}`}
                          onPress={() => requestArchive('task', task.id, task.title)}
                        />
                      </View>
                    ))
                  )}
                  <Button
                    variant="quiet"
                    small
                    icon="plus"
                    onPress={() => openTaskDialog(null, goal.id)}
                  >
                    Add routine to this goal
                  </Button>
                </View>
              </Panel>
            )
          })}
        </View>
      )}

      <Panel>
        <PanelHead
          label="Week at a glance"
          aside={
            <Text variant="micro" tone="deep">
              {totalProgress} / {totalTarget}
            </Text>
          }
        />
        {weekRows.length === 0 ? (
          <Text variant="bodySm" tone="muted">
            No goals to show.
          </Text>
        ) : (
          <View style={styles.weekList}>
            {weekRows.map((row) => {
              const goal = document.goals.find((candidate) => candidate.id === row.goalId)
              return (
                <AimRow
                  key={row.goalId}
                  icon={goal?.icon ?? 'banner'}
                  title={row.title}
                  progress={row.progress}
                  target={row.target}
                />
              )
            })}
          </View>
        )}
        {run ? (
          <Text variant="caption" tone="soft" style={styles.weekNote}>
            These targets were fixed when the run began. Editing goals shapes the next run.
          </Text>
        ) : null}
      </Panel>

      {archivedCount > 0 ? (
        <Panel>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Archived · ${archivedCount}`}
            accessibilityState={{ expanded: showArchived }}
            accessibilityHint={
              showArchived
                ? 'Hide archived goals and routines.'
                : 'Show archived goals and routines.'
            }
            onPress={() => setShowArchived((value) => !value)}
          >
            <PanelHead
              label={`Archived · ${archivedCount}`}
              aside={
                <View style={styles.archivedToggle}>
                  <Text variant="caption" tone="muted">
                    {showArchived ? 'Hide' : 'Show'}
                  </Text>
                  <View style={showArchived ? styles.chevronOpen : undefined}>
                    <Icon name="chevron-right" size={15} color={colors.inkMuted} />
                  </View>
                </View>
              }
            />
          </Pressable>
          {showArchived ? (
            <View style={styles.archivedBody}>
              <Text variant="bodySm" tone="muted">
                Archived content never changes a map that was already drawn. Restoring it only
                affects future maps.
              </Text>

              {archivedGoals.length > 0 ? (
                <View style={styles.archivedGroup}>
                  <Text variant="micro" tone="muted">
                    GOALS
                  </Text>
                  {archivedGoals.map((goal) => {
                    const blocked = activeGoals.length >= MAX_GOALS
                    return (
                      <View key={goal.id} style={styles.archivedRow}>
                        <View style={styles.goalBody}>
                          <Text variant="bodySm">{goal.title || 'Untitled goal'}</Text>
                          <Text variant="caption" tone="soft">
                            {goal.category.trim() || 'General'} · {goal.weeklyObjective} each week
                          </Text>
                        </View>
                        <Button
                          small
                          variant="secondary"
                          onPress={() => restoreGoal(goal)}
                          disabled={blocked}
                          accessibilityHint={
                            blocked
                              ? 'Archive an active goal before restoring another.'
                              : undefined
                          }
                        >
                          Restore goal
                        </Button>
                      </View>
                    )
                  })}
                </View>
              ) : null}

              {archivedTasks.length > 0 ? (
                <View style={styles.archivedGroup}>
                  <Text variant="micro" tone="muted">
                    ROUTINES
                  </Text>
                  {archivedTasks.map((task) => {
                    const goal = document.goals.find(
                      (candidate) => candidate.id === task.goalId,
                    )
                    const goalActive = Boolean(goal?.active)
                    return (
                      <View key={task.id} style={styles.archivedRow}>
                        <View style={styles.goalBody}>
                          <Text variant="bodySm">{task.title || 'Untitled routine'}</Text>
                          <Text variant="caption" tone="soft">
                            {EFFORT_LABEL[task.effort]} effort ·{' '}
                            {goal?.title ?? 'Goal no longer present'}
                          </Text>
                        </View>
                        <Button
                          small
                          variant="secondary"
                          onPress={() => restoreTask(task)}
                          disabled={!goalActive}
                          accessibilityHint={
                            goalActive
                              ? undefined
                              : 'Restore its goal before restoring this routine.'
                          }
                        >
                          Restore routine
                        </Button>
                      </View>
                    )
                  })}
                </View>
              ) : null}
            </View>
          ) : null}
        </Panel>
      ) : null}

      <View style={styles.quietNote}>
        <Icon name="quill" size={15} color={colors.inkSoft} />
        <Text variant="caption" tone="soft" style={styles.quietNoteText}>
          Goals and routines can be edited at any time. A map already drawn keeps its original
          steps and rewards.
        </Text>
      </View>

      <GoalFormDialog
        visible={goalDialog !== undefined}
        goal={goalDialog ?? null}
        goals={document.goals}
        onClose={closeGoalDialog}
        onSubmit={submitGoal}
        onArchive={(goal) => requestArchive('goal', goal.id, goal.title)}
        submitError={goalError}
      />
      <TaskFormDialog
        visible={taskDialog !== undefined}
        task={taskDialog ?? null}
        goals={document.goals}
        defaultGoalId={taskGoalId}
        onClose={closeTaskDialog}
        onSubmit={submitTask}
        submitError={taskError}
      />

      <Dialog
        visible={archiveTarget !== null}
        eyebrow={archiveTarget?.type === 'goal' ? 'Goals' : 'Routines'}
        title={`Archive “${archiveTarget?.title ?? ''}”?`}
        description={
          archiveTarget?.type === 'goal'
            ? 'This goal and its routines leave future maps. Maps already drawn keep their original steps, and this week’s targets do not change.'
            : 'This routine leaves future maps. Maps already drawn keep their original step, and this week’s targets do not change.'
        }
        onClose={() => {
          setArchiveTarget(null)
          setArchiveError(null)
        }}
        actions={
          <>
            <Button
              variant="quiet"
              onPress={() => {
                setArchiveTarget(null)
                setArchiveError(null)
              }}
            >
              Keep {archiveTarget?.type === 'goal' ? 'goal' : 'routine'}
            </Button>
            <Button variant="danger" icon="archive" onPress={confirmArchive}>
              Archive
            </Button>
          </>
        }
      >
        {archiveError ? (
          <View
            accessibilityRole="alert"
            style={[
              styles.alert,
              { borderColor: colors.hairlineStrong, backgroundColor: colors.surfaceSunken },
            ]}
          >
            <Text variant="caption" style={{ color: colors.inkStrong }}>
              This cannot be archived yet
            </Text>
            <Text variant="bodySm" style={{ color: colors.inkStrong }}>
              {archiveError}
            </Text>
          </View>
        ) : (
          <Text variant="bodySm" tone="muted">
            Archived content stays in your saved file and can be restored from the goals screen.
          </Text>
        )}
      </Dialog>
    </Screen>
  )
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.xs },
  goalList: { gap: space.md },
  goalHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  crest: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalBody: { flex: 1, minWidth: 0, gap: 2 },
  routines: { gap: space.xs, marginTop: space.sm },
  routine: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingLeft: space.sm,
  },
  routineMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
  },
  routineBody: { flex: 1, minWidth: 0, gap: 2 },
  weekList: { gap: 2 },
  weekNote: { marginTop: space.sm },
  archivedToggle: { flexDirection: 'row', alignItems: 'center', gap: space.xxs },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  archivedBody: { gap: space.md },
  archivedGroup: { gap: space.sm },
  archivedRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  // 6px icon-text rhythm; no token covers it.
  quietNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  quietNoteText: { flex: 1 },
  alert: {
    gap: space.xxs,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
  },
})
