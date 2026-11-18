import type { AgentItem } from '@/domain/catalog/agent.js';
import type { CatalogSource } from '@/ports/catalog-source.js';
import { enc } from '@test/helpers/skills.js';

/** The bytes of a minimal valid agent file; `extra` lines are added to the frontmatter. */
export const agentBytes = (name: string, extra: string[] = [], body = 'You are an agent.\n'): Uint8Array =>
  enc(['---', `name: ${name}`, `description: ${name} agent`, ...extra, '---', body].join('\n'));

/** An agent item whose bytes match its name. */
export const makeAgent = (name: string, extra: string[] = []): AgentItem => ({
  name,
  description: `${name} agent`,
  bytes: agentBytes(name, extra),
});

/** An agent with nested frontmatter (a tools list). */
export const REVIEWER: AgentItem = makeAgent('reviewer', ['tools:', '  - Read', '  - Grep']);

/** A catalog source that serves the given agents and no other kind. */
export const agentSource = (agents: AgentItem[]): CatalogSource => ({
  ref: () => ({ kind: 'bundled', location: '/catalog' }),
  load: () =>
    Promise.resolve({
      mcps: [],
      skills: [],
      scripts: [],
      commands: [],
      hooks: [],
      agents,
      rules: [],
      profiles: [],
      issues: [],
    }),
});

/** A newer catalog version of `REVIEWER`. */
export const REVIEWER_V2: AgentItem = makeAgent('reviewer', ['model: opus']);
