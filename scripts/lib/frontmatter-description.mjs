// Reads a catalog item description through the domain frontmatter reader, so docs and the CLI agree on parsing.
// The `.ts` import relies on Node type stripping (see test/domain/catalog/frontmatter-portability.test.ts).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readFrontmatter } from '../../src/domain/catalog/frontmatter.ts';

const KINDS = {
  skills: { rel: (n) => `skills/${n}/SKILL.md`, nested: false },
  commands: { rel: (n) => `commands/${n}.md`, nested: false },
  agents: { rel: (n) => `agents/${n}.md`, nested: true },
  rules: { rel: (n) => `rules/${n}.md`, nested: true },
};

/**
 * Description of a catalog item read through the domain frontmatter reader.
 * Agents and rules: nested mode, whitespace collapsed to one line. Skills and commands: strict mode, as the CLI.
 * @param {string} catalogDir
 * @param {'skills'|'commands'|'agents'|'rules'} kind
 * @param {string} name
 * @returns {string}
 */
export function itemDescription(catalogDir, kind, name) {
  const spec = KINDS[kind];
  if (!spec) throw new Error(`frontmatter-description: unknown kind '${kind}'`);
  const label = spec.rel(name);
  let text;
  try {
    text = readFileSync(join(catalogDir, label), 'utf8');
  } catch (err) {
    throw new Error(`${label}: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }
  const front = spec.nested ? readFrontmatter(text, label, { allowNested: true }) : readFrontmatter(text, label);
  if ('issue' in front) throw new Error(front.issue.startsWith(label) ? front.issue : `${label}: ${front.issue}`);
  const raw = front.data.description ?? '';
  const description = spec.nested ? raw.replace(/\s+/g, ' ').trim() : raw;
  if (description.trim() === '') throw new Error(`${label} has no description`);
  return description;
}
