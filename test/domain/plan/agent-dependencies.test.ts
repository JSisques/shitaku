import { describe, expect, it } from 'vitest';
import {
  isSafeSkillName,
  missingSkillWarning,
  requiredByReason,
  resolveAgentDependencies,
  unmanagedSkillNote,
} from '@/domain/plan/agent-dependencies.js';

const catalog = { skills: ['docs-writing', 'review', 'testing'] };

describe('resolveAgentDependencies', () => {
  it('returns empty results for no agents', () => {
    const { skills } = resolveAgentDependencies([], catalog);
    expect([...skills.required]).toEqual([]);
    expect(skills.missing).toEqual([]);
  });

  it('returns empty results for agents that declare no skills', () => {
    const { skills } = resolveAgentDependencies([{ name: 'a', skills: [] }], catalog);
    expect(skills.required.size).toBe(0);
    expect(skills.missing).toEqual([]);
  });

  it('lists each skill with its agents in selected-agent order, then declaration order', () => {
    const { skills } = resolveAgentDependencies(
      [
        { name: 'a', skills: ['testing', 'review'] },
        { name: 'b', skills: ['docs-writing', 'testing'] },
      ],
      catalog,
    );
    expect([...skills.required]).toEqual([
      ['testing', ['a', 'b']],
      ['review', ['a']],
      ['docs-writing', ['b']],
    ]);
  });

  it('records a skill absent from the catalog once per agent', () => {
    const { skills } = resolveAgentDependencies(
      [
        { name: 'a', skills: ['ghost', 'review'] },
        { name: 'b', skills: ['ghost'] },
      ],
      catalog,
    );
    expect([...skills.required.keys()]).toEqual(['review']);
    expect(skills.missing).toEqual([
      { agent: 'a', name: 'ghost' },
      { agent: 'b', name: 'ghost' },
    ]);
  });

  it.each(['../evil', 'Foo', 'a/b'])('puts the malformed name %s in missing', (name) => {
    const { skills } = resolveAgentDependencies([{ name: 'a', skills: [name] }], catalog);
    expect(skills.required.size).toBe(0);
    expect(skills.missing).toEqual([{ agent: 'a', name }]);
  });
});

describe('isSafeSkillName', () => {
  it.each([
    ['docs-writing', true],
    ['a', true],
    ['0abc', true],
    ['a-b-c', true],
    ['', false],
    ['-a', false],
    ['Foo', false],
    ['a/b', false],
    ['../x', false],
    ['a b', false],
    ['a_b', false],
  ])('%s -> %s', (name, expected) => {
    expect(isSafeSkillName(name)).toBe(expected);
  });
});

describe('messages', () => {
  it('uses the singular for one agent', () => {
    expect(requiredByReason(['a'])).toBe('required by agent a');
  });

  it('uses the plural for several agents', () => {
    expect(requiredByReason(['a', 'b'])).toBe('required by agents a, b');
  });

  it('words the missing-skill warning', () => {
    expect(missingSkillWarning('a', 'ghost')).toBe('agent a requires skill ghost, which is not in the catalog');
  });

  it('words the unmanaged-skill note', () => {
    expect(unmanagedSkillNote('a', 'local-skill')).toBe(
      'agent a requires skill local-skill, found on disk, not managed by shitaku',
    );
  });
});
