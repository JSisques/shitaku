import {
  isSafeSkillName,
  missingSkillWarning,
  unmanagedSkillNote,
  type MissingDependency,
} from '@/domain/plan/agent-dependencies.js';
import type { AgentTarget, Scope } from '@/ports/agent-target.js';
import type { FileSystem } from '@/ports/file-system.js';
import type { Paths } from '@/ports/paths.js';

export interface AgentSkillsDeps {
  fs: FileSystem;
  target: AgentTarget;
  paths: Paths;
}

/**
 * Sorts the skills agents declare but the catalog lacks into warnings (found nowhere) and notes (a SKILL.md exists on
 * disk, in the run scope or, for a project run, in user scope). Unsafe names are never probed.
 */
export async function classifyMissingSkills(
  deps: AgentSkillsDeps,
  scope: Scope,
  missing: readonly MissingDependency[],
): Promise<{ warnings: string[]; notes: string[] }> {
  const scopes: Scope[] = scope === 'project' ? ['project', 'user'] : [scope];
  const warnings: string[] = [];
  const notes: string[] = [];
  for (const { agent, name } of missing) {
    let found = false;
    if (isSafeSkillName(name)) {
      for (const probe of scopes) {
        if (await deps.fs.exists(`${deps.target.skillsDir(probe, deps.paths)}/${name}/SKILL.md`)) {
          found = true;
          break;
        }
      }
    }
    if (found) notes.push(unmanagedSkillNote(agent, name));
    else warnings.push(missingSkillWarning(agent, name));
  }
  return { warnings, notes };
}
