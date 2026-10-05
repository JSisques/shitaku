import type { Profile } from './schema.js';

export interface ResolvedProfile {
  mcps: string[];
  skills: string[];
  scripts: string[];
}

/** Resolves a profile to its MCP, skill and script names: parents first, de-duplicated in first-seen order. */
export function resolveProfile(
  name: string,
  profiles: readonly Profile[],
  mcpNames: readonly string[],
  skillNames: readonly string[],
  scriptNames: readonly string[] = [],
): ResolvedProfile {
  const byName = new Map(profiles.map((p) => [p.name, p]));
  const knownMcps = new Set(mcpNames);
  const knownSkills = new Set(skillNames);
  const knownScripts = new Set(scriptNames);
  const mcps = new Set<string>();
  const skills = new Set<string>();
  const scripts = new Set<string>();

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
  };

  visit(name, []);
  return { mcps: [...mcps], skills: [...skills], scripts: [...scripts] };
}

/** Returns one error message per profile that fails to resolve. */
export function validateProfiles(
  profiles: readonly Profile[],
  mcpNames: readonly string[],
  skillNames: readonly string[],
  scriptNames: readonly string[] = [],
): string[] {
  return profiles.flatMap((p) => {
    try {
      resolveProfile(p.name, profiles, mcpNames, skillNames, scriptNames);
      return [];
    } catch (e) {
      return [e instanceof Error ? e.message : String(e)];
    }
  });
}
