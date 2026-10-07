import { describe, expect, it } from 'vitest';
import { sha256 } from '@/domain/hash.js';
import { buildFlatFilePlan } from '@/domain/plan/flat-file-plan.js';

const enc = (text: string): Uint8Array => new TextEncoder().encode(text);
const path = '/w/.claude/commands/review.md';
const v1 = enc('---\ndescription: one\n---\nbody one\n');
const v2 = enc('---\ndescription: two\n---\nbody two\n');

describe('buildFlatFilePlan', () => {
  const plan = (present: Uint8Array | null, owned: Record<string, string> = {}, force = false) =>
    buildFlatFilePlan({
      entries: [{ name: 'review', path, scope: 'project', bytes: v2, present }],
      owned,
      noun: 'command',
      force,
    });

  it('plans a create for an absent file with sha256 hashes', () => {
    expect(plan(null)).toEqual([
      {
        name: 'review',
        path,
        scope: 'project',
        action: 'create',
        bytes: v2,
        present: null,
        desiredHash: sha256(v2),
        presentHash: null,
      },
    ]);
  });

  it('plans a skip for identical bytes', () => {
    expect(plan(v2)[0]).toMatchObject({ action: 'skip', reason: 'already installed', presentHash: sha256(v2) });
  });

  it('plans an update for an owned, unmodified file whose catalog bytes changed', () => {
    const [change] = plan(v1, { [path]: sha256(v1) });
    expect(change).toMatchObject({ action: 'update', reason: 'installed by shitaku', present: v1 });
    expect(change?.presentHash).toBe(sha256(v1));
  });

  it('plans a conflict for an unmanaged different file, naming the noun', () => {
    expect(plan(v1)[0]).toMatchObject({ action: 'conflict', reason: 'a different command with this name exists' });
  });

  it('plans a conflict for an owned file modified since install', () => {
    expect(plan(v1, { [path]: sha256(v2) })[0]).toMatchObject({
      action: 'conflict',
      reason: 'modified since shitaku installed it',
    });
  });

  it('plans a forced update of an unmanaged different file', () => {
    expect(plan(v1, {}, true)[0]).toMatchObject({ action: 'update', reason: 'replaced by --force' });
  });

  it('keeps one change per entry, in order, each with its own scope', () => {
    const other = '/h/.claude/commands/fix.md';
    const changes = buildFlatFilePlan({
      entries: [
        { name: 'review', path, scope: 'project', bytes: v2, present: null },
        { name: 'fix', path: other, scope: 'user', bytes: v1, present: v1 },
      ],
      owned: {},
      noun: 'command',
    });
    expect(changes.map((c) => [c.name, c.scope, c.action])).toEqual([
      ['review', 'project', 'create'],
      ['fix', 'user', 'skip'],
    ]);
  });
});
