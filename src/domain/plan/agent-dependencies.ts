import type { AgentItem } from '@/domain/catalog/agent.js';

/** A skill an agent declares that is not available in the catalog. */
export interface MissingDependency {
  agent: string;
  name: string;
}

export interface DependencyResolution {
  skills: {
    /** Catalog skill name -> agents requiring it, in selected-agent order. Keys follow first appearance. */
    required: Map<string, string[]>;
    /** Declared skills the catalog does not hold, once per declaring agent. */
    missing: MissingDependency[];
  };
}

const SAFE_SKILL_NAME = /^[a-z0-9][a-z0-9-]*$/;

/** Same pattern as the catalog skill name schema; guards names before they reach any filesystem probe. */
export const isSafeSkillName = (name: string): boolean => SAFE_SKILL_NAME.test(name);

/** Splits the skills the selected agents declare into catalog skills to install and ones that cannot be found. */
export function resolveAgentDependencies(
  agents: readonly Pick<AgentItem, 'name' | 'skills'>[],
  catalog: { skills: readonly string[] },
): DependencyResolution {
  const known = new Set(catalog.skills);
  const required = new Map<string, string[]>();
  const missing: MissingDependency[] = [];
  for (const agent of agents) {
    for (const name of agent.skills) {
      if (isSafeSkillName(name) && known.has(name)) {
        const by = required.get(name);
        if (by) by.push(agent.name);
        else required.set(name, [agent.name]);
      } else {
        missing.push({ agent: agent.name, name });
      }
    }
  }
  return { skills: { required, missing } };
}

export const requiredByReason = (agents: readonly string[]): string =>
  `required by ${agents.length === 1 ? 'agent' : 'agents'} ${agents.join(', ')}`;

export const missingSkillWarning = (agent: string, skill: string): string =>
  `agent ${agent} requires skill ${skill}, which is not in the catalog`;

export const unmanagedSkillNote = (agent: string, skill: string): string =>
  `agent ${agent} requires skill ${skill}, found on disk, not managed by shitaku`;
