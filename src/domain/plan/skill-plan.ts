import type { SkillFile, SkillItem } from '@/domain/catalog/skill.js';
import { treeHash } from '@/domain/hash.js';
import type { Action } from '@/domain/plan/change-plan.js';
import { classifyOwned } from '@/domain/plan/classify.js';
import type { Scope } from '@/ports/agent-target.js';

export interface SkillChange {
  name: string;
  /** Absolute path of the skill directory. */
  root: string;
  scope: Scope;
  action: Action;
  reason?: string;
  /** The files of the catalog version, the ones an install writes. */
  files: SkillFile[];
  /** What the directory holds now; empty when it is absent. Kept so an apply can back the bytes up. */
  present: SkillFile[];
  /** Present files the catalog version does not have. An update deletes them; other actions list none. */
  removed: string[];
  desiredHash: string;
  /** Tree hash of `present`; null when the directory is absent or empty. */
  presentHash: string | null;
}

export interface SkillPlanEntry {
  skill: SkillItem;
  root: string;
  scope: Scope;
  /** Files found at `root`, null when it does not exist. */
  present: SkillFile[] | null;
}

export interface BuildSkillPlanInput {
  skills: SkillPlanEntry[];
  /** skill root -> tree hash of the version shitaku last installed there (derived from the manifest). */
  owned: Record<string, string>;
  /** Replace a differing tree even when shitaku does not own it. */
  force?: boolean;
}

export const writesSkill = (change: SkillChange): boolean => change.action === 'create' || change.action === 'update';

/** Decides what to do with one skill directory given its present tree hash (null when absent). */
export const classifySkill = (
  present: string | null,
  desired: string,
  owned: string | undefined,
  force: boolean,
): { action: Action; reason?: string } => classifyOwned(present, desired, owned, force, 'skill');

export function buildSkillPlan({ skills, owned, force = false }: BuildSkillPlanInput): SkillChange[] {
  return skills.map(({ skill, root, scope, present }): SkillChange => {
    const presentFiles = present ?? [];
    const desiredHash = treeHash(skill.files) ?? '';
    const presentHash = treeHash(presentFiles);
    const decision = classifySkill(presentHash, desiredHash, owned[root], force);
    const kept = new Set(skill.files.map((f) => f.path));
    return {
      name: skill.name,
      root,
      scope,
      ...decision,
      files: skill.files,
      present: presentFiles,
      removed: decision.action === 'update' ? presentFiles.map((f) => f.path).filter((p) => !kept.has(p)) : [],
      desiredHash,
      presentHash,
    };
  });
}
