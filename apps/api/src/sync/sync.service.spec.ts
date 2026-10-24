import { describe, expect, it } from 'vitest';
import { structuralCheck } from './sync.service';

describe('structuralCheck', () => {
  const base = { schemaVersion: 3, profile: null, goals: [], tasks: [], run: null, settings: {} };

  it('accepts a well-shaped document', () => {
    expect(structuralCheck(base)).toEqual({ schemaVersion: 3, valid: true, future: false });
  });

  it('rejects non-objects and missing keys', () => {
    expect(structuralCheck(null).valid).toBe(false);
    expect(structuralCheck([]).valid).toBe(false);
    expect(structuralCheck({ schemaVersion: 3 }).valid).toBe(false);
    expect(structuralCheck({ ...base, goals: {} }).valid).toBe(false);
  });

  it('flags future schemas', () => {
    expect(structuralCheck({ ...base, schemaVersion: 99 })).toEqual({
      schemaVersion: 99,
      valid: true,
      future: true,
    });
  });
});
