import { describe, expect, it } from 'vitest';

import {
  evidenceKindSchema,
  nodeTypeSchema,
  nodeVisitStateSchema,
  taskStatusSchema,
} from './enums';

describe('domain enums', () => {
  it('accepts every declared NodeType and rejects unknown values', () => {
    for (const value of ['enemy', 'elite', 'event', 'shop', 'rest', 'boss']) {
      expect(nodeTypeSchema.safeParse(value).success).toBe(true);
    }
    expect(nodeTypeSchema.safeParse('dragon').success).toBe(false);
  });

  it('accepts every declared TaskStatus and rejects unknown values', () => {
    for (const value of ['pending', 'in_progress', 'completed', 'failed', 'skipped']) {
      expect(taskStatusSchema.safeParse(value).success).toBe(true);
    }
    expect(taskStatusSchema.safeParse('done').success).toBe(false);
  });

  it('accepts every declared EvidenceKind and rejects unknown values', () => {
    for (const value of ['photo', 'note', 'link']) {
      expect(evidenceKindSchema.safeParse(value).success).toBe(true);
    }
    expect(evidenceKindSchema.safeParse('video').success).toBe(false);
  });

  it('accepts every declared NodeVisitState and rejects unknown values', () => {
    for (const value of ['locked', 'available', 'current', 'visited', 'skipped']) {
      expect(nodeVisitStateSchema.safeParse(value).success).toBe(true);
    }
    expect(nodeVisitStateSchema.safeParse('failed').success).toBe(false);
  });
});
