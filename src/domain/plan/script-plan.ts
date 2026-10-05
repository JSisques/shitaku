import type { ScriptFile, ScriptItem } from '@/domain/catalog/script.js';
import { treeHash } from '@/domain/hash.js';
import type { Action } from '@/domain/plan/change-plan.js';
import type { Scope } from '@/ports/agent-target.js';

export interface ScriptChange {
  name: string;
  /** Absolute path of the script directory. */
  root: string;
  scope: Scope;
  action: Action;
  reason?: string;
  /** The files of the catalog version, the ones an install writes. */
  files: ScriptFile[];
  /** What the directory holds now; empty when it is absent. Kept so an apply can back the bytes up. */
  present: ScriptFile[];
  /** Present files the catalog version does not have. An update deletes them; other actions list none. */
  removed: string[];
  desiredHash: string;
  /** Tree hash of `present`; null when the directory is absent or empty. */
  presentHash: string | null;
}

export interface ScriptPlanEntry {
  script: ScriptItem;
  root: string;
  scope: Scope;
  /** Files found at `root`, null when it does not exist. */
  present: ScriptFile[] | null;
}

export interface BuildScriptPlanInput {
  scripts: ScriptPlanEntry[];
  /** script root -> tree hash of the version shitaku last installed there (derived from the manifest). */
  owned: Record<string, string>;
  /** Replace a differing tree even when shitaku does not own it. */
  force?: boolean;
}

export const writesScript = (change: ScriptChange): boolean => change.action === 'create' || change.action === 'update';

/** Decides what to do with one script directory given its present tree hash (null when absent). */
export function classifyScript(
  present: string | null,
  desired: string,
  owned: string | undefined,
  force: boolean,
): { action: Action; reason?: string } {
  if (present === null) return { action: 'create' };
  if (present === desired) return { action: 'skip', reason: 'already installed' };
  if (force) return { action: 'update', reason: 'replaced by --force' };
  if (owned === present) return { action: 'update', reason: 'installed by shitaku' };
  return {
    action: 'conflict',
    reason: owned === undefined ? 'a different script with this name exists' : 'modified since shitaku installed it',
  };
}

export function buildScriptPlan({ scripts, owned, force = false }: BuildScriptPlanInput): ScriptChange[] {
  return scripts.map(({ script, root, scope, present }): ScriptChange => {
    const presentFiles = present ?? [];
    const desiredHash = treeHash(script.files) ?? '';
    const presentHash = treeHash(presentFiles);
    const decision = classifyScript(presentHash, desiredHash, owned[root], force);
    const kept = new Set(script.files.map((f) => f.path));
    return {
      name: script.name,
      root,
      scope,
      ...decision,
      files: script.files,
      present: presentFiles,
      removed: decision.action === 'update' ? presentFiles.map((f) => f.path).filter((p) => !kept.has(p)) : [],
      desiredHash,
      presentHash,
    };
  });
}
