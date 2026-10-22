import { describe, expect, it } from 'vitest'
import goldenRaw from './fixtures/golden-map.json?raw'
import {
  GENERATOR_VERSION,
  MAX_ELITES_PER_MAP,
  MAX_LAYER_NODES,
  MIN_ELITES_PER_MAP,
  MIN_LAYER_NODES,
} from './balance'
import { generateMap, MapGenerationError, validateMap } from './generator'
import type { GenerateMapInput } from './generator'
import { resolveDecisionLayerCount } from './mapDepth'
import { rewardsForNode } from './rewards'
import type { Effort, GameMap, Goal, MapNode, RunObjective, Task } from './types'

const NOW = '2026-10-20T09:00:00.000Z'

function makeGoal(
  id: string,
  title: string,
  weeklyObjective: number,
  active = true,
): Goal {
  return {
    id,
    title,
    category: 'Test',
    weeklyObjective,
    active,
    createdAt: NOW,
  }
}

function makeTask(
  id: string,
  goalId: string,
  title: string,
  effort: Effort,
  active = true,
): Task {
  return { id, goalId, title, effort, active, createdAt: NOW }
}

function makeObjective(goal: Goal, progress: number): RunObjective {
  return {
    goalId: goal.id,
    goalTitle: goal.title,
    target: goal.weeklyObjective,
    progress,
  }
}

function baseGoals(): Goal[] {
  return [
    makeGoal('goal-wayfarer', 'Wayfarer', 4),
    makeGoal('goal-craft', 'Craft', 3),
  ]
}

function baseTasks(): Task[] {
  return [
    makeTask('task-walk', 'goal-wayfarer', 'Walk the north trail', 'light'),
    makeTask('task-ride', 'goal-wayfarer', 'Ride before dawn', 'medium'),
    makeTask('task-climb', 'goal-wayfarer', 'Climb the old stair', 'high'),
    makeTask('task-write', 'goal-craft', 'Write one page', 'medium'),
    makeTask('task-mend', 'goal-craft', 'Mend the old chair', 'high'),
  ]
}

function baseInput(overrides: Partial<GenerateMapInput> = {}): GenerateMapInput {
  const goals = overrides.goals ?? baseGoals()
  const objectives =
    overrides.objectives ?? goals.map((goal) => makeObjective(goal, 0))
  return {
    runId: 'run_test',
    runSeed: 'run:run_test',
    dayIndex: 0,
    generatorVersion: GENERATOR_VERSION,
    goals,
    tasks: overrides.tasks ?? baseTasks(),
    objectives,
    now: NOW,
    ...overrides,
  }
}

function goldenInput(): GenerateMapInput {
  const goals = baseGoals()
  return {
    runId: 'run_golden',
    runSeed: 'run:run_golden',
    dayIndex: 2,
    generatorVersion: GENERATOR_VERSION,
    goals,
    tasks: baseTasks(),
    objectives: [makeObjective(goals[0] as Goal, 1), makeObjective(goals[1] as Goal, 0)],
    now: NOW,
  }
}

function variationsFor(index: number): { goals: Goal[]; tasks: Task[]; objectives: RunObjective[] } {
  const goalCount = 1 + (index % 3)
  const poolSize = [1, 2, 3, 4, 5, 8, 13][index % 7] as number
  const goals = Array.from({ length: goalCount }, (_, goalIndex) =>
    makeGoal(`g${index}-${goalIndex}`, `Goal ${index}-${goalIndex}`, 1 + ((index + goalIndex) % 7)),
  )
  const tasks = Array.from({ length: poolSize }, (_, taskIndex) => {
    const effort = (['light', 'medium', 'high'] as const)[(index + taskIndex) % 3] as Effort
    return makeTask(
      `t${index}-${taskIndex}`,
      (goals[taskIndex % goals.length] as Goal).id,
      `Routine ${index}-${taskIndex}`,
      effort,
    )
  })
  const objectives = goals.map((goal, goalIndex) =>
    makeObjective(goal, (index + goalIndex) % (goal.weeklyObjective + 1)),
  )
  return { goals, tasks, objectives }
}

function goalsFor(goalCount: number): {
  goals: Goal[]
  tasks: Task[]
  objectives: RunObjective[]
} {
  const goals = Array.from({ length: goalCount }, (_, index) =>
    makeGoal(`goal-depth-${index}`, `Depth goal ${index}`, 4),
  )
  const tasks = goals.flatMap((goal, index) => [
    makeTask(`task-depth-${index}-a`, goal.id, `Depth routine ${index} A`, 'light'),
    makeTask(`task-depth-${index}-b`, goal.id, `Depth routine ${index} B`, 'medium'),
  ])
  return {
    goals,
    tasks,
    objectives: goals.map((goal) => makeObjective(goal, 0)),
  }
}

describe('generateMap golden output', () => {
  it('matches the committed fixture for a fixed seed', () => {
    const map = generateMap(goldenInput())
    const expected = JSON.parse(goldenRaw) as GameMap
    expect(map).toEqual(expected)
  })
})

describe('generateMap determinism', () => {
  it('returns identical JSON for the same input', () => {
    const first = generateMap(baseInput({ dayIndex: 3 }))
    const second = generateMap(baseInput({ dayIndex: 3 }))
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
  })

  it('changes the map when the run seed changes', () => {
    const first = generateMap(baseInput({ runSeed: 'run:alpha', dayIndex: 3 }))
    const second = generateMap(baseInput({ runSeed: 'run:beta', dayIndex: 3 }))
    expect(JSON.stringify(second)).not.toBe(JSON.stringify(first))
  })

  it('does not depend on the order in which the pool is supplied', () => {
    const tasks = baseTasks()
    const forward = generateMap(baseInput({ dayIndex: 4, tasks }))
    const backward = generateMap(baseInput({ dayIndex: 4, tasks: [...tasks].reverse() }))
    expect(backward).toEqual(forward)
  })
})

describe('generateMap structure', () => {
  it('uses stable ids, the derived seed, the injected timestamp and no selection', () => {
    const input = baseInput({ dayIndex: 5, now: '2026-10-21T11:22:33.000Z' })
    const map = generateMap(input)

    expect(map.seed).toBe(`run:run_test:day:5:g${GENERATOR_VERSION}`)
    expect(map.createdAt).toBe('2026-10-21T11:22:33.000Z')
    expect(map.currentNodeId).toBeNull()
    expect(map.id).toBe('run_test:map:5')
    expect(map.boss.id).toBe('n4_0')
    expect(map.boss.layer).toBe(4)
    expect(map.boss.connections).toEqual([])
    map.layers.forEach((layer, layerIndex) => {
      layer.forEach((node, nodeIndex) => {
        expect(node.id).toBe(`n${layerIndex}_${nodeIndex}`)
        expect(node.layer).toBe(layerIndex)
      })
    })
  })

  it('validates 1,000 varied maps without a single invariant failure', () => {
    const errors: string[] = []
    for (let index = 0; index < 1000; index += 1) {
      const { goals, tasks, objectives } = variationsFor(index)
      const map = generateMap(
        baseInput({
          runId: `run_${index}`,
          runSeed: `run:seed:${index}`,
          dayIndex: index % 7,
          goals,
          tasks,
          objectives,
        }),
      )
      const result = validateMap(map)
      if (!result.ok) {
        errors.push(`map ${index}: ${result.errors.join('; ')}`)
      }
    }
    expect(errors).toEqual([])
  })

  it('keeps task-bearing nodes distinct when the pool is large enough', () => {
    const goals = baseGoals()
    const tasks = Array.from({ length: 20 }, (_, index) =>
      makeTask(
        `task-large-${String(index).padStart(2, '0')}`,
        (goals[index % goals.length] as Goal).id,
        `Routine ${index}`,
        (['light', 'medium', 'high'] as const)[index % 3] as Effort,
      ),
    )
    const map = generateMap(baseInput({ tasks }))
    expect(validateMap(map)).toEqual({ ok: true })

    const layerTaskIds = map.layers.flatMap((layer) =>
      layer.flatMap((node) => (node.task ? [node.task.taskId] : [])),
    )
    expect(new Set(layerTaskIds).size).toBe(layerTaskIds.length)
  })

  it('produces the expected layer sizes and elite count', () => {
    const map = generateMap(baseInput())
    expect(map.layers).toHaveLength(resolveDecisionLayerCount(baseGoals().length))
    for (const layer of map.layers) {
      expect(layer.length).toBeGreaterThanOrEqual(MIN_LAYER_NODES)
      expect(layer.length).toBeLessThanOrEqual(MAX_LAYER_NODES)
    }
    const elites = map.layers.flat().filter((node) => node.type === 'elite')
    expect(elites.length).toBeGreaterThanOrEqual(MIN_ELITES_PER_MAP)
    expect(elites.length).toBeLessThanOrEqual(MAX_ELITES_PER_MAP)
  })
})

describe('generateMap depth from active goals', () => {
  it.each([
    [3, 1],
    [4, 2],
    [5, 3],
  ])('builds %i decision layers for %i active goals', (layerCount, goalCount) => {
    const { goals, tasks, objectives } = goalsFor(goalCount)
    const map = generateMap(baseInput({ goals, tasks, objectives }))

    expect(map.layers).toHaveLength(layerCount)
    expect(map.layers).toHaveLength(resolveDecisionLayerCount(goalCount))
    expect(map.boss.layer).toBe(layerCount)
    expect(map.boss.id).toBe(`n${layerCount}_0`)
    expect(validateMap(map)).toEqual({ ok: true })
  })

  it('ignores inactive goals when resolving depth', () => {
    const { goals, tasks, objectives } = goalsFor(3)
    goals[2] = { ...(goals[2] as Goal), active: false }
    const map = generateMap(baseInput({ goals, tasks, objectives: objectives.slice(0, 2) }))

    expect(map.layers).toHaveLength(4)
    expect(map.boss.layer).toBe(4)
    expect(map.boss.id).toBe('n4_0')
    expect(validateMap(map)).toEqual({ ok: true })
  })
})

describe('generateMap map shape', () => {
  it('drifts the layer width by at most one node', () => {
    for (let index = 0; index < 200; index += 1) {
      const { goals, tasks, objectives } = variationsFor(index)
      const map = generateMap(
        baseInput({
          runId: `run_shape_${index}`,
          runSeed: `run:shape:${index}`,
          dayIndex: index % 7,
          goals,
          tasks,
          objectives,
        }),
      )
      const sizes = map.layers.map((layer) => layer.length)
      for (let layerIndex = 1; layerIndex < sizes.length; layerIndex += 1) {
        const previous = sizes[layerIndex - 1] as number
        const current = sizes[layerIndex] as number
        expect(Math.abs(previous - current)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('only connects a node to its neighbours on the next layer', () => {
    for (let index = 0; index < 200; index += 1) {
      const { goals, tasks, objectives } = variationsFor(index)
      const map = generateMap(
        baseInput({
          runId: `run_links_${index}`,
          runSeed: `run:links:${index}`,
          dayIndex: index % 7,
          goals,
          tasks,
          objectives,
        }),
      )
      map.layers.forEach((layer, layerIndex) => {
        const next = map.layers[layerIndex + 1]
        if (!next) return
        layer.forEach((node, nodeIndex) => {
          for (const targetId of node.connections) {
            const targetIndex = next.findIndex((target) => target.id === targetId)
            expect(targetIndex).toBeGreaterThanOrEqual(0)
            expect(Math.abs(nodeIndex - targetIndex)).toBeLessThanOrEqual(1)
          }
        })
      })
    }
  })
})

describe('generateMap edge cases', () => {
  it('handles exactly four routines and one goal', () => {
    const goals = [makeGoal('goal-solo', 'Solo goal', 5)]
    const tasks = [
      makeTask('task-a', 'goal-solo', 'A', 'light'),
      makeTask('task-b', 'goal-solo', 'B', 'medium'),
      makeTask('task-c', 'goal-solo', 'C', 'high'),
      makeTask('task-d', 'goal-solo', 'D', 'medium'),
    ]
    const map = generateMap(baseInput({ goals, tasks }))
    expect(validateMap(map)).toEqual({ ok: true })
  })

  it('handles three goals', () => {
    const goals = [
      makeGoal('goal-a', 'A', 2),
      makeGoal('goal-b', 'B', 3),
      makeGoal('goal-c', 'C', 4),
    ]
    const tasks = Array.from({ length: 9 }, (_, index) =>
      makeTask(
        `task-${index}`,
        (goals[index % goals.length] as Goal).id,
        `Routine ${index}`,
        (['light', 'medium', 'high'] as const)[index % 3] as Effort,
      ),
    )
    const map = generateMap(baseInput({ goals, tasks }))
    expect(validateMap(map)).toEqual({ ok: true })
    expect(goals.map((goal) => goal.id)).toContain(map.boss.task?.goalId)
  })

  it.each([1, 2, 3])('keeps a %i-routine pool playable', (poolSize) => {
    const goals = [makeGoal('goal-small', 'Small goal', 4)]
    const tasks = Array.from({ length: poolSize }, (_, index) =>
      makeTask(
        `task-small-${index}`,
        'goal-small',
        `Routine ${index}`,
        (['light', 'medium', 'high'] as const)[index % 3] as Effort,
      ),
    )
    const map = generateMap(baseInput({ goals, tasks }))
    expect(validateMap(map)).toEqual({ ok: true })

    const layerTaskIds = map.layers.map(
      (layer) => new Set(layer.flatMap((node) => (node.task ? [node.task.taskId] : []))),
    )
    if (poolSize > 1) {
      for (const ids of layerTaskIds) {
        expect(ids.size).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('rejects an empty active routine pool with a clear domain error', () => {
    expect(() => generateMap(baseInput({ tasks: [] }))).toThrow(MapGenerationError)
    expect(() => generateMap(baseInput({ tasks: [] }))).toThrow(/active routine/i)
  })

  it('ignores routines from inactive goals and inactive routines', () => {
    const goals = [makeGoal('goal-off', 'Off', 2, false), makeGoal('goal-on', 'On', 2)]
    const tasks = [
      makeTask('task-off-goal', 'goal-off', 'Off goal', 'high'),
      makeTask('task-inactive', 'goal-on', 'Inactive', 'high', false),
    ]
    expect(() => generateMap(baseInput({ goals, tasks }))).toThrow(MapGenerationError)
  })

  it('does not mutate the goals, routines or objectives it receives', () => {
    const goals = baseGoals().map((goal) => Object.freeze({ ...goal }))
    const tasks = baseTasks().map((task) => Object.freeze({ ...task }))
    const objectives = goals.map((goal) => Object.freeze(makeObjective(goal, 0)))
    const input: GenerateMapInput = {
      ...baseInput(),
      goals: Object.freeze(goals),
      tasks: Object.freeze(tasks),
      objectives: Object.freeze(objectives),
    }
    const before = JSON.stringify(input)
    generateMap(input)
    expect(JSON.stringify(input)).toBe(before)
  })
})

describe('generateMap boss preference', () => {
  it('prefers pending progress and high effort, deterministically', () => {
    const pending = makeGoal('goal-pending', 'Pending', 5)
    const complete = makeGoal('goal-complete', 'Complete', 1)
    const goals = [pending, complete]
    const tasks = [
      makeTask('task-pending-light', pending.id, 'Pending light', 'light'),
      makeTask('task-pending-high', pending.id, 'Pending high', 'high'),
      makeTask('task-complete-high', complete.id, 'Complete high', 'high'),
    ]
    const input = baseInput({
      goals,
      tasks,
      objectives: [makeObjective(pending, 0), makeObjective(complete, 1)],
    })

    const first = generateMap(input)
    const second = generateMap(input)
    expect(first.boss.task).toMatchObject({
      taskId: 'task-pending-high',
      goalId: 'goal-pending',
      effort: 'high',
    })
    expect(second.boss.task).toEqual(first.boss.task)
  })
})

describe('validateMap', () => {
  it('accepts generated maps', () => {
    expect(validateMap(generateMap(baseInput()))).toEqual({ ok: true })
  })

  it('reports broken layer sizes, tasks, elites, rewards and connections', () => {
    const map = generateMap(baseInput())
    const broken = structuredClone(map)
    const firstLayer = broken.layers[0] ?? []
    broken.layers[0] = firstLayer.slice(0, 1)
    const secondLayer = broken.layers[1] ?? []
    broken.layers[1] = [...secondLayer, { ...(secondLayer[0] as MapNode), id: 'extra' }]
    broken.boss.connections = ['n0_0']
    broken.layers[2] = (broken.layers[2] ?? []).map((node) => ({
      ...node,
      rewards: { xp: 0, gold: 0, lootRolls: 0, progress: 0 as const },
    }))

    const result = validateMap(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.join('\n')).toMatch(/layers\[0\].*2–3|layers\[0\].*nodes/)
      expect(result.errors.join('\n')).toMatch(/boss.connections/)
    }
  })

  it('detects unreachable nodes and duplicate tasks within a layer', () => {
    const map = generateMap(baseInput())
    const broken = structuredClone(map)
    const layerZero = broken.layers[0] ?? []
    const firstIndex = layerZero.findIndex((node) => node.task !== null)
    const firstTask = layerZero[firstIndex]
    const secondIndex = layerZero.findIndex((_, index) => index !== firstIndex)
    const second = layerZero[secondIndex]
    if (!firstTask?.task || !second) throw new Error('fixture needs two layer-0 nodes')

    broken.layers[0] = [
      firstTask,
      {
        ...second,
        type: 'task',
        task: { ...firstTask.task },
        rewards: rewardsForNode('task', firstTask.task.effort),
      },
    ]
    const survivor = broken.layers[1]?.[0]
    if (!survivor) throw new Error('fixture needs a first-layer node')
    broken.layers[0] = broken.layers[0].map((node) => ({
      ...node,
      connections: [survivor.id],
    }))

    const result = validateMap(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const text = result.errors.join('\n')
      expect(text).toMatch(/repeats task/)
      expect(text).toMatch(/orphan|not reachable/)
    }
  })
})
