import { describe, expect, it } from 'vitest';
import { resolveProfile, validateProfiles } from '@/domain/catalog/profile.js';
import type { Profile } from '@/domain/catalog/schema.js';

const p = (
  name: string,
  mcps: string[] = [],
  ext: string[] = [],
  skills: string[] = [],
  scripts: string[] = [],
): Profile => ({
  name,
  mcps,
  extends: ext,
  skills,
  scripts,
});
const MCPS = ['github', 'context7'];
const SKILLS = ['review', 'plan'];
const SCRIPTS = ['lint', 'format'];

describe('resolveProfile', () => {
  it('merges parents first and de-duplicates', () => {
    const profiles = [p('base', ['context7']), p('web', ['github', 'context7'], ['base'])];
    expect(resolveProfile('web', profiles, MCPS, SKILLS, SCRIPTS)).toEqual({
      mcps: ['context7', 'github'],
      skills: [],
      scripts: [],
    });
  });

  it('merges skills through extends and de-duplicates', () => {
    const profiles = [p('base', [], [], ['review']), p('web', [], ['base'], ['plan', 'review'])];
    expect(resolveProfile('web', profiles, MCPS, SKILLS, SCRIPTS)).toEqual({
      mcps: [],
      skills: ['review', 'plan'],
      scripts: [],
    });
  });

  it('merges scripts through extends and de-duplicates', () => {
    const profiles = [p('base', [], [], [], ['lint']), p('web', [], ['base'], [], ['format', 'lint'])];
    expect(resolveProfile('web', profiles, MCPS, SKILLS, SCRIPTS)).toEqual({
      mcps: [],
      skills: [],
      scripts: ['lint', 'format'],
    });
  });

  it('fails on a cycle naming the path', () => {
    const profiles = [p('a', [], ['b']), p('b', [], ['a'])];
    expect(() => resolveProfile('a', profiles, MCPS, SKILLS, SCRIPTS)).toThrow('a -> b -> a');
  });

  it('fails on an unknown mcp', () => {
    expect(() => resolveProfile('a', [p('a', ['ghost'])], MCPS, SKILLS, SCRIPTS)).toThrow('ghost');
  });

  it('fails on an unknown skill', () => {
    expect(() => resolveProfile('a', [p('a', [], [], ['ghost'])], MCPS, SKILLS, SCRIPTS)).toThrow(
      "unknown skill 'ghost'",
    );
  });

  it('fails on an unknown script', () => {
    expect(() => resolveProfile('a', [p('a', [], [], [], ['ghost'])], MCPS, SKILLS, SCRIPTS)).toThrow(
      "unknown script 'ghost'",
    );
  });

  it('fails on an unknown profile', () => {
    expect(() => resolveProfile('a', [p('a', [], ['nope'])], MCPS, SKILLS, SCRIPTS)).toThrow('nope');
    expect(() => resolveProfile('missing', [], MCPS, SKILLS, SCRIPTS)).toThrow('missing');
  });
});

describe('validateProfiles', () => {
  it('returns no errors for a valid set', () => {
    expect(validateProfiles([p('base', ['context7'], [], ['review'], ['lint'])], MCPS, SKILLS, SCRIPTS)).toEqual([]);
  });

  it('collects one error per invalid profile', () => {
    const errors = validateProfiles(
      [
        p('a', [], ['b']),
        p('b', [], ['a']),
        p('c', ['ghost']),
        p('d', [], [], ['ghost']),
        p('e', [], [], [], ['ghost']),
      ],
      MCPS,
      SKILLS,
      SCRIPTS,
    );
    expect(errors).toHaveLength(5);
  });
});
