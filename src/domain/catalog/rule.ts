import { z } from 'zod';
import { NAME_PATTERN } from '@/domain/catalog/command.js';
import { readFrontmatter } from '@/domain/catalog/frontmatter.js';

export const RuleNameSchema = z
  .string()
  .regex(NAME_PATTERN, { error: (iss) => `invalid rule name '${String(iss.input)}'` });

/**
 * A rule: one markdown file. `bytes` are the exact file bytes, so every frontmatter key reaches the target.
 * `recommended` is set by the catalog loader from `catalog.json`, never read from the rule file.
 */
export interface RuleItem {
  name: string;
  description: string;
  bytes: Uint8Array;
  recommended: boolean;
}

export type RuleIssue = { issue: string };
export type RuleParseResult = { rule: RuleItem } | RuleIssue;

/** Frontmatter keys held back for rule checks (#288); a rule using one is rejected until that feature defines them. */
export const RESERVED_RULE_KEYS = ['check', 'severity'] as const;

const REQUIRED = ['name', 'description'] as const;

/** Validates a rule file against its name (the file stem). Other frontmatter keys, nested or not, pass through. */
export function parseRule(stem: string, bytes: Uint8Array): RuleParseResult {
  if (!RuleNameSchema.safeParse(stem).success) return { issue: `invalid rule name '${stem}'` };
  const front = readFrontmatter(new TextDecoder().decode(bytes), `${stem}.md`, { allowNested: true });
  if ('issue' in front) return { issue: front.issue };
  for (const key of RESERVED_RULE_KEYS) {
    if (key in front.data || front.opaque.includes(key)) {
      return { issue: `key '${key}' is reserved for rule checks (see #288)` };
    }
  }
  for (const key of REQUIRED) {
    if (front.opaque.includes(key)) return { issue: `key '${key}' must be a single-line value` };
    if ((front.data[key] ?? '').trim() === '') return { issue: `${key}: frontmatter key is required` };
  }
  const name = (front.data['name'] ?? '').trim();
  if (name !== stem) return { issue: `frontmatter name '${name}' must equal the file name '${stem}'` };
  if (front.body.trim() === '') return { issue: 'rule body is empty' };
  return { rule: { name, description: (front.data['description'] ?? '').trim(), bytes, recommended: false } };
}
