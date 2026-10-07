import type { Action } from '@/domain/plan/change-plan.js';

/** Decides what to do with one owned item given its present hash (null when absent); `noun` names the kind in the reason. */
export function classifyOwned(
  present: string | null,
  desired: string,
  owned: string | undefined,
  force: boolean,
  noun: string,
): { action: Action; reason?: string } {
  if (present === null) return { action: 'create' };
  if (present === desired) return { action: 'skip', reason: 'already installed' };
  if (force) return { action: 'update', reason: 'replaced by --force' };
  if (owned === present) return { action: 'update', reason: 'installed by shitaku' };
  return {
    action: 'conflict',
    reason: owned === undefined ? `a different ${noun} with this name exists` : 'modified since shitaku installed it',
  };
}
