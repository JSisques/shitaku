import type { Profile } from './schema.js';

export interface ResolvedProfile {
  mcps: string[];
  skills: string[];
  scripts: string[];
  commands: string[];
  hooks: string[];
  agents: string[];
}

/** The names that exist in the catalog, per kind; an omitted list means none exist. */
export interface KnownNames {
  mcps: readonly string[];
  skills: readonly string[];
  scripts?: readonly string[];
  commands?: readonly string[];
  hooks?: readonly string[];
  agents?: readonly string[];
}

/** Resolves a profile to its MCP, skill, script, command, hook and agent names: parents first, de-duplicated in first-seen order. */
export function resolveProfile(name: string, profiles: readonly Profile[], known: KnownNames): ResolvedProfile {
  const byName = new Map(profiles.map((p) => [p.name, p]));
  const knownMcps = new Set(known.mcps);
  const knownSkills = new Set(known.skills);
  const knownScripts = new Set(known.scripts);
  const knownCommands = new Set(known.commands);
  const knownHooks = new Set(known.hooks);
  const knownAgents = new Set(known.agents);
  const mcps = new Set<string>();
  const skills = new Set<string>();
  const scripts = new Set<string>();
  const commands = new Set<string>();
  const hooks = new Set<string>();
  const agents = new Set<string>();

  const visit = (current: string, trail: string[]): void => {
    if (trail.includes(current)) throw new Error(`profile cycle: ${[...trail, current].join(' -> ')}`);
    const profile = byName.get(current);
    if (!profile)
      throw new Error(`unknown profile '${current}'${trail.length ? ` (extended by '${trail.at(-1)}')` : ''}`);
    for (const parent of profile.extends) visit(parent, [...trail, current]);
    for (const mcp of profile.mcps) {
      if (!knownMcps.has(mcp)) throw new Error(`profile '${current}' references unknown mcp '${mcp}'`);
      mcps.add(mcp);
    }
    for (const skill of profile.skills) {
      if (!knownSkills.has(skill)) throw new Error(`profile '${current}' references unknown skill '${skill}'`);
      skills.add(skill);
    }
    for (const script of profile.scripts) {
      if (!knownScripts.has(script)) throw new Error(`profile '${current}' references unknown script '${script}'`);
      scripts.add(script);
    }
    for (const command of profile.commands) {
      if (!knownCommands.has(command)) throw new Error(`profile '${current}' references unknown command '${command}'`);
      commands.add(command);
    }
    for (const hook of profile.hooks) {
      if (!knownHooks.has(hook)) throw new Error(`profile '${current}' references unknown hook '${hook}'`);
      hooks.add(hook);
    }
    for (const agent of profile.agents) {
      if (!knownAgents.has(agent)) throw new Error(`profile '${current}' references unknown agent '${agent}'`);
      agents.add(agent);
    }
  };

  visit(name, []);
  return {
    mcps: [...mcps],
    skills: [...skills],
    scripts: [...scripts],
    commands: [...commands],
    hooks: [...hooks],
    agents: [...agents],
  };
}

/** Returns one error message per profile that fails to resolve. */
export function validateProfiles(profiles: readonly Profile[], known: KnownNames): string[] {
  return profiles.flatMap((p) => {
    try {
      resolveProfile(p.name, profiles, known);
      return [];
    } catch (e) {
      return [e instanceof Error ? e.message : String(e)];
    }
  });
}
