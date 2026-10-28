import { computeRunTotals } from './lifecycle.js'
import { SCHEMA_VERSION } from './balance.js'
import { parseDocument } from './schema.js'
import { levelForXp } from './selectors.js'
import type {
  Day,
  GameDocument,
  MapNode,
  Profile,
  RewardEvent,
  Run,
  RunObjective,
} from './types.js'

export interface MergeSuccess {
  ok: true
  document: GameDocument
}

export interface MergeFailure {
  ok: false
  conflicts: string[]
}

export type MergeResult = MergeSuccess | MergeFailure

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Structural equality independent of key order (docs only carry JSON data). */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index]))
  }
  if (isRecord(a) && isRecord(b)) {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    if (keysA.length !== keysB.length) return false
    return keysA.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]))
  }
  return false
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * Conservative 3-way merge for snapshot sync.
 *
 * Only auto-merges when both sides' edits are disjoint (or byte-identical):
 * profile counters are summed from non-overlapping deltas, goals/tasks merge
 * per entity, and run days union their resolution paths. Anything ambiguous —
 * same entity edited twice, same map layer resolved differently, divergent
 * maps, new runs on both sides — returns the conflict list so the caller can
 * fall back to the explicit keep-mine/keep-cloud dialog. Never invents state.
 */
export function tryAutoMerge(
  base: GameDocument | null,
  local: GameDocument,
  remote: GameDocument,
): MergeResult {
  if (!base) return { ok: false, conflicts: ['no base snapshot to merge against'] }
  if (deepEqual(local, remote)) return { ok: true, document: clone(local) }
  if (deepEqual(local, base)) return { ok: true, document: clone(remote) }
  if (deepEqual(remote, base)) return { ok: true, document: clone(local) }

  const conflicts: string[] = []

  const settings = mergeSettings(base, local, remote, conflicts)
  const onboardingDraft = mergeDraft(base, local, remote, conflicts)
  const goals = mergeEntities(base.goals, local.goals, remote.goals, 'goal', conflicts)
  const tasks = mergeEntities(base.tasks, local.tasks, remote.tasks, 'task', conflicts)
  const run = mergeRun(base.run, local.run, remote.run, conflicts)
  if (!goals || !tasks || !run.ok) {
    return { ok: false, conflicts }
  }
  const profile = mergeProfile(base, local, remote, conflicts)
  if (!profile || conflicts.length > 0) {
    return { ok: false, conflicts }
  }

  const merged: GameDocument = {
    schemaVersion: SCHEMA_VERSION,
    profile,
    goals,
    tasks,
    run: run.value,
    onboardingDraft,
    settings,
  }
  const parsed = parseDocument(merged)
  if (!parsed.ok) {
    conflicts.push(`merged document is invalid: ${parsed.error}`)
    return { ok: false, conflicts }
  }
  return { ok: true, document: parsed.value }
}

function mergeSettings(
  base: GameDocument,
  local: GameDocument,
  remote: GameDocument,
  conflicts: string[],
): GameDocument['settings'] {
  if (deepEqual(local.settings, remote.settings)) return clone(local.settings)
  if (deepEqual(local.settings, base.settings)) return clone(remote.settings)
  if (deepEqual(remote.settings, base.settings)) return clone(local.settings)
  conflicts.push('settings changed on both devices')
  return clone(local.settings)
}

function mergeDraft(
  base: GameDocument,
  local: GameDocument,
  remote: GameDocument,
  conflicts: string[],
): GameDocument['onboardingDraft'] {
  if (deepEqual(local.onboardingDraft, remote.onboardingDraft)) {
    return clone(local.onboardingDraft)
  }
  if (deepEqual(local.onboardingDraft, base.onboardingDraft)) {
    return clone(remote.onboardingDraft)
  }
  if (deepEqual(remote.onboardingDraft, base.onboardingDraft)) {
    return clone(local.onboardingDraft)
  }
  conflicts.push('onboarding draft changed on both devices')
  return clone(local.onboardingDraft)
}

function mergeEntities<T extends { id: string }>(
  base: readonly T[],
  local: readonly T[],
  remote: readonly T[],
  label: string,
  conflicts: string[],
): T[] | null {
  const baseById = new Map(base.map((item) => [item.id, item]))
  const localById = new Map(local.map((item) => [item.id, item]))
  const remoteById = new Map(remote.map((item) => [item.id, item]))
  const ids = new Set([...baseById.keys(), ...localById.keys(), ...remoteById.keys()])
  const merged: T[] = []
  let failed = false

  for (const id of ids) {
    const b = baseById.get(id)
    const l = localById.get(id)
    const r = remoteById.get(id)
    if (b && l && r) {
      if (deepEqual(l, r)) merged.push(clone(l))
      else if (deepEqual(l, b)) merged.push(clone(r))
      else if (deepEqual(r, b)) merged.push(clone(l))
      else {
        conflicts.push(`${label} "${id}" edited on both devices`)
        failed = true
      }
    } else if (!b && l && r) {
      if (deepEqual(l, r)) merged.push(clone(l))
      else {
        conflicts.push(`${label} "${id}" added differently on both devices`)
        failed = true
      }
    } else if (!b && l && !r) {
      merged.push(clone(l))
    } else if (!b && !l && r) {
      merged.push(clone(r))
    } else if (b && !l && !r) {
      // Removed on both sides.
    } else if (b && l && !r) {
      if (deepEqual(l, b)) {
        // Removed remotely, untouched locally.
      } else {
        conflicts.push(`${label} "${id}" edited here but removed in the cloud`)
        failed = true
      }
    } else if (b && !l && r) {
      if (deepEqual(r, b)) {
        // Removed locally, untouched remotely.
      } else {
        conflicts.push(`${label} "${id}" removed here but edited in the cloud`)
        failed = true
      }
    }
  }

  if (failed) return null
  // Keep base order, then local-only additions, then remote-only additions.
  const order = [...base.map((item) => item.id)]
  for (const item of [...local, ...remote]) {
    if (!order.includes(item.id)) order.push(item.id)
  }
  const byId = new Map(merged.map((item) => [item.id, item]))
  return order.flatMap((id) => (byId.get(id) ? [byId.get(id)!] : []))
}

function collectRewards(run: Run | null): Map<string, RewardEvent> {
  const events = new Map<string, RewardEvent>()
  if (!run) return events
  for (const day of run.days) {
    for (const event of day.rewards) {
      events.set(`${event.dayIndex}:${event.nodeId}`, event)
    }
  }
  return events
}

function mergeProfile(
  base: GameDocument,
  local: GameDocument,
  remote: GameDocument,
  conflicts: string[],
): Profile | null {
  const b = base.profile
  const l = local.profile
  const r = remote.profile
  if (l === null && r === null) return null
  if (deepEqual(l, r)) return clone(l)
  if (deepEqual(l, b)) return clone(r)
  if (deepEqual(r, b)) return clone(l)
  if (l === null || r === null) {
    conflicts.push('profile removed on one device but edited on the other')
    return null
  }
  if (b === null) {
    conflicts.push('profile created differently on both devices')
    return null
  }
  if (l.id !== r.id) {
    conflicts.push('profiles belong to different accounts')
    return null
  }

  let name = l.name
  if (l.name !== r.name) {
    if (deepEqual(l.name, b.name)) name = r.name
    else if (deepEqual(r.name, b.name)) name = l.name
    else {
      conflicts.push('profile name changed on both devices')
      return null
    }
  }

  // Counters only merge when both sides moved forward on disjoint node sets.
  // Overlapping resolutions (same node completed twice) dedupe only when the
  // events — and therefore the profile deltas — are identical.
  const baseEvents = collectRewards(base.run)
  const localEvents = collectRewards(local.run)
  const remoteEvents = collectRewards(remote.run)
  const newLocal = [...localEvents.keys()].filter((id) => !baseEvents.has(id))
  const newRemote = [...remoteEvents.keys()].filter((id) => !baseEvents.has(id))
  const overlap = newLocal.filter((id) => newRemote.includes(id))
  for (const [nodeId, event] of localEvents) {
    const baseEvent = baseEvents.get(nodeId)
    if (baseEvent && !deepEqual(event, { ...baseEvent, at: event.at }) && !deepEqual(event, baseEvent)) {
      conflicts.push(`reward history for "${nodeId}" was rewritten`)
      return null
    }
  }
  for (const [nodeId, event] of remoteEvents) {
    const baseEvent = baseEvents.get(nodeId)
    if (baseEvent && !deepEqual(event, baseEvent) && !deepEqual(event, { ...baseEvent, at: event.at })) {
      conflicts.push(`reward history for "${nodeId}" was rewritten`)
      return null
    }
  }

  const deltaLocalXp = l.xp - b.xp
  const deltaRemoteXp = r.xp - b.xp
  const deltaLocalGold = l.gold - b.gold
  const deltaRemoteGold = r.gold - b.gold

  let xp: number
  let gold: number
  if (overlap.length === 0) {
    if (deltaLocalXp < 0 || deltaRemoteXp < 0 || deltaLocalGold < 0 || deltaRemoteGold < 0) {
      conflicts.push('profile counters moved backwards on one device')
      return null
    }
    xp = b.xp + deltaLocalXp + deltaRemoteXp
    gold = b.gold + deltaLocalGold + deltaRemoteGold
  } else {
    for (const key of overlap) {
      const localEvent = localEvents.get(key)!
      const remoteEvent = remoteEvents.get(key)!
      if (!eventsEqualIgnoringAt(localEvent, remoteEvent)) {
        conflicts.push(`node "${localEvent.nodeId}" resolved differently on both devices`)
        return null
      }
    }
    if (deltaLocalXp !== deltaRemoteXp || deltaLocalGold !== deltaRemoteGold) {
      conflicts.push('same nodes resolved on both devices but counters disagree')
      return null
    }
    xp = b.xp + deltaLocalXp
    gold = b.gold + deltaLocalGold
  }

  const loot = mergeLoot(b.loot, l.loot, r.loot, conflicts)
  if (!loot) return null

  return { id: l.id, name, xp, level: levelForXp(xp), gold, loot, createdAt: l.createdAt }
}

function eventsEqualIgnoringAt(a: RewardEvent, b: RewardEvent): boolean {
  return deepEqual({ ...a, at: '' }, { ...b, at: '' })
}

function mergeLoot(
  base: Profile['loot'],
  local: Profile['loot'],
  remote: Profile['loot'],
  conflicts: string[],
): Profile['loot'] | null {
  const baseById = new Map(base.map((item) => [item.id, item]))
  const merged = new Map<string, (typeof base)[number]>()
  for (const item of base) merged.set(item.id, clone(item))
  const add = (items: Profile['loot'], side: string): boolean => {
    for (const item of items) {
      if (baseById.has(item.id)) {
        const current = merged.get(item.id)!
        if (!deepEqual(current, item)) {
          conflicts.push(`loot "${item.id}" changed on ${side}`)
          return false
        }
        continue
      }
      const existing = merged.get(item.id)
      if (existing) {
        if (!deepEqual(existing, item)) {
          conflicts.push(`loot "${item.id}" added differently on both devices`)
          return false
        }
        continue
      }
      merged.set(item.id, clone(item))
    }
    return true
  }
  if (!add(local.filter((item) => !baseById.has(item.id)), 'this device')) return null
  if (!add(remote.filter((item) => !baseById.has(item.id)), 'the cloud')) return null

  const seenCatalogs = new Map<string, string>()
  for (const item of merged.values()) {
    const first = seenCatalogs.get(item.catalogId)
    if (first && first !== item.id) {
      conflicts.push(`loot "${item.catalogId}" found twice after merging`)
      return null
    }
    seenCatalogs.set(item.catalogId, item.id)
  }
  return [...merged.values()]
}

function mergeRun(
  base: Run | null,
  local: Run | null,
  remote: Run | null,
  conflicts: string[],
): { ok: true; value: Run | null } | { ok: false } {
  if (deepEqual(local, remote)) return { ok: true, value: clone(local) }
  if (deepEqual(local, base)) return { ok: true, value: clone(remote) }
  if (deepEqual(remote, base)) return { ok: true, value: clone(local) }
  if (base === null || local === null || remote === null) {
    conflicts.push('run created or removed on one device only in a conflicting way')
    return { ok: false }
  }
  if (local.id !== base.id || remote.id !== base.id) {
    if (local.id === remote.id && deepEqual(local, remote)) {
      return { ok: true, value: clone(local) }
    }
    conflicts.push('a new run started on one device while the other kept playing')
    return { ok: false }
  }

  for (const key of ['seed', 'generatorVersion', 'startDate', 'timeZone', 'createdAt'] as const) {
    if (!deepEqual(local[key], remote[key])) {
      if (deepEqual(local[key], base[key])) continue
      if (deepEqual(remote[key], base[key])) continue
      conflicts.push(`run ${key} changed on both devices`)
      return { ok: false }
    }
  }

  const objectives = mergeObjectives(base, local, remote, conflicts)
  if (!objectives) return { ok: false }
  const days = mergeDays(base, local, remote, conflicts)
  if (!days) return { ok: false }
  if (conflicts.length > 0) return { ok: false }

  const daysEqualLocal = deepEqual(days, local.days)
  const daysEqualRemote = deepEqual(days, remote.days)
  let status: Run['status']
  let closedAt: string | null
  let summary: Run['summary']
  let totals: Run['totals']
  if (daysEqualLocal && daysEqualRemote) {
    status = local.status
    closedAt = local.closedAt
    summary = clone(local.summary)
    totals = clone(local.totals)
  } else if (daysEqualLocal) {
    status = local.status
    closedAt = local.closedAt
    summary = clone(local.summary)
    totals = clone(local.totals)
  } else if (daysEqualRemote) {
    status = remote.status
    closedAt = remote.closedAt
    summary = clone(remote.summary)
    totals = clone(remote.totals)
  } else if (deepEqual(local.status, base.status) && deepEqual(remote.status, base.status)) {
    status = base.status
    closedAt = base.closedAt
    summary = clone(base.summary)
    totals = computeRunTotals({ ...base, days, objectives } as Run)
  } else {
    conflicts.push('both devices advanced different days')
    return { ok: false }
  }

  if (status === 'closed' && base.status === 'active') {
    // A close seals weekly bonuses; both sides closing differently is explicit.
    if (!daysEqualLocal && !daysEqualRemote) {
      conflicts.push('run closed differently on both devices')
      return { ok: false }
    }
  }
  if (base.status === 'closed' && (!daysEqualLocal || !deepEqual(objectives, base.objectives))) {
    conflicts.push('closed run changed')
    return { ok: false }
  }

  return {
    ok: true,
    value: {
      ...clone(base),
      status,
      objectives,
      days,
      totals,
      createdAt: base.createdAt,
      closedAt,
      summary,
    },
  }
}

function mergeObjectives(
  base: Run,
  local: Run,
  remote: Run,
  conflicts: string[],
): RunObjective[] | null {
  const baseById = new Map(base.objectives.map((objective) => [objective.goalId, objective]))
  const localById = new Map(local.objectives.map((objective) => [objective.goalId, objective]))
  const remoteById = new Map(remote.objectives.map((objective) => [objective.goalId, objective]))
  const ids = new Set([...baseById.keys(), ...localById.keys(), ...remoteById.keys()])
  const merged: RunObjective[] = []
  for (const id of ids) {
    const b = baseById.get(id)
    const l = localById.get(id)
    const r = remoteById.get(id)
    if (b && l && r) {
      const title = mergeScalar(`objective "${id}" title`, b.goalTitle, l.goalTitle, r.goalTitle, conflicts)
      const target = mergeScalar(`objective "${id}" target`, b.target, l.target, r.target, conflicts)
      if (!title.ok || !target.ok) return null
      const progress = mergeProgress(`objective "${id}" progress`, b.progress, l.progress, r.progress, conflicts)
      if (progress === null) return null
      merged.push({ goalId: id, goalTitle: title.value, target: target.value, progress })
    } else if (!b && l && !r) {
      merged.push(clone(l))
    } else if (!b && !l && r) {
      merged.push(clone(r))
    } else if (!b && l && r) {
      if (!deepEqual(l, r)) {
        conflicts.push(`objective "${id}" added differently on both devices`)
        return null
      }
      merged.push(clone(l))
    } else if (b && !l && !r) {
      // Removed on both sides.
    } else {
      conflicts.push(`objective "${id}" added or removed on one device only in a conflicting way`)
      return null
    }
  }
  const order = [...base.objectives.map((objective) => objective.goalId)]
  for (const objective of [...local.objectives, ...remote.objectives]) {
    if (!order.includes(objective.goalId)) order.push(objective.goalId)
  }
  const byId = new Map(merged.map((objective) => [objective.goalId, objective]))
  return order.flatMap((id) => (byId.get(id) ? [byId.get(id)!] : []))
}

function mergeScalar<T>(
  label: string,
  base: T,
  local: T,
  remote: T,
  conflicts: string[],
): { ok: true; value: T } | { ok: false } {
  if (deepEqual(local, remote)) return { ok: true, value: clone(local) }
  if (deepEqual(local, base)) return { ok: true, value: clone(remote) }
  if (deepEqual(remote, base)) return { ok: true, value: clone(local) }
  conflicts.push(`${label} changed on both devices`)
  return { ok: false }
}

function mergeProgress(
  label: string,
  base: number,
  local: number,
  remote: number,
  conflicts: string[],
): number | null {
  if (local === remote) return local
  if (local === base) return remote
  if (remote === base) return local
  const deltaLocal = local - base
  const deltaRemote = remote - base
  if (deltaLocal < 0 || deltaRemote < 0) {
    conflicts.push(`${label} moved backwards`)
    return null
  }
  return base + deltaLocal + deltaRemote
}

function mergeDays(base: Run, local: Run, remote: Run, conflicts: string[]): Day[] | null {
  if (base.days.length !== local.days.length || base.days.length !== remote.days.length) {
    conflicts.push('run length changed')
    return null
  }
  const merged: Day[] = []
  for (let index = 0; index < base.days.length; index += 1) {
    const day = mergeDay(base.days[index]!, local.days[index]!, remote.days[index]!, conflicts)
    if (!day) return null
    merged.push(day)
  }
  return merged
}

function nodeLayer(map: Day['map'], nodeId: string): number | null {
  if (!map) return null
  for (const layer of map.layers) {
    const node = layer.find((candidate: MapNode) => candidate.id === nodeId)
    if (node) return node.layer
  }
  if (map.boss.id === nodeId) return map.boss.layer
  return null
}

function mergeDay(base: Day, local: Day, remote: Day, conflicts: string[]): Day | null {
  if (local.id !== base.id || remote.id !== base.id || local.id !== remote.id) {
    conflicts.push(`day "${base.id}" belongs to different runs`)
    return null
  }
  if (local.index !== base.index || remote.index !== base.index || local.date !== base.date || remote.date !== base.date) {
    conflicts.push(`day "${base.id}" date changed`)
    return null
  }
  if (deepEqual(local, remote)) return clone(local)
  if (deepEqual(local, base)) return clone(remote)
  if (deepEqual(remote, base)) return clone(local)

  const mapResult = mergeScalar(`day "${base.id}" map`, base.map, local.map, remote.map, conflicts)
  if (!mapResult.ok) return null
  const map = mapResult.value

  const path = mergePath(base, local, remote, map ?? null, conflicts)
  if (!path) return null
  const rewards = mergeDayRewards(base, local, remote, conflicts)
  if (!rewards) return null

  // A pending selection next to new resolutions is ambiguous: the selection
  // may no longer be reachable from the merged path.
  const baseCurrent = base.map?.currentNodeId ?? null
  const mergedCurrent = map?.currentNodeId ?? null
  const pathAdvanced = !deepEqual(path, base.path)
  if (pathAdvanced && mergedCurrent !== null && !deepEqual(mergedCurrent, baseCurrent)) {
    const inPath = path.some((entry) => entry.nodeId === mergedCurrent)
    if (inPath) {
      conflicts.push(`day "${base.id}" selection was already resolved in the merged path`)
      return null
    }
    const localAdvanced = !deepEqual(local.path, base.path)
    const remoteAdvanced = !deepEqual(remote.path, base.path)
    if (localAdvanced && remoteAdvanced) {
      conflicts.push(`day "${base.id}" selection changed alongside resolutions`)
      return null
    }
    if ((localAdvanced && !deepEqual(mergedCurrent, local.map?.currentNodeId ?? null)) ||
      (remoteAdvanced && !deepEqual(mergedCurrent, remote.map?.currentNodeId ?? null))) {
      conflicts.push(`day "${base.id}" selection changed alongside resolutions`)
      return null
    }
  }

  const localPathMatches = deepEqual(path, local.path) && deepEqual(rewards, local.rewards)
  const remotePathMatches = deepEqual(path, remote.path) && deepEqual(rewards, remote.rewards)
  if (localPathMatches && remotePathMatches) {
    if (!deepEqual(local.status, remote.status) || !deepEqual(local.summary, remote.summary)) {
      conflicts.push(`day "${base.id}" closed differently on both devices`)
      return null
    }
    return { ...clone(base), map, path, rewards, status: local.status, openedAt: local.openedAt, closedAt: local.closedAt, summary: clone(local.summary) }
  }
  if (localPathMatches) {
    return { ...clone(base), map, path, rewards, status: local.status, openedAt: local.openedAt, closedAt: local.closedAt, summary: clone(local.summary) }
  }
  if (remotePathMatches) {
    return { ...clone(base), map, path, rewards, status: remote.status, openedAt: remote.openedAt, closedAt: remote.closedAt, summary: clone(remote.summary) }
  }
  if (deepEqual(path, base.path) && deepEqual(rewards, base.rewards)) {
    // No new resolutions; status may still have moved (day opened).
    const statusResult = mergeScalar(`day "${base.id}" status`, base.status, local.status, remote.status, conflicts)
    if (!statusResult.ok) return null
    const openedResult = mergeScalar(`day "${base.id}" openedAt`, base.openedAt, local.openedAt, remote.openedAt, conflicts)
    if (!openedResult.ok) return null
    return { ...clone(base), map, path, rewards, status: statusResult.value, openedAt: openedResult.value, closedAt: base.closedAt, summary: clone(base.summary) }
  }
  conflicts.push(`day "${base.id}" advanced differently on both devices`)
  return null
}

function mergePath(
  base: Day,
  local: Day,
  remote: Day,
  map: Day['map'],
  conflicts: string[],
): Day['path'] | null {
  const baseById = new Map(base.path.map((entry) => [entry.nodeId, entry]))
  // History rewrites are never merged.
  for (const entry of [...local.path, ...remote.path]) {
    const original = baseById.get(entry.nodeId)
    if (original && (original.action !== entry.action)) {
      conflicts.push(`day "${base.id}" rewrites "${entry.nodeId}"`)
      return null
    }
  }
  const union = new Map<string, Day['path'][number]>()
  for (const entry of [...local.path, ...remote.path]) {
    const existing = union.get(entry.nodeId)
    if (!existing) {
      union.set(entry.nodeId, clone(entry))
    } else if (existing.action !== entry.action) {
      conflicts.push(`day "${base.id}" resolves "${entry.nodeId}" differently on both devices`)
      return null
    } else if (entry.at < existing.at) {
      union.set(entry.nodeId, clone(entry))
    }
  }
  // Base entries never disappear.
  for (const entry of base.path) {
    if (!union.has(entry.nodeId)) {
      conflicts.push(`day "${base.id}" drops "${entry.nodeId}" from the path`)
      return null
    }
  }
  const entries = [...union.values()]

  if (map) {
    const byLayer = new Map<number, string[]>()
    for (const entry of entries) {
      const layer = nodeLayer(map, entry.nodeId)
      if (layer === null) {
        conflicts.push(`day "${base.id}" references "${entry.nodeId}" outside the map`)
        return null
      }
      const group = byLayer.get(layer) ?? []
      if (!group.includes(entry.nodeId)) group.push(entry.nodeId)
      byLayer.set(layer, group)
    }
    for (const [layer, nodeIds] of byLayer) {
      if (nodeIds.length > 1) {
        conflicts.push(`day "${base.id}" takes different nodes in layer ${layer}`)
        return null
      }
    }
    entries.sort((a, b) => (nodeLayer(map, a.nodeId) ?? 0) - (nodeLayer(map, b.nodeId) ?? 0))
  } else if (entries.length > 0) {
    conflicts.push(`day "${base.id}" has resolutions without a map`)
    return null
  }
  return entries
}

function mergeDayRewards(
  base: Day,
  local: Day,
  remote: Day,
  conflicts: string[],
): RewardEvent[] | null {
  const baseById = new Map(base.rewards.map((event) => [event.nodeId, event]))
  for (const event of [...local.rewards, ...remote.rewards]) {
    const original = baseById.get(event.nodeId)
    if (original && !deepEqual(original, event) && !eventsEqualIgnoringAt(original, event)) {
      conflicts.push(`day "${base.id}" rewrites rewards for "${event.nodeId}"`)
      return null
    }
  }
  const union = new Map<string, RewardEvent>()
  for (const event of [...local.rewards, ...remote.rewards]) {
    const existing = union.get(event.nodeId)
    if (!existing) {
      union.set(event.nodeId, clone(event))
    } else if (!eventsEqualIgnoringAt(existing, event)) {
      conflicts.push(`day "${base.id}" grants different rewards for "${event.nodeId}"`)
      return null
    } else if (event.at < existing.at) {
      union.set(event.nodeId, clone(event))
    }
  }
  for (const event of base.rewards) {
    if (!union.has(event.nodeId)) {
      conflicts.push(`day "${base.id}" drops rewards for "${event.nodeId}"`)
      return null
    }
  }
  return [...union.values()].sort((a, b) => a.nodeId.localeCompare(b.nodeId))
}
