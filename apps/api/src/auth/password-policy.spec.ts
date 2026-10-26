import { describe, expect, it } from 'vitest';
import { isAllowedPassword, passwordPolicyIssue } from './password-policy';

describe('password-policy', () => {
  it('requires at least 12 chars', () => {
    expect(isAllowedPassword('short1A!')).toBe(false);
    expect(isAllowedPassword('long-enough-password-123')).toBe(true);
    expect(isAllowedPassword('')).toBe(false);
    expect(isAllowedPassword(null as unknown as string)).toBe(false);
  });

  it('rejects overlong input', () => {
    expect(isAllowedPassword('a'.repeat(257))).toBe(false);
    expect(isAllowedPassword('ab12CD-.'.repeat(32))).toBe(true);
  });

  it('rejects low-diversity passwords', () => {
    expect(isAllowedPassword('aaaaaaaaaaaa')).toBe(false);
    expect(isAllowedPassword('abcabcabcabc')).toBe(false);
    expect(isAllowedPassword('long-enough-password-123')).toBe(true);
  });

  it('rejects notorious weak substrings', () => {
    expect(isAllowedPassword('my-qwertyui-pass')).toBe(false);
    expect(isAllowedPassword('hunter2-letmein!')).toBe(false);
    expect(isAllowedPassword('MY-LIFESPIRE-2026!')).toBe(false);
  });

  it('explains each failure so the UI can show it next to the field', () => {
    expect(passwordPolicyIssue('short1A!')).toMatch(/at least 12/);
    expect(passwordPolicyIssue('ab12CD-.'.repeat(33))).toMatch(/at most 256/);
    expect(passwordPolicyIssue('abcabcabcabc')).toMatch(/5 different/);
    expect(passwordPolicyIssue('my-lifespire-2026')).toMatch(/common words/);
    expect(passwordPolicyIssue('a-good-password-123')).toBeNull();
  });
});
