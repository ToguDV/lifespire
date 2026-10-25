import { upsertDraftGoal, upsertDraftTask } from './draftContent'

const now = () => new Date('2026-10-25T08:00:00.000Z')
const newId = (prefix: string) => `${prefix}_test_1`

describe('upsertDraftGoal', () => {
  it('appends a new goal with a generated id and timestamp', () => {
    const next = upsertDraftGoal([], {
      title: 'Move',
      category: 'Body',
      icon: 'flame',
      weeklyObjective: 3,
      active: true,
    }, { newId, now })
    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({
      id: 'goal_test_1',
      title: 'Move',
      category: 'Body',
      icon: 'flame',
      weeklyObjective: 3,
      active: true,
      createdAt: '2026-10-25T08:00:00.000Z',
    })
  })

  it('updates the matching draft goal without touching id or createdAt', () => {
    const existing = upsertDraftGoal([], {
      title: 'Move',
      category: 'Body',
      icon: 'flame',
      weeklyObjective: 3,
      active: true,
    }, { newId, now })
    const next = upsertDraftGoal(existing, {
      id: existing[0]!.id,
      title: 'Move daily',
      category: 'Body',
      icon: 'quill',
      weeklyObjective: 5,
      active: true,
    }, { newId: () => 'goal_other', now: () => new Date('2026-10-26T00:00:00.000Z') })
    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({
      id: 'goal_test_1',
      title: 'Move daily',
      icon: 'quill',
      weeklyObjective: 5,
      createdAt: '2026-10-25T08:00:00.000Z',
    })
  })

  it('falls back to General and the next crest when the dialog omits them', () => {
    const next = upsertDraftGoal([], {
      title: '  Read  ',
      category: '   ',
      weeklyObjective: 2,
      active: true,
    }, { newId, now })
    expect(next[0]?.title).toBe('Read')
    expect(next[0]?.category).toBe('General')
    expect(typeof next[0]?.icon).toBe('string')
  })
})

describe('upsertDraftTask', () => {
  it('appends a new routine with a generated id and timestamp', () => {
    const next = upsertDraftTask([], {
      goalId: 'goal_1',
      title: 'Walk',
      effort: 'light',
      active: true,
    }, { newId, now })
    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({
      id: 'task_test_1',
      goalId: 'goal_1',
      title: 'Walk',
      effort: 'light',
      active: true,
      createdAt: '2026-10-25T08:00:00.000Z',
    })
  })

  it('updates the matching draft routine without touching id or createdAt', () => {
    const existing = upsertDraftTask([], {
      goalId: 'goal_1',
      title: 'Walk',
      effort: 'light',
      active: true,
    }, { newId, now })
    const next = upsertDraftTask(existing, {
      id: existing[0]!.id,
      goalId: 'goal_2',
      title: 'Walk far',
      effort: 'high',
      active: false,
    }, { newId: () => 'task_other', now: () => new Date('2026-10-26T00:00:00.000Z') })
    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({
      id: 'task_test_1',
      goalId: 'goal_2',
      title: 'Walk far',
      effort: 'high',
      active: false,
      createdAt: '2026-10-25T08:00:00.000Z',
    })
  })
})
