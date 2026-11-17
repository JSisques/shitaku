import type { AgentItem } from '@/domain/catalog/agent.js';
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
