import { z } from 'zod';
import { NAME_PATTERN } from '@/domain/catalog/command.js';
import { readFrontmatter } from '@/domain/catalog/frontmatter.js';
import {
  RuleCheckSchema,
  SeveritySchema,
  formatCheckIssue,
  type RuleCheck,
  type Severity,
} from '@/domain/catalog/rule-check.js';

export const RuleNameSchema = z
  .string()
  .regex(NAME_PATTERN, { error: (iss) => `invalid rule name '${String(iss.input)}'` });

/**
 * A rule: one markdown file. `bytes` are the exact file bytes, so every frontmatter key reaches the target.
 * `recommended` is set by the catalog loader from `catalog.json`, never read from the rule file.
 * `check` and `severity` are present only when the rule declares a check; `severity` defaults to `error`.
 */
export interface RuleItem {
  name: string;
  description: string;
  bytes: Uint8Array;
  recommended: boolean;
  check?: RuleCheck;
  severity?: Severity;
}

export type RuleIssue = { issue: string };
export type RuleParseResult = { rule: RuleItem } | RuleIssue;

const REQUIRED = ['name', 'description'] as const;

/** Reads the optional `check` mapping and `severity`; yields the pair to expose, or the rule issue. */
function readCheck(
  data: Record<string, string>,
  opaque: readonly string[],
  maps: Record<string, unknown>,
): { check: RuleCheck; severity: Severity } | { issue: string } | undefined {
  if (opaque.includes('severity')) return { issue: "key 'severity' must be a single-line value" };
  const mapping = maps['check'];
  if ('check' in data) return { issue: 'check must be a nested mapping' };
  if (mapping === undefined) return 'severity' in data ? { issue: 'severity requires a check' } : undefined;
  const check = RuleCheckSchema.safeParse(mapping);
  if (!check.success) return { issue: formatCheckIssue(check.error) };
  const severity = SeveritySchema.safeParse(data['severity'] === undefined ? 'error' : data['severity'].trim());
  if (!severity.success) return { issue: "severity must be 'error' or 'warn'" };
  return { check: check.data, severity: severity.data };
}

/**
 * Validates a rule file against its name (the file stem). `check` is read as a nested mapping; other frontmatter
 * keys, nested or not, pass through.
 */
export function parseRule(stem: string, bytes: Uint8Array): RuleParseResult {
  if (!RuleNameSchema.safeParse(stem).success) return { issue: `invalid rule name '${stem}'` };
  const front = readFrontmatter(new TextDecoder().decode(bytes), `${stem}.md`, {
    allowNested: true,
    mappings: ['check'],
  });
  if ('issue' in front) return { issue: front.issue };
  for (const key of REQUIRED) {
    if (front.opaque.includes(key)) return { issue: `key '${key}' must be a single-line value` };
    if ((front.data[key] ?? '').trim() === '') return { issue: `${key}: frontmatter key is required` };
  }
  const name = (front.data['name'] ?? '').trim();
  if (name !== stem) return { issue: `frontmatter name '${name}' must equal the file name '${stem}'` };
  if (front.body.trim() === '') return { issue: 'rule body is empty' };
  const declared = readCheck(front.data, front.opaque, front.maps);
  if (declared !== undefined && 'issue' in declared) return declared;
  return {
    rule: { name, description: (front.data['description'] ?? '').trim(), bytes, recommended: false, ...declared },
  };
}
