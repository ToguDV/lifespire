import { describe, expect, it } from 'vitest';

import { evidenceSchema } from './evidence';

const base = {
  id: 'evidence-1',
  taskId: 'task-1',
  checksum: 'sha256:deadbeef',
  createdAt: '2026-10-18T09:40:00.000Z',
};

describe('Evidence schema', () => {
  it('parses photo evidence with a local blob id', () => {
    expect(
      evidenceSchema.safeParse({ ...base, kind: 'photo', localBlobId: 'blob-1' }).success,
    ).toBe(true);
  });

  it('parses note evidence with a note', () => {
    expect(
      evidenceSchema.safeParse({ ...base, kind: 'note', note: 'Done in the morning.' }).success,
    ).toBe(true);
  });

  it('parses link evidence with a valid url', () => {
    expect(
      evidenceSchema.safeParse({ ...base, kind: 'link', url: 'https://example.com/pr/42' }).success,
    ).toBe(true);
  });

  it('rejects photo evidence without a local blob id', () => {
    expect(evidenceSchema.safeParse({ ...base, kind: 'photo' }).success).toBe(false);
  });

  it('rejects note evidence without a note', () => {
    expect(evidenceSchema.safeParse({ ...base, kind: 'note' }).success).toBe(false);
  });

  it('rejects link evidence with an invalid url', () => {
    expect(evidenceSchema.safeParse({ ...base, kind: 'link', url: 'not-a-url' }).success).toBe(
      false,
    );
  });

  it('rejects an unknown kind', () => {
    expect(evidenceSchema.safeParse({ ...base, kind: 'video' }).success).toBe(false);
  });
});
