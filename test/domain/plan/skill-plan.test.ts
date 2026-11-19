import { describe, expect, it } from 'vitest';
import type { SkillFile, SkillItem } from '@/domain/catalog/skill.js';
import { treeHash } from '@/domain/hash.js';
import { buildSkillPlan, classifySkill } from '@/domain/plan/skill-plan.js';

const enc = (text: string): Uint8Array => new TextEncoder().encode(text);
const file = (path: string, text: string): SkillFile => ({ path, bytes: enc(text) });
const skill = (name: string, files: SkillFile[]): SkillItem => ({ name, description: 'd', files });

const v1 = [file('SKILL.md', 'one'), file('notes.md', 'n')];
const v2 = [file('SKILL.md', 'two')];
const root = '/h/.claude/skills/demo';
const hash = (files: SkillFile[]): string => treeHash(files) ?? '';

describe('classifySkill', () => {
  it('creates when nothing is present', () => {
    expect(classifySkill(null, 'd', undefined, false)).toEqual({ action: 'create' });
  });

  it('skips an identical tree', () => {
    expect(classifySkill('d', 'd', undefined, false)).toEqual({ action: 'skip', reason: 'already installed' });
  });

  it('updates a tree shitaku installed and did not see modified', () => {
    expect(classifySkill('p', 'd', 'p', false)).toEqual({ action: 'update', reason: 'installed by shitaku' });
  });

  it('conflicts when shitaku owns the root but the tree was modified since', () => {
    expect(classifySkill('edited', 'd', 'p', false)).toMatchObject({ action: 'conflict' });
  });

  it('conflicts when an unowned tree is present', () => {
    expect(classifySkill('p', 'd', undefined, false)).toMatchObject({ action: 'conflict' });
  });

  it('replaces any differing tree with --force', () => {
    expect(classifySkill('p', 'd', undefined, true)).toEqual({ action: 'update', reason: 'replaced by --force' });
    expect(classifySkill('edited', 'd', 'p', true)).toMatchObject({ action: 'update' });
  });

  it('still skips an identical tree with --force', () => {
    expect(classifySkill('d', 'd', undefined, true).action).toBe('skip');
  });
});

describe('buildSkillPlan', () => {
  const plan = (present: SkillFile[] | null, owned: Record<string, string> = {}, force = false) =>
    buildSkillPlan({ skills: [{ skill: skill('demo', v2), root, scope: 'project', present }], owned, force });

  it('plans a create with the desired files, hashes and no removals', () => {
    const [change] = plan(null);
    expect(change).toMatchObject({
      name: 'demo',
      root,
      action: 'create',
      files: v2,
      present: [],
      removed: [],
      presentHash: null,
      desiredHash: hash(v2),
    });
  });

  it('copies requiredBy and autoAdded from the entry and leaves the reason alone', () => {
    const [change] = buildSkillPlan({
      skills: [
        { skill: skill('demo', v2), root, scope: 'project', present: v2, requiredBy: ['a', 'b'], autoAdded: true },
      ],
      owned: {},
    });
    expect(change).toMatchObject({ requiredBy: ['a', 'b'], autoAdded: true, reason: 'already installed' });
  });

  it('adds neither field when the entry does not carry them', () => {
    const [change] = plan(null);
    expect(change).not.toHaveProperty('requiredBy');
    expect(change).not.toHaveProperty('autoAdded');
  });

  it('carries the scope of the entry into the change', () => {
    expect(plan(null)[0]?.scope).toBe('project');
  });

  it('plans a skip for an identical tree', () => {
    expect(plan(v2)[0]).toMatchObject({ action: 'skip', reason: 'already installed', removed: [] });
  });

  it('plans an update of an owned tree and lists the files the new version drops', () => {
    const [change] = plan(v1, { [root]: hash(v1) });
    expect(change).toMatchObject({ action: 'update', removed: ['notes.md'], presentHash: hash(v1) });
    expect(change?.present).toEqual(v1);
  });

  it('plans a conflict for an owned but modified tree and lists no removals', () => {
    const edited = [file('SKILL.md', 'edited')];
    expect(plan(edited, { [root]: hash(v1) })[0]).toMatchObject({ action: 'conflict', removed: [] });
  });

  it('plans a conflict for an unowned tree', () => {
    expect(plan(v1)[0]).toMatchObject({ action: 'conflict' });
  });

  it('plans a forced update of an unowned tree and lists removals', () => {
    expect(plan(v1, {}, true)[0]).toMatchObject({
      action: 'update',
      reason: 'replaced by --force',
      removed: ['notes.md'],
    });
  });

  it('treats an empty present directory as absent', () => {
    expect(plan([])[0]).toMatchObject({ action: 'create', presentHash: null, present: [] });
  });
});
