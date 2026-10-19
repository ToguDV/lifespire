import type { MapData, MapNode, NodeType } from '@lifespire/engine';
import type { EvidenceKind, TaskInstance } from '@lifespire/shared-types';

/**
 * Minimal shape of the i18next translate function this module needs. Declaring
 * it locally keeps the module free of i18next's generic types.
 */
export type TemplateTranslate = (key: string, options: { returnObjects: true }) => unknown;

/**
 * M0 placeholder task content.
 *
 * Real tasks in M0 come from manual creation + curated templates + routines
 * (roadmap §M0), which is a separate piece of work. Until that lands, the Home
 * detail panel previews one deterministic template per node so the map is
 * meaningful. Rewards and difficulty always come from `@lifespire/engine`; only
 * the human-facing title, success criteria, duration and expected evidence are
 * defined here, and they live in the locale files.
 */
export interface TaskTemplate {
  title: string;
  criteria: string;
  durationMin: number;
  evidence: EvidenceKind[];
}

const TEMPLATE_DURATION_MIN: Record<NodeType, number> = {
  enemy: 30,
  elite: 60,
  event: 15,
  shop: 10,
  rest: 20,
  boss: 90,
};

const TEMPLATE_EVIDENCE: Record<NodeType, EvidenceKind[]> = {
  enemy: ['note'],
  elite: ['note', 'link'],
  event: ['note'],
  shop: ['note'],
  rest: ['note'],
  boss: ['photo', 'note'],
};

/** FNV-1a: a tiny stable hash so the same node always picks the same template. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

interface TemplateText {
  title: string;
  criteria: string;
}

function readTemplates(type: NodeType, t: TemplateTranslate): TemplateText[] {
  const value = t(`node:templates.${type}`, { returnObjects: true });
  if (Array.isArray(value)) {
    return value.filter(
      (entry): entry is TemplateText =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as TemplateText).title === 'string' &&
        typeof (entry as TemplateText).criteria === 'string',
    );
  }
  return [];
}

export function selectTemplate(node: MapNode, t: TemplateTranslate): TaskTemplate {
  const templates = readTemplates(node.type, t);
  const fallback: TemplateText = { title: node.type, criteria: node.type };
  const pick = templates.length > 0 ? templates[hashString(node.id) % templates.length] : undefined;
  const text = pick ?? fallback;

  return {
    title: text.title,
    criteria: text.criteria,
    durationMin: TEMPLATE_DURATION_MIN[node.type],
    evidence: TEMPLATE_EVIDENCE[node.type],
  };
}

export function expectedEvidence(node: MapNode): EvidenceKind[] {
  return TEMPLATE_EVIDENCE[node.type];
}

/** Build one persisted task instance per node of the day's map. */
export function buildTasksForDay(
  map: MapData,
  t: TemplateTranslate,
  dayKey: string,
): TaskInstance[] {
  const now = new Date().toISOString();

  return Object.values(map.nodes).map((node) => {
    const template = selectTemplate(node, t);
    return {
      id: `${dayKey}:${node.id}`,
      title: template.title,
      successCriteria: template.criteria,
      durationMin: template.durationMin,
      difficulty: node.difficulty,
      nodeId: node.id,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    } satisfies TaskInstance;
  });
}
