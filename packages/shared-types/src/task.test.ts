import { describe, expect, it } from 'vitest';

import { taskInstanceSchema } from './task';

const validTask = {
  id: 'task-1',
  title: 'Write the sync API schema',
  successCriteria: 'The document covers push, pull and conflict resolution.',
  durationMin: 45,
  difficulty: 2,
  nodeId: 'node-1',
  status: 'pending',
  createdAt: '2026-10-18T09:00:00.000Z',
  updatedAt: '2026-10-18T09:00:00.000Z',
};

describe('TaskInstance schema', () => {
  it('parses a valid task instance', () => {
    const result = taskInstanceSchema.safeParse(validTask);
    expect(result.success).toBe(true);
  });

  it('accepts optional lifecycle timestamps', () => {
    const result = taskInstanceSchema.safeParse({
      ...validTask,
      status: 'completed',
      startedAt: '2026-10-18T09:05:00.000Z',
      completedAt: '2026-10-18T09:40:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty title', () => {
    expect(taskInstanceSchema.safeParse({ ...validTask, title: '' }).success).toBe(false);
  });

  it('rejects a non-integer or non-positive duration', () => {
    expect(taskInstanceSchema.safeParse({ ...validTask, durationMin: 0 }).success).toBe(false);
    expect(taskInstanceSchema.safeParse({ ...validTask, durationMin: 12.5 }).success).toBe(false);
  });

  it('rejects an unknown status', () => {
    expect(taskInstanceSchema.safeParse({ ...validTask, status: 'paused' }).success).toBe(false);
  });

  it('rejects a non-ISO createdAt', () => {
    expect(taskInstanceSchema.safeParse({ ...validTask, createdAt: 'yesterday' }).success).toBe(
      false,
    );
  });
});
