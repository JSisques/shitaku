import { describe, expect, it } from 'vitest';
import { resolveProfile, validateProfiles } from '@/domain/catalog/profile.js';
import type { Profile } from '@/domain/catalog/schema.js';

const p = (
  name: string,
  mcps: string[] = [],
  ext: string[] = [],
  skills: string[] = [],
  scripts: string[] = [],
  commands: string[] = [],
  hooks: string[] = [],
): Profile => ({
  name,
  mcps,
  extends: ext,
  skills,
  scripts,
  commands,
  hooks,
});
const MCPS = ['github', 'context7'];
const SKILLS = ['review', 'plan'];
const SCRIPTS = ['lint', 'format'];
const COMMANDS = ['review', 'plan-cmd'];
const HOOKS = ['fmt', 'guard'];

describe('resolveProfile', () => {
  it('merges parents first and de-duplicates', () => {
    const profiles = [p('base', ['context7']), p('web', ['github', 'context7'], ['base'])];
    expect(resolveProfile('web', profiles, MCPS, SKILLS, SCRIPTS, COMMANDS)).toEqual({
      mcps: ['context7', 'github'],
      skills: [],
      scripts: [],
      commands: [],
      hooks: [],
    });
  });

  it('merges skills through extends and de-duplicates', () => {
    const profiles = [p('base', [], [], ['review']), p('web', [], ['base'], ['plan', 'review'])];
    expect(resolveProfile('web', profiles, MCPS, SKILLS, SCRIPTS, COMMANDS)).toEqual({
      mcps: [],
      skills: ['review', 'plan'],
      scripts: [],
      commands: [],
      hooks: [],
    });
  });

  it('merges scripts through extends and de-duplicates', () => {
    const profiles = [p('base', [], [], [], ['lint']), p('web', [], ['base'], [], ['format', 'lint'])];
    expect(resolveProfile('web', profiles, MCPS, SKILLS, SCRIPTS, COMMANDS)).toEqual({
      mcps: [],
      skills: [],
      scripts: ['lint', 'format'],
      commands: [],
      hooks: [],
    });
  });

  it('merges commands through extends and de-duplicates', () => {
    const profiles = [p('base', [], [], [], [], ['review']), p('web', [], ['base'], [], [], ['plan-cmd', 'review'])];
    expect(resolveProfile('web', profiles, MCPS, SKILLS, SCRIPTS, COMMANDS)).toEqual({
      mcps: [],
      skills: [],
      scripts: [],
      commands: ['review', 'plan-cmd'],
      hooks: [],
    });
  });

  it('merges hooks through extends and de-duplicates', () => {
    const profiles = [p('base', [], [], [], [], [], ['fmt']), p('web', [], ['base'], [], [], [], ['guard', 'fmt'])];
    expect(resolveProfile('web', profiles, MCPS, SKILLS, SCRIPTS, COMMANDS, HOOKS).hooks).toEqual(['fmt', 'guard']);
  });

  it('resolves a profile without hooks to an empty hook list', () => {
    expect(resolveProfile('a', [p('a', ['github'])], MCPS, SKILLS, SCRIPTS, COMMANDS, HOOKS).hooks).toEqual([]);
  });

  it('fails on an unknown hook', () => {
    expect(() =>
      resolveProfile('a', [p('a', [], [], [], [], [], ['ghost'])], MCPS, SKILLS, SCRIPTS, COMMANDS, HOOKS),
    ).toThrow("profile 'a' references unknown hook 'ghost'");
  });

  it('resolves a profile without commands to an empty command list', () => {
    expect(resolveProfile('a', [p('a', ['github'])], MCPS, SKILLS, SCRIPTS, COMMANDS).commands).toEqual([]);
  });

  it('fails on an unknown command', () => {
    expect(() => resolveProfile('a', [p('a', [], [], [], [], ['ghost'])], MCPS, SKILLS, SCRIPTS, COMMANDS)).toThrow(
      "unknown command 'ghost'",
    );
  });

  it('fails on a cycle naming the path', () => {
    const profiles = [p('a', [], ['b']), p('b', [], ['a'])];
    expect(() => resolveProfile('a', profiles, MCPS, SKILLS, SCRIPTS, COMMANDS)).toThrow('a -> b -> a');
  });

  it('fails on an unknown mcp', () => {
    expect(() => resolveProfile('a', [p('a', ['ghost'])], MCPS, SKILLS, SCRIPTS, COMMANDS)).toThrow('ghost');
  });

  it('fails on an unknown skill', () => {
    expect(() => resolveProfile('a', [p('a', [], [], ['ghost'])], MCPS, SKILLS, SCRIPTS, COMMANDS)).toThrow(
      "unknown skill 'ghost'",
    );
  });

  it('fails on an unknown script', () => {
    expect(() => resolveProfile('a', [p('a', [], [], [], ['ghost'])], MCPS, SKILLS, SCRIPTS, COMMANDS)).toThrow(
      "unknown script 'ghost'",
    );
  });

  it('fails on an unknown profile', () => {
    expect(() => resolveProfile('a', [p('a', [], ['nope'])], MCPS, SKILLS, SCRIPTS, COMMANDS)).toThrow('nope');
    expect(() => resolveProfile('missing', [], MCPS, SKILLS, SCRIPTS, COMMANDS)).toThrow('missing');
  });
});

describe('validateProfiles', () => {
  it('returns no errors for a valid set', () => {
    expect(
      validateProfiles([p('base', ['context7'], [], ['review'], ['lint'])], MCPS, SKILLS, SCRIPTS, COMMANDS),
    ).toEqual([]);
  });

  it('collects one error per invalid profile', () => {
    const errors = validateProfiles(
      [
        p('a', [], ['b']),
        p('b', [], ['a']),
        p('c', ['ghost']),
        p('d', [], [], ['ghost']),
        p('e', [], [], [], ['ghost']),
        p('f', [], [], [], [], ['ghost']),
      ],
      MCPS,
      SKILLS,
      SCRIPTS,
      COMMANDS,
    );
    expect(errors).toHaveLength(6);
  });
});
