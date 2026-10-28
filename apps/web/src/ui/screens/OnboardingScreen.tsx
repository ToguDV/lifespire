import { useEffect, useId, useRef, useState } from 'react'
import { AIM_WITHOUT_ROUTINE, createDemoSetup, validateSetup } from '../../content/demo'
import {
  createEmptyDraft,
  draftToSetup,
  withSuggestedObjectives,
} from '../../content/onboarding'
import {
  MAX_GOALS,
  MAX_WEEKLY_OBJECTIVE,
  MIN_ACTIVE_TASKS,
  MIN_WEEKLY_OBJECTIVE,
} from '../../domain/balance'
import { validateGoalInput, validateTaskInput } from '../../domain/content'
import type { FieldErrors } from '../../domain/content'
import { nextGoalIcon } from '../../domain/goalIcons'
import type { Effort, Goal, Task } from '../../domain/types'
import { getNow } from '../../state/clock'
import { useAppStore } from '../../state/store'
import { Button, Icon, IconPicker, Panel, ThemeToggle } from '../components'
import { EFFORT_LABEL, goalIconName } from '../lib/format'

const STEP_LABELS = ['Origin', 'Quests', 'Eve'] as const
const EFFORTS: readonly Effort[] = ['light', 'medium', 'high']
/** Field messages this screen renders inline (`field-error`), so they never repeat in the summary. */
const FIELD_KEYS = ['title', 'weeklyObjective', 'goalId', 'description'] as const

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

/** Keeps only the step-level messages: anything rendered next to a field is dropped. */
function nonFieldErrors(errors: string[], fieldErrors: readonly FieldErrors[]): string[] {
  const inline = new Set(
    fieldErrors.flatMap((fields) =>
      FIELD_KEYS.map((key) => fields[key]).filter((value): value is string => Boolean(value)),
    ),
  )
  return errors.filter((error) => !inline.has(error))
}

export function OnboardingScreen() {
  const document = useAppStore((state) => state.document)
  const updateOnboardingDraft = useAppStore((state) => state.updateOnboardingDraft)
  const beginJourney = useAppStore((state) => state.beginJourney)
  const createId = useAppStore((state) => state.newId)

  const [showErrors, setShowErrors] = useState(false)
  const errorSummaryId = useId()
  const draft = document.onboardingDraft ?? createEmptyDraft()
  const goals = draft.goals
  const tasks = draft.tasks
  const rawStep = draft.mode === 'custom' ? draft.step : 0
  // Old 4-step drafts land on the new 3-step flow: the former review (4) is now the eve (3).
  const step = rawStep >= 4 ? 3 : rawStep
  const headingRef = useRef<HTMLHeadingElement>(null)
  const previousStep = useRef(0)

  useEffect(() => {
    if (previousStep.current === step) return
    previousStep.current = step
    if (step === 0) return
    headingRef.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [step])

  const updateGoals = (next: Goal[]) => updateOnboardingDraft({ goals: next })
  const updateTasks = (next: Task[]) => updateOnboardingDraft({ tasks: next })
  const updateGoal = (id: string, patch: Partial<Goal>) =>
    updateGoals(goals.map((goal) => (goal.id === id ? { ...goal, ...patch } : goal)))
  const updateTask = (id: string, patch: Partial<Task>) =>
    updateTasks(tasks.map((task) => (task.id === id ? { ...task, ...patch } : task)))

  const addGoal = () => {
    if (goals.length >= MAX_GOALS) return
    const goal: Goal = {
      id: createId('goal'),
      title: '',
      category: '',
      description: '',
      icon: nextGoalIcon(goals),
      weeklyObjective: 3,
      active: true,
      createdAt: getNow().toISOString(),
    }
    setShowErrors(false)
    updateGoals([...goals, goal])
  }

  const removeGoal = (id: string) => {
    updateGoals(goals.filter((goal) => goal.id !== id))
    updateTasks(tasks.filter((task) => task.goalId !== id))
  }

  const addTask = (goalId: string) => {
    const task: Task = {
      id: createId('task'),
      goalId,
      title: '',
      effort: 'medium',
      active: true,
      createdAt: getNow().toISOString(),
    }
    setShowErrors(false)
    updateTasks([...tasks, task])
  }

  const removeTask = (id: string) => {
    updateTasks(tasks.filter((task) => task.id !== id))
  }

  const goToStep = (next: number) => {
    setShowErrors(false)
    updateOnboardingDraft({ step: next })
  }

  const startCustom = () => {
    setShowErrors(false)
    updateOnboardingDraft({ mode: 'custom', step: 1 })
  }

  const beginDemo = () => {
    const at = getNow()
    const setup = createDemoSetup(at)
    beginJourney(setup, at)
  }

  const aimsErrors = (): string[] => {
    const errors: string[] = []
    if (goals.length < 1) errors.push('Choose at least one goal to begin.')
    if (goals.length > MAX_GOALS) {
      errors.push(`A run can hold at most ${MAX_GOALS} goals.`)
    }
    for (const goal of goals) errors.push(...unique(Object.values(validateGoalInput(goal))))
    return unique(errors)
  }

  const routineErrors = (): string[] => {
    const errors: string[] = []
    const activeTasks = tasks.filter((task) => task.active)
    if (activeTasks.length < MIN_ACTIVE_TASKS) {
      errors.push(`Add at least ${MIN_ACTIVE_TASKS} routines to light the week.`)
    }
    for (const goal of goals) {
      if (goal.active && !activeTasks.some((task) => task.goalId === goal.id)) {
        errors.push(AIM_WITHOUT_ROUTINE)
      }
    }
    for (const task of tasks) {
      errors.push(...unique(Object.values(validateTaskInput(task, goals))))
    }
    return unique(errors)
  }

  const questErrors = (): string[] => unique([...aimsErrors(), ...routineErrors()])

  const continueFromQuests = () => {
    if (questErrors().length > 0) {
      setShowErrors(true)
      return
    }
    goToStep(3)
  }

  const beginCustom = () => {
    const validation = validateSetup(goals, tasks)
    if (!validation.ok) {
      setShowErrors(true)
      return
    }
    beginJourney(draftToSetup(draft), getNow())
  }

  const applySuggestions = () => {
    updateGoals(withSuggestedObjectives(goals, tasks))
  }

  const goalLabel = (index: number) => goals[index]?.title.trim() || `Quest ${index + 1}`
  const stepErrors =
    step === 2
      ? questErrors()
      : step === 3
        ? validateSetup(goals, tasks).errors
        : []
  const inlineFieldErrors =
    step === 2
      ? [
          ...goals.map((goal) => validateGoalInput(goal)),
          ...tasks.map((task) => validateTaskInput(task, goals)),
        ]
      : []
  const currentErrors = nonFieldErrors(stepErrors, inlineFieldErrors)

  const errorSummary =
    showErrors && currentErrors.length > 0 ? (
      <div className="form-alert" role="alert" id={errorSummaryId}>
        <strong>Before you continue</strong>
        <ul>
          {currentErrors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      </div>
    ) : null

  const renderGoalFields = (goal: Goal) => {
    const errors = validateGoalInput(goal)
    const weeklyErrorId = `goal-${goal.id}-weekly-error`
    const descriptionErrorId = `goal-${goal.id}-description-error`

    return (
      <div className="quest-card__fields" key={goal.id}>
        <div className="field-grid field-grid--quest">
          <div className="field">
            <label htmlFor={`goal-${goal.id}-category`}>Category</label>
            <input
              className="input"
              id={`goal-${goal.id}-category`}
              type="text"
              value={goal.category}
              placeholder="e.g. Movement"
              onChange={(event) => updateGoal(goal.id, { category: event.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor={`goal-${goal.id}-weekly`}>Weekly target</label>
            <input
              className="input"
              id={`goal-${goal.id}-weekly`}
              type="number"
              min={MIN_WEEKLY_OBJECTIVE}
              max={MAX_WEEKLY_OBJECTIVE}
              step={1}
              value={goal.weeklyObjective}
              aria-invalid={showErrors && Boolean(errors.weeklyObjective)}
              aria-describedby={
                showErrors && errors.weeklyObjective ? weeklyErrorId : undefined
              }
              onChange={(event) =>
                updateGoal(goal.id, { weeklyObjective: Number(event.target.value) })
              }
            />
            {showErrors && errors.weeklyObjective ? (
              <p className="field-error" id={weeklyErrorId}>
                {errors.weeklyObjective}
              </p>
            ) : null}
          </div>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor={`goal-${goal.id}-description`}>Description (optional)</label>
          <input
            className="input"
            id={`goal-${goal.id}-description`}
            type="text"
            value={goal.description ?? ''}
            maxLength={280}
            placeholder="Why does this quest matter?"
            aria-invalid={showErrors && Boolean(errors.description)}
            aria-describedby={
              showErrors && errors.description ? descriptionErrorId : undefined
            }
            onChange={(event) => updateGoal(goal.id, { description: event.target.value })}
          />
          {showErrors && errors.description ? (
            <p className="field-error" id={descriptionErrorId}>
              {errors.description}
            </p>
          ) : null}
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <IconPicker
            compact
            legend="Quest icon"
            name={`goal-${goal.id}-icon`}
            value={goal.icon}
            onChange={(icon) => updateGoal(goal.id, { icon })}
          />
        </div>
      </div>
    )
  }

  const renderTaskFields = (task: Task, hideGoal = false) => {
    const errors = validateTaskInput(task, goals)
    const titleErrorId = `task-${task.id}-title-error`
    const goalErrorId = `task-${task.id}-goal-error`

    return (
      <fieldset className="draft-card draft-card--routine" key={task.id} aria-label="Routine">
        <div className="field-grid field-grid--routine">
          <div className="field">
            <label htmlFor={`task-${task.id}-title`}>Routine title</label>
            <input
              className="input"
              id={`task-${task.id}-title`}
              type="text"
              value={task.title}
              placeholder="e.g. Walk the north trail"
              aria-invalid={showErrors && Boolean(errors.title)}
              aria-describedby={showErrors && errors.title ? titleErrorId : undefined}
              onChange={(event) => updateTask(task.id, { title: event.target.value })}
            />
            {showErrors && errors.title ? (
              <p className="field-error" id={titleErrorId}>
                {errors.title}
              </p>
            ) : null}
          </div>
          {hideGoal ? null : (
            <div className="field">
              <label htmlFor={`task-${task.id}-goal`}>Belongs to</label>
              <select
                className="input"
                id={`task-${task.id}-goal`}
                value={task.goalId}
                aria-invalid={showErrors && Boolean(errors.goalId)}
                aria-describedby={showErrors && errors.goalId ? goalErrorId : undefined}
                onChange={(event) => updateTask(task.id, { goalId: event.target.value })}
              >
                {goals.map((goal, index) => (
                  <option key={goal.id} value={goal.id}>
                    {goalLabel(index)}
                  </option>
                ))}
              </select>
              {showErrors && errors.goalId ? (
                <p className="field-error" id={goalErrorId}>
                  {errors.goalId}
                </p>
              ) : null}
            </div>
          )}
          <div className="field">
            <span className="field__label" id={`task-${task.id}-effort-label`}>
              Effort
            </span>
            <div
              className="segmented segmented--form"
              role="group"
              aria-labelledby={`task-${task.id}-effort-label`}
            >
              {EFFORTS.map((effort) => (
                <button
                  key={effort}
                  type="button"
                  aria-pressed={task.effort === effort}
                  onClick={() => updateTask(task.id, { effort })}
                >
                  {EFFORT_LABEL[effort]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="draft-card__actions">
          <Button variant="quiet" onClick={() => removeTask(task.id)}>
            Remove routine
          </Button>
        </div>
      </fieldset>
    )
  }

  const renderQuestCard = (goal: Goal, index: number) => {
    const goalTasks = tasks.filter((task) => task.goalId === goal.id)
    const goalErrors = validateGoalInput(goal)
    const titleErrorId = `quest-${goal.id}-title-error`
    return (
      <article className="quest-card" key={goal.id} aria-label={goalLabel(index)}>
        <div className="quest-card__head">
          <span className="draft-group__crest">
            <Icon name={goalIconName(goal.icon, index)} />
          </span>
          <div className="quest-card__titlewrap">
            <input
              className="input quest-card__title"
              type="text"
              value={goal.title}
              placeholder={`Quest ${index + 1} — e.g. Move under open sky`}
              aria-label={`Quest ${index + 1} title`}
              aria-invalid={showErrors && Boolean(goalErrors.title)}
              aria-describedby={showErrors && goalErrors.title ? titleErrorId : undefined}
              onChange={(event) => updateGoal(goal.id, { title: event.target.value })}
            />
            {showErrors && goalErrors.title ? (
              <p className="field-error" id={titleErrorId}>
                {goalErrors.title}
              </p>
            ) : null}
          </div>
          <Button variant="quiet" size="sm" onClick={() => removeGoal(goal.id)}>
            Remove
          </Button>
        </div>
        {renderGoalFields(goal)}
        <div className="quest-card__routines">
          {goalTasks.length === 0 ? (
            <p className="panel-note">No routines yet — add the first small step.</p>
          ) : (
            goalTasks.map((task) => renderTaskFields(task, true))
          )}
          <div>
            <Button variant="secondary" size="sm" onClick={() => addTask(goal.id)}>
              <Icon name="plus" />
              Add routine
            </Button>
          </div>
        </div>
      </article>
    )
  }

  if (step === 0) {
    return (
      <section className="screen screen--welcome" data-screen="welcome" aria-labelledby="welcome-title">
        <div className="welcome-top">
          <span className="brand" aria-label="LifeSpire">
            <Icon name="spire" className="brand__mark" />
            <span className="brand__word">LifeSpire</span>
          </span>
          <ThemeToggle />
        </div>

        <div className="welcome-grid">
          <div className="welcome-copy">
            <span className="kicker">A seven-day run</span>
            <h1 id="welcome-title">
              A day is a <em>path</em>.
            </h1>
            <p>
              Turn the routines that matter into a seven-day climb. Choose a route, keep a
              small promise, gather what you find.
            </p>

            <form
              className="welcome-form"
              onSubmit={(event) => {
                event.preventDefault()
                beginDemo()
              }}
            >
              <div className="welcome-actions">
                <Button type="submit" variant="primary">
                  Begin with demo data
                  <Icon name="chevron-right" />
                </Button>
                <Button variant="secondary" onClick={startCustom}>
                  Create my own path
                </Button>
              </div>
            </form>

            <div className="tutorial-cards" aria-label="How it plays">
              <div className="tutorial-card">
                <span className="tutorial-card__icon">
                  <Icon name="banner" />
                </span>
                <strong>1 · Pick a quest</strong>
                <p>One goal, one reason. Two quests are plenty to start.</p>
              </div>
              <div className="tutorial-card">
                <span className="tutorial-card__icon">
                  <Icon name="check" />
                </span>
                <strong>2 · Train tiny routines</strong>
                <p>Small steps you can keep daily. Four routines light the week.</p>
              </div>
              <div className="tutorial-card">
                <span className="tutorial-card__icon">
                  <Icon name="compass" />
                </span>
                <strong>3 · Climb one path</strong>
                <p>Each day is a map. Complete nodes, seal the boss, gather loot.</p>
              </div>
            </div>

            <p className="welcome-foot">
              <Icon name="lock" />
              Your save stays on this device. Nearby sync is optional.
            </p>

            <div className="welcome-ornament" aria-hidden="true">
              <span />
            </div>
          </div>

          <div className="welcome-art" aria-hidden="true">
            <svg viewBox="0 0 560 640" preserveAspectRatio="xMidYMin slice" role="presentation">
              <g className="art-contour">
                <path d="M-40 580c110-38 170 26 280-2s180-58 360-20" />
                <path d="M-40 500c110-34 170 24 280-4s180-54 360-18" />
                <path d="M-40 420c110-30 170 20 280-6s180-50 360-16" />
                <path d="M-40 340c110-26 170 18 280-8s180-46 360-14" />
                <path d="M-40 260c110-22 170 14 280-10s180-42 360-12" />
                <path d="M-40 180c110-18 170 10 280-12s180-38 360-10" />
              </g>
              <path
                className="art-path"
                d="M138 606C172 568 202 530 240 494C272 466 306 446 330 412C344 392 348 370 356 348"
              />
              <path className="art-path-open" d="M356 348C366 326 374 316 382 306" />
              <circle className="art-halo" cx="382" cy="215" r="112" />
              <circle className="art-halo" cx="382" cy="215" r="84" />
              <use href="#i-pine" x="64" y="460" width="22" height="22" className="art-pine" />
              <use href="#i-pine" x="94" y="490" width="15" height="15" className="art-pine" />
              <use href="#i-pine" x="488" y="438" width="24" height="24" className="art-pine" />
              <use href="#i-pine" x="458" y="474" width="16" height="16" className="art-pine" />
              <use href="#i-moon" x="72" y="80" width="34" height="34" className="art-pine" />

              <path className="art-crown" d="M352 306V216h60v90" />
              <path className="art-crown" d="m338 216 44-102 44 102z" />
              <path className="art-crown" d="M370 306v-26a12 12 0 0 1 24 0v26" />
              <path className="art-crown" d="M378 268v-28a4 4 0 0 1 8 0v28" />
              <path className="art-crown" d="m382 88 6 12-6 12-6-12z" />
              <path className="art-crown" d="M344 306h76M350 312h64" />

              <circle className="art-node art-node--done" cx="138" cy="606" r="15" />
              <use href="#i-tent" x="130.5" y="598.5" width="15" height="15" className="art-node-glyph" />
              <circle className="art-node art-node--done" cx="240" cy="494" r="16" />
              <use href="#i-check" x="232" y="486" width="16" height="16" className="art-node-glyph" />
              <circle className="art-node art-node--done" cx="330" cy="412" r="17" />
              <use href="#i-scroll" x="321" y="403" width="18" height="18" className="art-node-glyph" />
              <circle className="art-node art-node--open" cx="356" cy="348" r="19" />
              <use href="#i-scroll" x="346" y="338" width="20" height="20" className="art-node-open" />

              <g className="art-contour">
                <path d="M462 138c10-4 18-4 28 0" />
                <path d="M96 280c8-3 15-3 23 0" />
                <path d="M476 552c8-3 15-3 23 0" />
              </g>
            </svg>
          </div>
        </div>
      </section>
    )
  }

  const stepCopy = {
    1: {
      title: 'Chapter I — Who climbs?',
      body: 'A name is optional. Your quests are not.',
      tip: 'This is a 2-minute setup. You can change everything later from Goals.',
    },
    2: {
      title: 'Chapter II — Forge quests & training',
      body: `One screen, no going back: name a quest, add its small routines, set the weekly target. Need ${MIN_ACTIVE_TASKS}+ routines to begin.`,
      tip: 'Tip: one quest with 4 tiny routines beats four vague quests.',
    },
    3: {
      title: 'Chapter III — The eve of the climb',
      body: 'One last look. Tomorrow each quest becomes paths on your map.',
      tip: 'New quests join next map — or today if you reset the day.',
    },
  } as const
  const copy = stepCopy[step as keyof typeof stepCopy] ?? stepCopy[1]

  return (
    <section
      className="screen screen--welcome screen--onboarding"
      data-screen="welcome"
      aria-labelledby="onboarding-title"
    >
      <div className="welcome-top">
        <span className="brand" aria-label="LifeSpire">
          <Icon name="spire" className="brand__mark" />
          <span className="brand__word">LifeSpire</span>
        </span>
        <ThemeToggle />
      </div>

      <div className="onboarding-shell">
        <div className="onboarding-head">
          <span className="kicker">Tutorial · Create your path</span>
          <h1 id="onboarding-title" ref={headingRef} tabIndex={-1}>
            {copy.title}
          </h1>
          <p>{copy.body}</p>
          <p className="tutorial-float">
            <Icon name="compass" />
            {copy.tip}
          </p>

          <ol className="onboarding-steps" aria-label="Onboarding steps">
            {STEP_LABELS.map((label, index) => {
              const number = index + 1
              return (
                <li
                  key={label}
                  className="onboarding-step"
                  aria-current={number === step ? 'step' : undefined}
                >
                  <span aria-hidden="true">{number}</span>
                  {label}
                </li>
              )
            })}
          </ol>
        </div>

        <Panel pad className="onboarding-panel">
          {step === 1 ? (
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                goToStep(2)
              }}
            >
              <div className="field">
                <label htmlFor="traveller-name">What should we call you? (optional)</label>
                <input
                  className="input"
                  id="traveller-name"
                  type="text"
                  placeholder="Traveller"
                  autoComplete="nickname"
                  value={draft.name}
                  onChange={(event) => updateOnboardingDraft({ name: event.target.value })}
                />
              </div>
              <div className="dialog__actions onboarding-actions">
                <Button variant="quiet" onClick={() => goToStep(0)}>
                  <Icon name="arrow-left" />
                  Back
                </Button>
                <Button type="submit" variant="primary">
                  Continue
                  <Icon name="chevron-right" />
                </Button>
              </div>
            </form>
          ) : null}

          {step === 2 ? (
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                continueFromQuests()
              }}
            >
              {errorSummary}
              <div className="draft-list">
                {goals.length === 0 ? (
                  <p className="panel-note">
                    No quests yet. Add the first one — a goal with one tiny routine is enough to
                    start.
                  </p>
                ) : (
                  goals.map((goal, index) => renderQuestCard(goal, index))
                )}
              </div>

              <div className="onboarding-inline-actions">
                <Button
                  variant="secondary"
                  onClick={addGoal}
                  disabled={goals.length >= MAX_GOALS}
                >
                  <Icon name="plus" />
                  Add quest
                </Button>
                <span className="mini-note">
                  {goals.length} / {MAX_GOALS} quests ·{' '}
                  {tasks.filter((task) => task.active).length} active routines (need{' '}
                  {MIN_ACTIVE_TASKS})
                </span>
              </div>

              <div className="dialog__actions onboarding-actions">
                <Button variant="quiet" onClick={() => goToStep(1)}>
                  <Icon name="arrow-left" />
                  Back
                </Button>
                <Button type="submit" variant="primary">
                  Review the eve
                  <Icon name="chevron-right" />
                </Button>
              </div>
            </form>
          ) : null}

          {step === 3 ? (
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                beginCustom()
              }}
            >
              {errorSummary}

              <div className="review-block">
                <div className="review-block__head">
                  <h2>{draft.name.trim() || 'Wayfarer'}</h2>
                  <span className="mini-note">
                    {goals.length} quests · {tasks.filter((task) => task.active).length} active
                    routines · 7 days
                  </span>
                </div>
                <p className="panel-note">
                  Tomorrow each quest becomes paths on your map. You can edit everything later
                  from Goals.
                </p>
              </div>

              <div className="draft-list review-goals">
                {goals.map((goal, index) => {
                  const goalTasks = tasks.filter((task) => task.goalId === goal.id)
                  const goalErrors = validateGoalInput(goal)
                  return (
                    <article className="draft-card" key={goal.id}>
                      <div className="review-goal__head">
                        <span className="draft-group__crest">
                          <Icon name={goalIconName(goal.icon, index)} />
                        </span>
                        <div>
                          <h3>{goalLabel(index)}</h3>
                          <p>{goal.category.trim() || 'General'}</p>
                          {goal.description?.trim() ? (
                            <p className="panel-note">{goal.description.trim()}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="field review-goal__objective">
                        <label htmlFor={`review-${goal.id}-weekly`}>Weekly target</label>
                        <input
                          className="input"
                          id={`review-${goal.id}-weekly`}
                          type="number"
                          min={MIN_WEEKLY_OBJECTIVE}
                          max={MAX_WEEKLY_OBJECTIVE}
                          step={1}
                          value={goal.weeklyObjective}
                          aria-invalid={showErrors && Boolean(goalErrors.weeklyObjective)}
                          onChange={(event) =>
                            updateGoal(goal.id, {
                              weeklyObjective: Number(event.target.value),
                            })
                          }
                        />
                      </div>
                      <ul className="review-routines">
                        {goalTasks.length === 0 ? (
                          <li className="panel-note">No routines under this quest.</li>
                        ) : (
                          goalTasks.map((task) => (
                            <li key={task.id}>
                              <span>
                                <strong>{task.title || 'Untitled routine'}</strong>
                                <small>{EFFORT_LABEL[task.effort]} effort</small>
                              </span>
                              <span className={task.active ? 'chip chip--accent' : 'chip chip--quiet'}>
                                {task.active ? 'Active' : 'Inactive'}
                              </span>
                            </li>
                          ))
                        )}
                      </ul>
                    </article>
                  )
                })}
              </div>

              <div className="onboarding-inline-actions">
                <Button variant="secondary" onClick={applySuggestions}>
                  Use routine-based suggestions
                </Button>
              </div>

              <div className="dialog__actions onboarding-actions">
                <Button variant="quiet" onClick={() => goToStep(2)}>
                  <Icon name="arrow-left" />
                  Back
                </Button>
                <Button type="submit" variant="primary">
                  Begin the run
                  <Icon name="chevron-right" />
                </Button>
              </div>
            </form>
          ) : null}
        </Panel>

        <p className="welcome-foot">
          <Icon name="lock" />
          Your data stays in this browser. Sync is optional.
        </p>
      </div>
    </section>
  )
}