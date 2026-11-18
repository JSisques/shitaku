import type { RuleItem } from '@/domain/catalog/rule.js';
import type { CatalogSource } from '@/ports/catalog-source.js';
import { enc } from '@test/helpers/skills.js';

/** The bytes of a minimal valid rule file; `extra` lines are added to the frontmatter. */
export const ruleBytes = (name: string, extra: string[] = [], body = 'Follow this rule.\n'): Uint8Array =>
  enc(['---', `name: ${name}`, `description: ${name} rule`, ...extra, '---', body].join('\n'));

/** A rule item whose bytes match its name. Not recommended unless asked. */
export const ruleItem = (name: string, extra: string[] = [], recommended = false): RuleItem => ({
  name,
  description: `${name} rule`,
  bytes: ruleBytes(name, extra),
  recommended,
});

/** A catalog source that serves the given rules and no other kind. */
export const ruleSource = (rules: RuleItem[]): CatalogSource => ({
  ref: () => ({ kind: 'bundled', location: '/catalog' }),
  load: () =>
    Promise.resolve({
      mcps: [],
      skills: [],
      scripts: [],
      commands: [],
      hooks: [],
      agents: [],
      rules,
      profiles: [],
      issues: [],
    }),
});
