import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '@lifespire/core';
import { createEmptyDocument } from '@lifespire/core';
import { structuralCheck, validateGameRules } from './sync.service';

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

  it('tracks the core schema version without a hardcoded copy', () => {
    expect(structuralCheck(base).schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('validateGameRules', () => {
  it('accepts a rule-valid document from core', () => {
    expect(validateGameRules(createEmptyDocument())).toEqual({ valid: true });
  });

  it('rejects a structurally-valid but rule-invalid document with a game-rule error', () => {
    const structurallyValid = { schemaVersion: 3, profile: null, goals: [{ id: 'x' }], tasks: [], run: null, settings: {} };
    expect(structuralCheck(structurallyValid).valid).toBe(true);
    const result = validateGameRules(structurallyValid);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/goals\[0\]/);
  });
});
