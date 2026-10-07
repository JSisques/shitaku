import { describe, expect, it } from 'vitest';
import { classifyOwned } from '@/domain/plan/classify.js';

describe('classifyOwned', () => {
  it('creates when nothing is present', () => {
    expect(classifyOwned(null, 'd', undefined, false, 'command')).toEqual({ action: 'create' });
  });

  it('skips an identical hash, even with force', () => {
    expect(classifyOwned('d', 'd', undefined, false, 'command')).toEqual({
      action: 'skip',
      reason: 'already installed',
    });
    expect(classifyOwned('d', 'd', undefined, true, 'command').action).toBe('skip');
  });

  it('updates what shitaku installed and did not see modified', () => {
    expect(classifyOwned('p', 'd', 'p', false, 'command')).toEqual({
      action: 'update',
      reason: 'installed by shitaku',
    });
  });

  it('replaces any differing hash with force', () => {
    expect(classifyOwned('p', 'd', undefined, true, 'command')).toEqual({
      action: 'update',
      reason: 'replaced by --force',
    });
  });

  it('conflicts on an unowned item and names the noun', () => {
    expect(classifyOwned('p', 'd', undefined, false, 'command')).toEqual({
      action: 'conflict',
      reason: 'a different command with this name exists',
    });
    expect(classifyOwned('p', 'd', undefined, false, 'agent').reason).toBe('a different agent with this name exists');
  });

  it('conflicts on an owned item modified since install', () => {
    expect(classifyOwned('edited', 'd', 'p', false, 'command')).toEqual({
      action: 'conflict',
      reason: 'modified since shitaku installed it',
    });
  });
});
