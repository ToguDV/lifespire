import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Switch, View } from 'react-native'
import type { Goal, GoalInput, GoalIconId } from '@lifespire/core'
import { nextGoalIcon } from '@lifespire/core'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { Field, Input } from './Field'
import { IconPicker } from './IconPicker'
import { Text } from './Text'

/**
 * Decides whether a goal/task dialog must reset its draft. The dialog stays
 * mounted while `goals` sync in the background, so a goals-array refresh with
 * the dialog open must keep the typed draft: reset only on the closed→open
 * transition (including the first mount while open) or when the edited
 * entity's id changes.
 */
export function dialogDraftShouldReset(
  prev: { visible: boolean; id: string | null | undefined },
  next: { visible: boolean; id: string | null | undefined },
): boolean {
  if (!next.visible) return false
  if (!prev.visible) return true
  return (prev.id ?? null) !== (next.id ?? null)
}

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
  const draftRef = useRef<{ visible: boolean; id: string | undefined }>({
    visible: false,
    id: undefined,
  })

  useEffect(() => {
    const prev = draftRef.current
    const next = { visible, id: goal?.id }
    draftRef.current = next
    // A background sync refreshes `goals` with the dialog open: keep the
    // typed draft unless the dialog just opened or another goal is edited.
    if (!dialogDraftShouldReset(prev, next)) return
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
      eyebrow="Goals"
      title={goal ? 'Edit goal' : 'Add a goal'}
      description={
        goal ? 'Edits shape future maps.' : 'A goal holds the routines that move it.'
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
          <Button onPress={submit}>Save goal</Button>
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
        <Field label="Goal icon">
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
          <Text variant="bodySm" style={styles.switchLabel}>
            Active
          </Text>
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
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
  },
  switchLabel: { flex: 1 },
})
