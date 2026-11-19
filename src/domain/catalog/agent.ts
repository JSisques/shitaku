import { z } from 'zod';
import { NAME_PATTERN } from '@/domain/catalog/command.js';
import { readFrontmatter } from '@/domain/catalog/frontmatter.js';

export const AgentNameSchema = z
  .string()
  .regex(NAME_PATTERN, { error: (iss) => `invalid agent name '${String(iss.input)}'` });

/** A subagent: one markdown file. `bytes` are the exact file bytes, so every frontmatter key reaches the target. */
export interface AgentItem {
  name: string;
  description: string;
  /** Skill names declared in frontmatter, deduplicated, in declaration order; empty when absent. Not validated. */
  skills: string[];
  bytes: Uint8Array;
}

export type AgentIssue = { issue: string };
export type AgentParseResult = { agent: AgentItem } | AgentIssue;

const REQUIRED = ['name', 'description'] as const;

/**
 * Validates an agent file against its name (the file stem). `name` and `description` may be single-line or
 * literal/folded block scalars; the description is collapsed to one line. `skills` is read as a list of names (block
 * or inline flow form) and is not validated here. Other frontmatter keys, nested or not, pass through, and `bytes`
 * stay verbatim.
 */
export function parseAgent(stem: string, bytes: Uint8Array): AgentParseResult {
  if (!AgentNameSchema.safeParse(stem).success) return { issue: `invalid agent name '${stem}'` };
  const front = readFrontmatter(new TextDecoder().decode(bytes), `${stem}.md`, {
    allowNested: true,
    lists: ['skills'],
  });
  if ('issue' in front) return { issue: front.issue };
  for (const key of REQUIRED) {
    if (front.opaque.includes(key))
      return { issue: `key '${key}' must be a single-line or block scalar (| or >) value` };
    if ((front.data[key] ?? '').trim() === '') return { issue: `${key}: frontmatter key is required` };
  }
  const name = (front.data['name'] ?? '').trim();
  if (name !== stem) return { issue: `frontmatter name '${name}' must equal the file name '${stem}'` };
  if (front.body.trim() === '') return { issue: 'agent body is empty' };
  const description = (front.data['description'] ?? '').replace(/\s+/g, ' ').trim();
  return { agent: { name, description, skills: [...new Set(front.lists['skills'] ?? [])], bytes } };
}
