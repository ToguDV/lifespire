import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Switch, View } from 'react-native'
import type { Goal, GoalInput, GoalIconId } from '@lifespire/core'
import { MAX_GOALS, nextGoalIcon } from '@lifespire/core'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { Field, Input } from './Field'
import { IconPicker } from './IconPicker'
import { Text } from './Text'

export function GoalFormDialog({
  visible,
  goal,
  goals,
  onClose,
  onSubmit,
  onArchive,
  submitError,
}: {
  visible: boolean
  goal?: Goal | null
  goals: Goal[]
  onClose: () => void
  onSubmit: (input: GoalInput) => void
  onArchive?: (goal: Goal) => void
  submitError?: string | null
}) {
  const { colors } = useTheme()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [icon, setIcon] = useState<GoalIconId>('banner')
  const [weeklyObjective, setWeeklyObjective] = useState(3)
  const [active, setActive] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) return
    setTitle(goal?.title ?? '')
    setCategory(goal?.category ?? '')
    setIcon(goal?.icon ?? nextGoalIcon(goals))
    setWeeklyObjective(goal?.weeklyObjective ?? 3)
    setActive(goal?.active ?? true)
    setError(null)
  }, [visible, goal, goals])

  const submit = () => {
    if (!title.trim()) {
      setError('Give this goal a name.')
      return
    }
    onSubmit({
      id: goal?.id,
      createdAt: goal?.createdAt,
      title: title.trim(),
      category: category.trim() || 'General',
      icon,
      weeklyObjective,
      active,
    })
  }

  return (
    <Dialog
      visible={visible}
      eyebrow="The week's shape"
      title={goal ? 'Edit goal' : 'Add a goal'}
      description={
        goal
          ? 'Title and category shape maps drawn from now on. The icon updates across this run; weekly targets stay fixed.'
          : `A goal holds the routines that move it. A run can hold up to ${MAX_GOALS} active goals.`
      }
      onClose={onClose}
      actions={
        <>
          {goal && onArchive ? (
            <Button
              variant="danger"
              icon="archive"
              onPress={() => {
                onClose()
                onArchive(goal)
              }}
            >
              Archive goal
            </Button>
          ) : null}
          <Button variant="quiet" onPress={onClose}>
            Cancel
          </Button>
          <Button onPress={submit}>{goal ? 'Save goal' : 'Add goal'}</Button>
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
              This goal was not saved
            </Text>
            <Text variant="bodySm" style={{ color: colors.inkStrong }}>
              {submitError}
            </Text>
          </View>
        ) : null}
        <Field label="Goal title" error={error}>
          <Input
            value={title}
            onChangeText={(value) => {
              setTitle(value)
              if (error) setError(null)
            }}
            placeholder="e.g. Move under open sky"
            autoFocus
            returnKeyType="next"
          />
        </Field>
        <Field label="Category">
          <Input value={category} onChangeText={setCategory} placeholder="e.g. Movement" />
        </Field>
        <Field label="Goal icon" hint="The crest marks this goal on maps and in weekly progress.">
          <IconPicker value={icon} onChange={setIcon} />
        </Field>
        <Field
          label="Weekly target"
          hint="How many routines of this goal you want to complete this week (1–7)."
        >
          <View style={styles.stepper}>
            <Button
              variant="secondary"
              small
              accessibilityLabel="Decrease weekly target"
              onPress={() => setWeeklyObjective((value) => Math.max(1, value - 1))}
            >
              −
            </Button>
            <Text variant="headingMd">{weeklyObjective}</Text>
            <Button
              variant="secondary"
              small
              accessibilityLabel="Increase weekly target"
              onPress={() => setWeeklyObjective((value) => Math.min(7, value + 1))}
            >
              +
            </Button>
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
              Archived goals keep their history and stop appearing on new maps.
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
  alert: {
    gap: space.xxs,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.md },
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
