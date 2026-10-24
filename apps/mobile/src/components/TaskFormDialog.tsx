import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Switch, View } from 'react-native'
import type { Effort, Goal, Task, TaskInput } from '@lifespire/core'
import { EFFORT_LABEL } from '@lifespire/app-core/ui/format'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { EffortDots } from './EffortDots'
import { Field, Input } from './Field'
import { Icon } from './Icon'
import { Text } from './Text'

export function TaskFormDialog({
  visible,
  task,
  goals,
  defaultGoalId,
  onClose,
  onSubmit,
}: {
  visible: boolean
  task?: Task | null
  goals: Goal[]
  defaultGoalId?: string
  onClose: () => void
  onSubmit: (input: TaskInput) => void
}) {
  const { colors } = useTheme()
  const activeGoals = goals.filter((goal) => goal.active)
  const firstGoalId = activeGoals[0]?.id ?? ''
  const [title, setTitle] = useState('')
  const [goalId, setGoalId] = useState('')
  const [effort, setEffort] = useState<Effort>('medium')
  const [active, setActive] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) return
    setTitle(task?.title ?? '')
    setGoalId(task?.goalId ?? defaultGoalId ?? firstGoalId)
    setEffort(task?.effort ?? 'medium')
    setActive(task?.active ?? true)
    setError(null)
  }, [visible, task, defaultGoalId, firstGoalId])

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
      title={task ? 'Edit routine' : 'New routine'}
      onClose={onClose}
      actions={
        <>
          <Button variant="quiet" onPress={onClose}>
            Cancel
          </Button>
          <Button onPress={submit}>{task ? 'Save routine' : 'Add routine'}</Button>
        </>
      }
    >
      <View style={styles.form}>
        <Field label="Routine" error={error}>
          <Input
            value={title}
            onChangeText={(value) => {
              setTitle(value)
              if (error) setError(null)
            }}
            placeholder="Walk for 30 minutes"
            autoFocus
          />
        </Field>
        <Field label="Goal">
          <View style={styles.goals}>
            {activeGoals.map((goal) => {
              const selected = goal.id === goalId
              return (
                <Pressable
                  key={goal.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setGoalId(goal.id)}
                  style={[
                    styles.goal,
                    {
                      borderColor: selected ? colors.accent : colors.hairline,
                      backgroundColor: selected ? colors.accentSoft : colors.surface,
                    },
                  ]}
                >
                  <Icon name={goal.icon} size={15} color={selected ? colors.accentDeep : colors.inkMuted} />
                  <Text variant="bodySm" numberOfLines={1}>
                    {goal.title}
                  </Text>
                </Pressable>
              )
            })}
          </View>
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
          />
        </Pressable>
      </View>
    </Dialog>
  )
}

const styles = StyleSheet.create({
  form: { gap: space.md },
  goals: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  goal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    maxWidth: '100%',
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
