import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { colors, cssVarName } from './tokens';

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');

describe('design tokens', () => {
  it('exposes exactly 12 color tokens', () => {
    expect(Object.keys(colors)).toHaveLength(12);
  });

  it('uses valid #RRGGBB hex for every color token', () => {
    for (const [name, value] of Object.entries(colors)) {
      expect(value, `token "${name}"`).toMatch(HEX_PATTERN);
    }
  });

  it('keeps every hex unique', () => {
    const values = Object.values(colors).map((value) => value.toUpperCase());
    expect(new Set(values).size).toBe(values.length);
  });

  it('declares a --ls-* CSS variable for every token with the same value', () => {
    for (const [name, value] of Object.entries(colors)) {
      const varName = cssVarName(name as keyof typeof colors);
      const match = css.match(new RegExp(`${varName}\\s*:\\s*(#[0-9A-Fa-f]{6})`));
      expect(match, `missing CSS variable ${varName}`).not.toBeNull();
      expect(match?.[1]?.toUpperCase()).toBe(value.toUpperCase());
    }
  });
});
