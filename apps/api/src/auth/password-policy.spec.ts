import { describe, expect, it } from 'vitest';
import { passwordPolicyIssue } from './password-policy';

describe('password-policy', () => {
  it('requires at least 12 chars', () => {
    expect(passwordPolicyIssue('short1A!')).toMatch(/at least 12/);
    expect(passwordPolicyIssue('long-enough-password-123')).toBeNull();
    expect(passwordPolicyIssue('')).toMatch(/Choose a password/);
    expect(passwordPolicyIssue(null as unknown as string)).toMatch(/Choose a password/);
  });

  it('rejects overlong input', () => {
    expect(passwordPolicyIssue('a'.repeat(257))).toMatch(/at most 256/);
    expect(passwordPolicyIssue('ab12CD-.'.repeat(32))).toBeNull();
  });

  it('rejects low-diversity passwords', () => {
    expect(passwordPolicyIssue('aaaaaaaaaaaa')).toMatch(/5 different/);
    expect(passwordPolicyIssue('abcabcabcabc')).toMatch(/5 different/);
    expect(passwordPolicyIssue('long-enough-password-123')).toBeNull();
  });

  it('rejects notorious weak substrings', () => {
    expect(passwordPolicyIssue('my-qwertyui-pass')).toMatch(/common words/);
    expect(passwordPolicyIssue('hunter2-letmein!')).toMatch(/common words/);
    expect(passwordPolicyIssue('MY-LIFESPIRE-2026!')).toMatch(/common words/);
  });

  it('explains each failure so the UI can show it next to the field', () => {
    expect(passwordPolicyIssue('short1A!')).toMatch(/at least 12/);
    expect(passwordPolicyIssue('ab12CD-.'.repeat(33))).toMatch(/at most 256/);
    expect(passwordPolicyIssue('abcabcabcabc')).toMatch(/5 different/);
    expect(passwordPolicyIssue('my-lifespire-2026')).toMatch(/common words/);
    expect(passwordPolicyIssue('a-good-password-123')).toBeNull();
  });
});
