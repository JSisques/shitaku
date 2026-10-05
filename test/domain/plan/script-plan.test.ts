import { describe, expect, it } from 'vitest';
import type { ScriptFile, ScriptItem } from '@/domain/catalog/script.js';
import { treeHash } from '@/domain/hash.js';
import { buildScriptPlan, classifyScript } from '@/domain/plan/script-plan.js';

const enc = (text: string): Uint8Array => new TextEncoder().encode(text);
const file = (path: string, text: string): ScriptFile => ({ path, bytes: enc(text) });
const script = (name: string, files: ScriptFile[]): ScriptItem => ({
  name,
  description: 'd',
  tools: [],
  files,
});

const v1 = [file('index.mjs', 'one'), file('script.json', '{"name":"demo"}'), file('notes.md', 'n')];
const v2 = [file('index.mjs', 'two'), file('script.json', '{"name":"demo"}')];
const root = '/w/.shitaku/scripts/demo';
const hash = (files: ScriptFile[]): string => treeHash(files) ?? '';

describe('classifyScript', () => {
  it('creates when nothing is present', () => {
    expect(classifyScript(null, 'd', undefined, false)).toEqual({ action: 'create' });
  });

  it('skips an identical tree', () => {
    expect(classifyScript('d', 'd', undefined, false)).toEqual({ action: 'skip', reason: 'already installed' });
  });

  it('updates a tree shitaku installed and did not see modified', () => {
    expect(classifyScript('p', 'd', 'p', false)).toEqual({ action: 'update', reason: 'installed by shitaku' });
  });

  it('conflicts when shitaku owns the root but the tree was modified since', () => {
    expect(classifyScript('edited', 'd', 'p', false)).toMatchObject({ action: 'conflict' });
  });

  it('conflicts when an unowned tree is present', () => {
    expect(classifyScript('p', 'd', undefined, false)).toMatchObject({ action: 'conflict' });
  });

  it('replaces any differing tree with --force', () => {
    expect(classifyScript('p', 'd', undefined, true)).toEqual({ action: 'update', reason: 'replaced by --force' });
    expect(classifyScript('edited', 'd', 'p', true)).toMatchObject({ action: 'update' });
  });

  it('still skips an identical tree with --force', () => {
    expect(classifyScript('d', 'd', undefined, true).action).toBe('skip');
  });
});

describe('buildScriptPlan', () => {
  const plan = (present: ScriptFile[] | null, owned: Record<string, string> = {}, force = false) =>
    buildScriptPlan({ scripts: [{ script: script('demo', v2), root, scope: 'project', present }], owned, force });

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
    const edited = [file('index.mjs', 'edited'), file('script.json', '{}')];
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
