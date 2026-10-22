import {
  BOSS_LAYER,
  DECISION_LAYERS,
  MAX_ELITES_PER_MAP,
  MAX_LAYER_NODES,
  MIN_ELITES_PER_MAP,
  MIN_LAYER_NODES,
  RUN_DAYS,
} from './balance'
import { createRng } from './rng'
import type { Rng } from './rng'
import { rewardsForNode } from './rewards'
import type {
  Effort,
  GameMap,
  Goal,
  MapNode,
  NodeRewards,
  NodeType,
  RunObjective,
  Task,
  TaskSnapshot,
} from './types'

export interface GenerateMapInput {
  runId: string
  runSeed: string
  dayIndex: number
  generatorVersion: number
  goals: readonly Goal[]
  tasks: readonly Task[]
  objectives: readonly RunObjective[]
  now: string
}

export interface MapValidationSuccess {
  ok: true
}

export interface MapValidationFailure {
  ok: false
  errors: string[]
}

export type MapValidation = MapValidationSuccess | MapValidationFailure

/** A missing routine pool is a setup problem, not an unrecoverable crash. */
export class MapGenerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MapGenerationError'
  }
}

interface TaskChoice {
  task: Task
  goalTitle: string
}

const EFFORT_ORDER: Record<Effort, number> = { light: 0, medium: 1, high: 2 }
const NODE_TYPES: readonly NodeType[] = ['task', 'elite', 'rest', 'treasure', 'boss']
const SPECIAL_TYPES = ['rest', 'treasure'] as const

function compareStrings(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function isTaskBearing(type: NodeType): boolean {
  return type === 'task' || type === 'elite' || type === 'boss'
}

function snapshotOf(choice: TaskChoice): TaskSnapshot {
  return {
    taskId: choice.task.id,
    title: choice.task.title,
    goalId: choice.task.goalId,
    goalTitle: choice.goalTitle,
    effort: choice.task.effort,
  }
}

/**
 * Builds the active routine pool. Active routines whose goal is missing or
 * inactive are ignored, and duplicate ids are collapsed defensively.
 */
function buildTaskPool(input: GenerateMapInput): TaskChoice[] {
  const goalsById = new Map(
    input.goals.filter((goal) => goal.active).map((goal) => [goal.id, goal] as const),
  )
  const seen = new Set<string>()
  const pool: TaskChoice[] = []

  for (const task of input.tasks) {
    if (!task.active || seen.has(task.id)) continue
    const goal = goalsById.get(task.goalId)
    if (!goal) continue
    seen.add(task.id)
    pool.push({ task, goalTitle: goal.title })
  }

  return pool.sort((a, b) => compareStrings(a.task.id, b.task.id))
}

function range(length: number): number[] {
  return Array.from({ length }, (_, index) => index)
}

function drawTask(
  pool: readonly TaskChoice[],
  usedInLayer: Set<string>,
  usedGlobally: Set<string>,
  rng: Rng,
): TaskChoice {
  const unusedInLayerAndMap = pool.filter(
    (choice) => !usedInLayer.has(choice.task.id) && !usedGlobally.has(choice.task.id),
  )
  if (unusedInLayerAndMap.length > 0) {
    return rng.pick(unusedInLayerAndMap)
  }

  // Pools smaller than the map force reuse, but reuse inside one layer is the
  // last resort (only possible with a single active routine).
  const unusedInLayer = pool.filter((choice) => !usedInLayer.has(choice.task.id))
  if (unusedInLayer.length > 0) {
    return rng.pick(unusedInLayer)
  }

  return rng.pick(pool)
}

/**
 * Picks the boss task. A goal with pending weekly progress wins first, then
 * high effort, then a task not already used in the map. Ties are resolved by
 * the seeded RNG so the result is stable for a given seed.
 */
function chooseBoss(
  pool: readonly TaskChoice[],
  objectives: readonly RunObjective[],
  usedGlobally: ReadonlySet<string>,
  rng: Rng,
): TaskChoice {
  const objectivesByGoal = new Map(objectives.map((objective) => [objective.goalId, objective] as const))

  const score = (choice: TaskChoice): [number, number, number] => {
    const objective = objectivesByGoal.get(choice.task.goalId)
    const pending = !objective || objective.progress < objective.target
    return [
      pending ? 0 : 1,
      2 - EFFORT_ORDER[choice.task.effort],
      usedGlobally.has(choice.task.id) ? 1 : 0,
    ]
  }

  const ranked = pool.map((choice) => ({ choice, score: score(choice) }))
  ranked.sort((a, b) => {
    for (let index = 0; index < a.score.length; index += 1) {
      const difference = (a.score[index] as number) - (b.score[index] as number)
      if (difference !== 0) return difference
    }
    return compareStrings(a.choice.task.id, b.choice.task.id)
  })

  const best = ranked[0]?.score
  if (!best) throw new MapGenerationError('A map needs at least one active routine.')
  const tied = ranked.filter(
    (entry) =>
      entry.score[0] === best[0] && entry.score[1] === best[1] && entry.score[2] === best[2],
  )
  return rng.pick(tied).choice
}

/**
 * Connects two consecutive layers. A source only reaches the target that sits
 * on its own lane and the two lanes next to it, so a path never jumps across
 * the map. Every source gets 1–2 outgoing edges and every target gets at least
 * one incoming edge. The layer sizes drift by at most one node, which is what
 * makes the neighbour rule always able to cover the next layer.
 */
function connectLayers(sources: MapNode[], targets: MapNode[], rng: Rng): void {
  if (targets.length === 0) {
    throw new MapGenerationError('Cannot connect a layer without target nodes.')
  }

  const edges = sources.map(() => new Set<number>())

  // The targets a source is allowed to reach: its own index and the neighbours.
  const reachable = (sourceIndex: number): number[] => {
    const from = Math.max(0, sourceIndex - 1)
    const to = Math.min(targets.length - 1, sourceIndex + 1)
    return range(to - from + 1).map((offset) => from + offset)
  }

  // Anchor every source to the target on the same lane first, so the map reads
  // as vertical paths that branch locally instead of zig-zagging.
  sources.forEach((_, sourceIndex) => {
    edges[sourceIndex]?.add(Math.min(sourceIndex, targets.length - 1))
  })

  // Then cover every target that did not receive an edge yet.
  for (let targetIndex = 0; targetIndex < targets.length; targetIndex += 1) {
    const covered = sources.some((_, sourceIndex) => edges[sourceIndex]?.has(targetIndex))
    if (covered) continue
    const candidates = sources
      .map((_, sourceIndex) => sourceIndex)
      .filter(
        (sourceIndex) =>
          (edges[sourceIndex]?.size ?? 0) < 2 && reachable(sourceIndex).includes(targetIndex),
      )
      .sort((a, b) => Math.abs(a - targetIndex) - Math.abs(b - targetIndex))
    const sourceIndex = candidates[0]
    if (sourceIndex === undefined) {
      throw new MapGenerationError('A layer could not reach every node in the next layer.')
    }
    edges[sourceIndex]?.add(targetIndex)
  }

  // Occasionally offer a second branch for visible path choice.
  sources.forEach((_, sourceIndex) => {
    const indexes = edges[sourceIndex]
    if (!indexes || indexes.size !== 1 || rng.next() >= 0.45) return
    const choices = reachable(sourceIndex).filter((targetIndex) => !indexes.has(targetIndex))
    if (choices.length > 0) indexes.add(rng.pick(choices))
  })

  sources.forEach((source, sourceIndex) => {
    const indexes = edges[sourceIndex]
    source.connections = indexes
      ? [...indexes].sort((a, b) => a - b).map((targetIndex) => targets[targetIndex]!.id)
      : []
  })
}

/**
 * Deterministic map generation. The same input always produces the same map;
 * no ambient clock, randomness, store or UI is involved.
 */
export function generateMap(input: GenerateMapInput): GameMap {
  const pool = buildTaskPool(input)
  if (pool.length === 0) {
    throw new MapGenerationError(
      'A map needs at least one active routine. Add a routine to an active goal and try again.',
    )
  }

  const seed = `${input.runSeed}:day:${input.dayIndex}:g${input.generatorVersion}`
  const rng = createRng(seed)

  // A layer can only hold as many task-bearing nodes as there are distinct
  // routines, plus one rest or treasure. The size drifts by at most one node
  // between neighbouring layers, so every node can always reach its
  // neighbours on the next layer.
  const maxLayerSize =
    pool.length === 1 ? MIN_LAYER_NODES : Math.min(MAX_LAYER_NODES, pool.length + 1)

  const layerSizes: number[] = []
  for (let layerIndex = 0; layerIndex < DECISION_LAYERS; layerIndex += 1) {
    if (layerIndex === 0) {
      layerSizes.push(MIN_LAYER_NODES + rng.int(maxLayerSize - MIN_LAYER_NODES + 1))
      continue
    }
    const previous = layerSizes[layerIndex - 1] as number
    const drift = rng.int(3) - 1
    layerSizes.push(Math.min(Math.max(previous + drift, MIN_LAYER_NODES), maxLayerSize))
  }

  const eliteCount =
    MIN_ELITES_PER_MAP + rng.int(MAX_ELITES_PER_MAP - MIN_ELITES_PER_MAP + 1)
  const eliteLayers = new Set(rng.shuffle(range(DECISION_LAYERS)).slice(0, eliteCount))

  const spareSlots = (layerIndex: number): number =>
    (layerSizes[layerIndex] ?? MIN_LAYER_NODES) - 1 - (eliteLayers.has(layerIndex) ? 1 : 0)

  const specialLayers = new Set<number>()
  if (pool.length === 1) {
    // One routine per layer: the second node must be a rest or treasure.
    for (const layerIndex of range(DECISION_LAYERS)) {
      if (!eliteLayers.has(layerIndex)) specialLayers.add(layerIndex)
    }
  } else {
    // A layer wider than the pool needs a rest or treasure, otherwise it would
    // have to repeat a routine inside the same layer.
    for (const layerIndex of range(DECISION_LAYERS)) {
      const size = layerSizes[layerIndex] ?? MIN_LAYER_NODES
      if (size > pool.length) specialLayers.add(layerIndex)
    }
    // Then a couple of extra rest or treasure nodes for variety.
    const candidates = rng
      .shuffle(range(DECISION_LAYERS))
      .filter((layerIndex) => spareSlots(layerIndex) > 0 && !specialLayers.has(layerIndex))
    const requested = pool.length >= 3 ? 1 + rng.int(2) : 1
    for (const layerIndex of candidates.slice(0, requested)) specialLayers.add(layerIndex)
  }

  const specialTypes = new Map<number, 'rest' | 'treasure'>()
  for (const layerIndex of [...specialLayers].sort((a, b) => a - b)) {
    specialTypes.set(layerIndex, rng.pick(SPECIAL_TYPES))
  }

  const layerSpecs = layerSizes.map((size, layerIndex) => {
    const specs: NodeType[] = ['task']
    if (eliteLayers.has(layerIndex)) specs.push('elite')
    const special = specialTypes.get(layerIndex)
    if (special) specs.push(special)
    while (specs.length < size) specs.push('task')
    return rng.shuffle(specs)
  })

  const usedGlobally = new Set<string>()
  const layers: MapNode[][] = layerSpecs.map((specs, layerIndex) => {
    const usedInLayer = new Set<string>()
    return specs.map((type, nodeIndex) => {
      if (!isTaskBearing(type)) {
        return {
          id: `n${layerIndex}_${nodeIndex}`,
          layer: layerIndex,
          type,
          task: null,
          rewards: rewardsForNode(type, 'light'),
          connections: [],
        }
      }

      const choice = drawTask(pool, usedInLayer, usedGlobally, rng)
      usedInLayer.add(choice.task.id)
      usedGlobally.add(choice.task.id)
      return {
        id: `n${layerIndex}_${nodeIndex}`,
        layer: layerIndex,
        type,
        task: snapshotOf(choice),
        rewards: rewardsForNode(type, choice.task.effort),
        connections: [],
      }
    })
  })

  for (let layerIndex = 0; layerIndex < DECISION_LAYERS - 1; layerIndex += 1) {
    connectLayers(layers[layerIndex] as MapNode[], layers[layerIndex + 1] as MapNode[], rng)
  }

  const bossChoice = chooseBoss(pool, input.objectives, usedGlobally, rng)
  const boss: MapNode = {
    id: `n${BOSS_LAYER}_0`,
    layer: BOSS_LAYER,
    type: 'boss',
    task: snapshotOf(bossChoice),
    rewards: rewardsForNode('boss', bossChoice.task.effort),
    connections: [],
  }

  for (const node of layers[DECISION_LAYERS - 1] as MapNode[]) {
    node.connections = [boss.id]
  }

  return {
    id: `${input.runId}:map:${input.dayIndex}`,
    seed,
    dayIndex: input.dayIndex,
    generatorVersion: input.generatorVersion,
    layers,
    boss,
    currentNodeId: null,
    createdAt: input.now,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNodeLike(value: unknown): value is MapNode {
  return isRecord(value) && typeof value.id === 'string'
}

function addIf(condition: boolean, errors: string[], message: string): void {
  if (condition) errors.push(message)
}

function sameRewards(actual: NodeRewards, expected: NodeRewards): boolean {
  return (
    actual.xp === expected.xp &&
    actual.gold === expected.gold &&
    actual.lootRolls === expected.lootRolls &&
    actual.progress === expected.progress
  )
}

function validateSnapshot(
  snapshot: TaskSnapshot,
  path: string,
  errors: string[],
): string | null {
  addIf(!snapshot.taskId, errors, `${path}.taskId must not be empty`)
  addIf(!snapshot.title, errors, `${path}.title must not be empty`)
  addIf(!snapshot.goalId, errors, `${path}.goalId must not be empty`)
  addIf(!snapshot.goalTitle, errors, `${path}.goalTitle must not be empty`)
  addIf(
    !Object.prototype.hasOwnProperty.call(EFFORT_ORDER, snapshot.effort),
    errors,
    `${path}.effort must be light, medium or high`,
  )
  return snapshot.taskId || null
}

/**
 * Checks every structural invariant that can be derived from a map alone.
 * Cross-layer task repetition is intentionally not an error: small pools must
 * be able to reuse routines between layers. Within a layer, repetition is only
 * tolerated for a single-routine pool (see the generator's defensive fallback).
 */
export function validateMap(map: GameMap): MapValidation {
  const errors: string[] = []
  if (!isRecord(map)) return { ok: false, errors: ['map must be an object'] }

  addIf(!map.id, errors, 'map.id must not be empty')
  addIf(
    typeof map.dayIndex !== 'number' ||
      !Number.isInteger(map.dayIndex) ||
      map.dayIndex < 0 ||
      map.dayIndex >= RUN_DAYS,
    errors,
    `map.dayIndex must be an integer between 0 and ${RUN_DAYS - 1}`,
  )
  addIf(
    typeof map.generatorVersion !== 'number' ||
      !Number.isInteger(map.generatorVersion) ||
      map.generatorVersion < 1,
    errors,
    'map.generatorVersion must be a positive integer',
  )
  addIf(
    typeof map.createdAt !== 'string' || Number.isNaN(Date.parse(map.createdAt)),
    errors,
    'map.createdAt must be a valid date string',
  )
  addIf(
    typeof map.seed !== 'string' ||
      !map.seed.endsWith(`:day:${map.dayIndex}:g${map.generatorVersion}`),
    errors,
    'map.seed must end with the day index and generator version',
  )

  if (!Array.isArray(map.layers)) {
    return { ok: false, errors: [...errors, 'map.layers must be an array'] }
  }
  addIf(
    map.layers.length !== DECISION_LAYERS,
    errors,
    `map.layers must contain ${DECISION_LAYERS} layers`,
  )

  const allNodes = new Map<string, MapNode>()
  const connectionsById = new Map<string, string[]>()
  const layerIds: string[][] = []
  const distinctTaskIds = new Set<string>()
  const duplicateTasksInLayer: Array<{ layer: number; taskId: string }> = []
  let eliteCount = 0

  map.layers.forEach((layer, layerIndex) => {
    if (!Array.isArray(layer)) {
      errors.push(`layers[${layerIndex}] must be an array`)
      layerIds.push([])
      return
    }

    addIf(
      layer.length < MIN_LAYER_NODES || layer.length > MAX_LAYER_NODES,
      errors,
      `layers[${layerIndex}] must contain ${MIN_LAYER_NODES}–${MAX_LAYER_NODES} nodes`,
    )

    const ids: string[] = []
    const taskIds = new Set<string>()
    let taskNodes = 0
    let specialNodes = 0

    layer.forEach((node, nodeIndex) => {
      const path = `layers[${layerIndex}][${nodeIndex}]`
      if (!isNodeLike(node)) {
        errors.push(`${path} must be a node object`)
        return
      }

      if (node.id !== `n${layerIndex}_${nodeIndex}`) {
        errors.push(`${path}.id must be "n${layerIndex}_${nodeIndex}"`)
      }
      if (node.layer !== layerIndex) {
        errors.push(`${path}.layer must be ${layerIndex}`)
      }
      if (!NODE_TYPES.includes(node.type)) {
        errors.push(`${path}.type is unknown`)
      }
      if (node.type === 'boss') {
        errors.push(`${path} must not be a boss node`)
      }

      if (allNodes.has(node.id)) errors.push(`duplicate node id "${node.id}"`)
      else allNodes.set(node.id, node)
      ids.push(node.id)

      if (node.type === 'task') taskNodes += 1
      if (node.type === 'rest' || node.type === 'treasure') specialNodes += 1
      if (node.type === 'elite') eliteCount += 1

      if (isTaskBearing(node.type)) {
        if (!node.task) {
          errors.push(`${path}.task is required for ${node.type} nodes`)
        } else {
          const taskId = validateSnapshot(node.task, `${path}.task`, errors)
          if (taskId) {
            distinctTaskIds.add(taskId)
            if (taskIds.has(taskId)) duplicateTasksInLayer.push({ layer: layerIndex, taskId })
            taskIds.add(taskId)
          }
        }
      } else {
        addIf(node.task !== null, errors, `${path}.task must be null for ${node.type} nodes`)
      }

      if (NODE_TYPES.includes(node.type)) {
        const expected = rewardsForNode(node.type, node.task?.effort ?? 'light')
        if (!node.rewards || !sameRewards(node.rewards, expected)) {
          errors.push(`${path}.rewards do not match the ${node.type} reward table`)
        }
      }

      if (!Array.isArray(node.connections)) {
        errors.push(`${path}.connections must be an array`)
      } else {
        connectionsById.set(node.id, node.connections)
      }
    })

    addIf(taskNodes < 1, errors, `layers[${layerIndex}] must contain at least one task node`)
    addIf(
      specialNodes > 1,
      errors,
      `layers[${layerIndex}] must contain at most one rest or treasure node`,
    )
    layerIds.push(ids)
  })

  if (distinctTaskIds.size > 1) {
    for (const duplicate of duplicateTasksInLayer) {
      errors.push(`layers[${duplicate.layer}] repeats task "${duplicate.taskId}" within the layer`)
    }
  }

  if (eliteCount < MIN_ELITES_PER_MAP || eliteCount > MAX_ELITES_PER_MAP) {
    errors.push(`map must contain ${MIN_ELITES_PER_MAP}–${MAX_ELITES_PER_MAP} elite nodes`)
  }

  const boss = map.boss
  if (!isNodeLike(boss)) {
    errors.push('map.boss must be a node object')
  } else {
    if (boss.id !== `n${BOSS_LAYER}_0`) errors.push(`map.boss.id must be "n${BOSS_LAYER}_0"`)
    if (boss.layer !== BOSS_LAYER) errors.push(`map.boss.layer must be ${BOSS_LAYER}`)
    if (boss.type !== 'boss') errors.push('map.boss.type must be boss')
    if (!boss.task) {
      errors.push('map.boss.task is required')
    } else {
      validateSnapshot(boss.task, 'map.boss.task', errors)
    }
    if (!boss.rewards || !sameRewards(boss.rewards, rewardsForNode('boss', boss.task?.effort ?? 'light'))) {
      errors.push('map.boss.rewards do not match the boss reward table')
    }
    if (!Array.isArray(boss.connections) || boss.connections.length !== 0) {
      errors.push('map.boss.connections must be empty')
    }
    if (allNodes.has(boss.id)) errors.push(`duplicate node id "${boss.id}"`)
    else allNodes.set(boss.id, boss)
    connectionsById.set(boss.id, [])
  }

  // Connection shape, cross-layer targets and orphan detection.
  map.layers.forEach((layer, layerIndex) => {
    if (!Array.isArray(layer)) return
    layer.forEach((node, nodeIndex) => {
      if (!isNodeLike(node) || !Array.isArray(node.connections)) return
      const path = `layers[${layerIndex}][${nodeIndex}].connections`
      const unique = new Set(node.connections)
      addIf(unique.size !== node.connections.length, errors, `${path} must not repeat targets`)

      if (layerIndex < DECISION_LAYERS - 1) {
        addIf(
          node.connections.length < 1 || node.connections.length > 2,
          errors,
          `${path} must contain 1–2 targets`,
        )
        const nextIds = new Set(layerIds[layerIndex + 1] ?? [])
        for (const targetId of node.connections) {
          addIf(!nextIds.has(targetId), errors, `${path} contains "${targetId}", which is not in the next layer`)
        }
      } else {
        addIf(
          node.connections.length !== 1 || node.connections[0] !== boss?.id,
          errors,
          `${path} must connect to the boss`,
        )
      }
    })

    if (layerIndex > 0) {
      const previous = map.layers[layerIndex - 1]
      const incoming = new Set<string>()
      if (Array.isArray(previous)) {
        for (const previousNode of previous) {
          if (isNodeLike(previousNode) && Array.isArray(previousNode.connections)) {
            for (const targetId of previousNode.connections) incoming.add(targetId)
          }
        }
      }
      for (const id of layerIds[layerIndex] ?? []) {
        addIf(!incoming.has(id), errors, `layer ${layerIndex} node "${id}" is an orphan`)
      }
    }
  })

  if (typeof map.currentNodeId === 'string' && !allNodes.has(map.currentNodeId)) {
    errors.push('map.currentNodeId must reference a node in this map')
  } else if (map.currentNodeId !== null && typeof map.currentNodeId !== 'string') {
    errors.push('map.currentNodeId must be null or a node id')
  }

  // Every node must be reachable from the start.
  const startIds = layerIds[0] ?? []
  const visited = new Set<string>(startIds)
  const queue = [...startIds]
  while (queue.length > 0) {
    const current = queue.shift() as string
    for (const targetId of connectionsById.get(current) ?? []) {
      if (!visited.has(targetId) && allNodes.has(targetId)) {
        visited.add(targetId)
        queue.push(targetId)
      }
    }
  }
  for (const id of allNodes.keys()) {
    addIf(!visited.has(id), errors, `node "${id}" is not reachable from the start`)
  }

  // Every node must have a path to the boss.
  const reverse = new Map<string, string[]>()
  for (const [id, connections] of connectionsById) {
    for (const targetId of connections) {
      const entries = reverse.get(targetId) ?? []
      entries.push(id)
      reverse.set(targetId, entries)
    }
  }
  const canReachBoss = new Set<string>()
  if (boss && allNodes.has(boss.id)) {
    canReachBoss.add(boss.id)
    const reverseQueue = [boss.id]
    while (reverseQueue.length > 0) {
      const current = reverseQueue.shift() as string
      for (const sourceId of reverse.get(current) ?? []) {
        if (!canReachBoss.has(sourceId)) {
          canReachBoss.add(sourceId)
          reverseQueue.push(sourceId)
        }
      }
    }
  }
  for (const id of allNodes.keys()) {
    addIf(!canReachBoss.has(id), errors, `node "${id}" cannot reach the boss`)
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}
