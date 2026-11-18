import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');
const read = (file: string): string => readFileSync(join(ROOT, file), 'utf8');

/** Checks are declared but no command evaluates them until the runner of #226 exists. */
const NOT_ENFORCED = /declared but not enforced until #226/i;
const NOT_ENFORCED_ES = /declaradas pero no se aplican hasta #226/i;

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
    'checks not enforced': NOT_ENFORCED,
  },
  'CONTRIBUTING.md': {
    section: /^### Adding catalog items: rules$/m,
    'checks not enforced': NOT_ENFORCED,
    'quote paths': /quote[^\n]*`paths`/i,
    'size cap': /1,500 bytes/,
    'recommended set': /`recommended\.rules`/,
    'nested yaml limit': /not validated/i,
  },
  'website/src/content/docs/en/security.md': {
    section: /^## Rules safety$/m,
    '--source trust': /Rules from a `--source` folder/,
    downgrade: /before downgrading/i,
    'checks not enforced': NOT_ENFORCED,
  },
  'website/src/content/docs/es/security.md': {
    section: /^## Seguridad de las reglas$/m,
    '--source trust': /reglas de una carpeta `--source`/i,
    downgrade: /bajar de versión/i,
    'checks not enforced': NOT_ENFORCED_ES,
  },
  'website/src/content/docs/en/catalog/overview.md': { rules: /catalog\/rules\/<name>\.md/ },
  'website/src/content/docs/es/catalog/overview.md': { rules: /catalog\/rules\/<name>\.md/ },
};

const CHECK_TYPES = ['file-exists', 'contains-sections', 'pattern-absent', 'max-lines', 'tool'];
const SEVERITY_EN = /default `error`/;
const SEVERITY_ES = /por defecto `error`/;
const GLOB_LIMIT = /at most 256 characters/;
const GLOB_LIMIT_ES = /máximo 256 caracteres/;
const REGEX_LIMIT = /regular expression of 1 to 200 characters/;
const REGEX_LIMIT_ES = /expresión regular de JavaScript de 1 a 200 caracteres/;

describe('rules docs check contract', () => {
  describe.each([
    ['README.md', SEVERITY_EN, GLOB_LIMIT, REGEX_LIMIT],
    ['CONTRIBUTING.md', SEVERITY_EN, GLOB_LIMIT, REGEX_LIMIT],
    ['website/src/content/docs/en/security.md', SEVERITY_EN, GLOB_LIMIT, REGEX_LIMIT],
    ['website/src/content/docs/es/security.md', SEVERITY_ES, GLOB_LIMIT_ES, REGEX_LIMIT_ES],
  ])('%s', (file, severity, glob, regex) => {
    const text = read(file);
    it.each(CHECK_TYPES)('describes the check type `%s`', (type) => {
      expect(text).toContain(`\`${type}\``);
    });
    it('states the default severity', () => {
      expect(text).toMatch(severity);
    });
    it('states the glob and regex limits', () => {
      expect(text).toMatch(glob);
      expect(text).toMatch(regex);
    });
  });
});

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

  it.each([
    'README.md',
    'CONTRIBUTING.md',
    'website/src/content/docs/en/security.md',
    'website/src/content/docs/es/security.md',
  ])('does not call check or severity reserved in %s', (file) => {
    expect(read(file)).not.toMatch(/reserved|reservad/i);
  });

  it('no longer claims the CLI cannot install rules', () => {
    expect(read('README.md')).not.toMatch(/Installing rules from the CLI is not available yet/);
  });

  it('keeps the flag out of CONTRIBUTING.md, which links to the README for usage', () => {
    expect(read('CONTRIBUTING.md')).not.toMatch(/--kind rule/);
  });
});
