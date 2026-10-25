import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native'
import type { Effort, Goal, Task, TaskInput } from '@lifespire/core'
import { EFFORT_LABEL } from '@lifespire/app-core/ui/format'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { EffortDots } from './EffortDots'
import { Field, Input } from './Field'
import { dialogDraftShouldReset } from './GoalFormDialog'
import { Icon } from './Icon'
import { Text } from './Text'

// Re-exported so the task dialog test covers the same draft guard.
export { dialogDraftShouldReset }

export function TaskFormDialog({
  visible,
  task,
  goals,
  defaultGoalId,
  onClose,
  onSubmit,
  submitError,
}: {
  visible: boolean
  task?: Task | null
  goals: Goal[]
  defaultGoalId?: string
  onClose: () => void
  onSubmit: (input: TaskInput) => void
  submitError?: string | null
}) {
  const { colors } = useTheme()
  const activeGoals = useMemo(() => goals.filter((goal) => goal.active), [goals])
  const firstGoalId = activeGoals[0]?.id ?? ''
  const [title, setTitle] = useState('')
  const [goalId, setGoalId] = useState('')
  const [effort, setEffort] = useState<Effort>('medium')
  const [active, setActive] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const noActiveGoals = activeGoals.length === 0
  const draftRef = useRef<{ visible: boolean; id: string | undefined }>({
    visible: false,
    id: undefined,
  })

  useEffect(() => {
    const prev = draftRef.current
    const next = { visible, id: task?.id }
    draftRef.current = next
    // A background sync refreshes `goals` with the dialog open: keep the
    // typed draft unless the dialog just opened or another routine is edited.
    if (!dialogDraftShouldReset(prev, next)) return
    const preferredGoalId = task?.goalId ?? defaultGoalId
    const selectedGoalId = activeGoals.some((goal) => goal.id === preferredGoalId)
      ? (preferredGoalId ?? '')
      : firstGoalId
    setTitle(task?.title ?? '')
    setGoalId(selectedGoalId)
    setEffort(task?.effort ?? 'medium')
    setActive(task?.active ?? true)
    setError(null)
  }, [visible, task, defaultGoalId, firstGoalId, activeGoals])

  const submit = () => {
    if (!title.trim()) {
      setError('Give this routine a name.')
      return
    }
    if (!goalId) {
      setError('Choose a goal for this routine.')
      return
    }
    onSubmit({
      id: task?.id,
      createdAt: task?.createdAt,
      goalId,
      title: title.trim(),
      effort,
      active,
    })
  }

  return (
    <Dialog
      visible={visible}
      eyebrow="Routines"
      title={task ? 'Edit routine' : 'Add a routine'}
      description="Edits only shape maps drawn after this change."
      onClose={onClose}
      actions={
        <>
          <Button variant="quiet" onPress={onClose}>
            Cancel
          </Button>
          <Button onPress={submit} disabled={noActiveGoals}>
            {task ? 'Save routine' : 'Add routine'}
          </Button>
        </>
      }
    >
      <View style={styles.form}>
        {submitError ? (
          <View
            accessibilityRole="alert"
            style={[
              styles.alert,
              { borderColor: colors.hairlineStrong, backgroundColor: colors.surfaceSunken },
            ]}
          >
            <Text variant="caption" style={{ color: colors.inkStrong }}>
              This routine was not saved
            </Text>
            <Text variant="bodySm" style={{ color: colors.inkStrong }}>
              {submitError}
            </Text>
          </View>
        ) : null}
        {noActiveGoals ? (
          <Text variant="bodySm" tone="muted">
            Add an active goal first. Every routine needs an active goal.
          </Text>
        ) : null}
        <Field label="Routine title" error={error}>
          <Input
            value={title}
            onChangeText={(value) => {
              setTitle(value)
              if (error) setError(null)
            }}
            placeholder="e.g. Walk the north trail"
            autoFocus
          />
        </Field>
        <Field label="Belongs to">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.goals}
          >
            {activeGoals.map((goal) => {
              const selected = goal.id === goalId
              return (
                <Pressable
                  key={goal.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setGoalId(goal.id)
                    if (error) setError(null)
                  }}
                  style={[
                    styles.goal,
                    {
                      borderColor: selected ? colors.accent : colors.hairline,
                      backgroundColor: selected ? colors.accentSoft : colors.surface,
                    },
                  ]}
                >
                  <Icon
                    name={goal.icon}
                    size={15}
                    color={selected ? colors.accentDeep : colors.inkMuted}
                  />
                  <Text variant="bodySm" numberOfLines={1}>
                    {goal.title}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        </Field>
        <Field label="Effort" hint="Effort changes the reward, never the weekly progress.">
          <View style={styles.efforts}>
            {(['light', 'medium', 'high'] as const).map((value) => {
              const selected = value === effort
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setEffort(value)}
                  style={[
                    styles.effort,
                    {
                      borderColor: selected ? colors.accent : colors.hairline,
                      backgroundColor: selected ? colors.accentSoft : colors.surface,
                    },
                  ]}
                >
                  <EffortDots effort={value} showLabel={false} />
                  <Text variant="caption" tone={selected ? 'deep' : 'muted'}>
                    {EFFORT_LABEL[value]}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </Field>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: active }}
          onPress={() => setActive((value) => !value)}
          style={[styles.switchRow, { borderColor: colors.hairline }]}
        >
          <View style={styles.switchCopy}>
            <Text variant="bodySm">Active in this run</Text>
            <Text variant="caption" tone="muted">
              Archived routines keep their history and stop appearing on new maps.
            </Text>
          </View>
          <Switch
            value={active}
            onValueChange={setActive}
            trackColor={{ true: colors.accent, false: colors.surfaceSunken }}
            thumbColor={colors.surfaceRaised}
            // The outer Pressable is the single switch control; the native
            // toggle is visual only and hidden from TalkBack.
            pointerEvents="none"
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          />
        </Pressable>
      </View>
    </Dialog>
  )
}

const styles = StyleSheet.create({
  form: { gap: space.md },
  alert: {
    gap: space.xxs,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
  },
  goals: { flexDirection: 'row', gap: space.xs, paddingRight: space.xs },
  goal: {
    flexDirection: 'row',
    alignItems: 'center',
    // 48 dp touch target, like Button's minTouch: the chip content stays
    // vertically centered by alignItems.
    minHeight: 48,
    gap: space.xs,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    maxWidth: 220,
  },
  efforts: { flexDirection: 'row', gap: space.xs },
  effort: {
    flex: 1,
    alignItems: 'center',
    gap: space.xxs,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: space.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
  },
  switchCopy: { flex: 1, gap: 2 },
})
