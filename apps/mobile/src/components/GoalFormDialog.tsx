import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Switch, View } from 'react-native'
import type { Goal, GoalInput, GoalIconId } from '@lifespire/core'
import { isGoalIconId, nextGoalIcon } from '@lifespire/core'
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
}: {
  visible: boolean
  goal?: Goal | null
  goals: Goal[]
  onClose: () => void
  onSubmit: (input: GoalInput) => void
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
      title={goal ? 'Edit goal' : 'New goal'}
      onClose={onClose}
      actions={
        <>
          <Button variant="quiet" onPress={onClose}>
            Cancel
          </Button>
          <Button onPress={submit}>{goal ? 'Save goal' : 'Add goal'}</Button>
        </>
      }
    >
      <View style={styles.form}>
        <Field label="Goal name" error={error}>
          <Input
            value={title}
            onChangeText={(value) => {
              setTitle(value)
              if (error) setError(null)
            }}
            placeholder="Get fit"
            autoFocus
            returnKeyType="next"
          />
        </Field>
        <Field label="Category (optional)">
          <Input value={category} onChangeText={setCategory} placeholder="Body" />
        </Field>
        <Field label="Weekly target" hint="How many routines of this goal you want to finish this week.">
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
        <Field label="Crest">
          <IconPicker
            value={isGoalIconId(icon) ? icon : 'banner'}
            onChange={setIcon}
          />
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
