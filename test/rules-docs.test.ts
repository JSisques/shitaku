import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');
const read = (file: string): string => readFileSync(join(ROOT, file), 'utf8');

/** Stable tokens of the rules docs; a minor rewording keeps them, deleting the note does not. */
const NOTE: Record<string, Record<string, RegExp>> = {
  'README.md': {
    'init flag': /--rules/,
    'uninstall kind': /--kind[^\n]*\brule\b/,
    downgrade: /before downgrading[^\n]*rules/i,
    'rule-missing code': /`rule-missing`/,
    '--source trust': /Rules from a `--source` folder/,
    'nested yaml limit': /not validated/i,
    'recommended preselected': /recommended[^\n]*preselected/i,
    'quote paths': /quote[^\n]*`paths`/i,
  },
  'CONTRIBUTING.md': {
    section: /^### Adding to the catalog: rules$/m,
    'reserved keys': /`check`[^\n]*`severity`[^\n]*reserved/i,
    'quote paths': /quote[^\n]*`paths`/i,
    'size cap': /1,500 bytes/,
    'recommended set': /`recommended\.rules`/,
    'nested yaml limit': /not validated/i,
  },
  'website/src/content/docs/en/security.md': {
    section: /^## Rules safety$/m,
    '--source trust': /Rules from a `--source` folder/,
    downgrade: /before downgrading/i,
  },
  'website/src/content/docs/es/security.md': {
    section: /^## Seguridad de las reglas$/m,
    '--source trust': /reglas de una carpeta `--source`/i,
    downgrade: /bajar de versión/i,
  },
  'website/src/content/docs/en/catalog/overview.md': { rules: /catalog\/rules\/<name>\.md/ },
  'website/src/content/docs/es/catalog/overview.md': { rules: /catalog\/rules\/<name>\.md/ },
};

describe('rules docs', () => {
  describe.each(Object.entries(NOTE))('%s', (file, tokens) => {
    const text = read(file);
    it.each(Object.entries(tokens))('states: %s', (_label, token) => {
      expect(text).toMatch(token);
    });
  });

  it.each([
    'README.md',
    'website/src/content/docs/en/cli/commands.md',
    'website/src/content/docs/en/cli/flags.md',
    'website/src/content/docs/es/cli/commands.md',
    'website/src/content/docs/es/cli/flags.md',
  ])('documents the init flag and the uninstall kind in %s', (file) => {
    const text = read(file);
    expect(text).toMatch(/--rules/);
    expect(text).toMatch(/--kind[^\n]*\brule\b/);
  });

  it.each([
    ['README.md', /installs MCP servers, skills, scripts, slash commands, agents, rules and hooks/],
    ['README.md', /removes one MCP server, skill, script, slash command, agent, rule or hook/],
    ['README.md', /`commands`, `agents`, `rules`, `hooks`\), and each/],
    ['README.md', /`hooks`, `agents` or `rules`, plural only\)/],
    ['README.md', /`command`, `hook`, `agent` or `rule` \(singular/],
    ['website/src/content/docs/en/cli/commands.md', /slash commands, agents, rules and hooks/],
    ['website/src/content/docs/en/cli/commands.md', /agent, rule or hook that shitaku owns/],
    ['website/src/content/docs/en/cli/commands.md', /`hooks`, `agents` or `rules`, plural only\)/],
    ['website/src/content/docs/es/cli/commands.md', /agentes, reglas y hooks/],
    ['website/src/content/docs/es/cli/commands.md', /agente, regla o hook instalado/],
  ])('lists rules among the kinds in %s (%s)', (file, pattern) => {
    expect(read(file)).toMatch(pattern);
  });

  it('no longer claims the CLI cannot install rules', () => {
    expect(read('README.md')).not.toMatch(/Installing rules from the CLI is not available yet/);
  });

  it('keeps the flag out of CONTRIBUTING.md, which links to the README for usage', () => {
    expect(read('CONTRIBUTING.md')).not.toMatch(/--kind rule/);
  });
});
