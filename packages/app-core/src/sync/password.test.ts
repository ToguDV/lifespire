import { describe, expect, it } from 'vitest';
import { newPasswordProblem } from './password';

describe('newPasswordProblem', () => {
  it('requires 12 characters', () => {
    expect(newPasswordProblem('short1A!')).toMatch(/12/);
    expect(newPasswordProblem('')).toMatch(/12/);
  });

  it('requires five distinct characters', () => {
    expect(newPasswordProblem('aaaaaaaaaaaa')).toMatch(/5 different/);
    expect(newPasswordProblem('abcabcabcabc')).toMatch(/5 different/);
  });

  it('rejects overlong input', () => {
    expect(newPasswordProblem('ab12CD-.'.repeat(33))).toMatch(/256/);
  });

  it('accepts a reasonable password', () => {
    expect(newPasswordProblem('a-good-password-123')).toBeNull();
  });
});
