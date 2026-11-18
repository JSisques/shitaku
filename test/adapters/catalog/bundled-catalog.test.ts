import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FolderCatalogSource } from '@/adapters/catalog/folder-source.js';
import { resolveProfile } from '@/domain/catalog/profile.js';

const catalogRoot = join(import.meta.dirname, '..', '..', '..', 'catalog');

/** Skill names from a top-level `skills:` block sequence; [] when absent; throws on any other form. */
function agentSkills(text: string): string[] {
  const [, frontmatter = ''] = text.split(/^---\r?\n|\r?\n---\r?\n/);
  const lines = frontmatter.split(/\r?\n/);
  const start = lines.findIndex((line) => /^skills:/.test(line));
  if (start === -1) return [];
  if (lines[start]?.trim() !== 'skills:') throw new Error('unsupported skills form in frontmatter');
  const skills: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!/^\s/.test(line)) break;
    const match = /^\s+- ([a-z0-9-]+)\s*$/.exec(line);
    if (!match?.[1]) throw new Error(`unsupported skills entry in frontmatter: ${line}`);
    skills.push(match[1]);
  }
  return skills;
}

/** "<agent>: <skill>" for every agent skill missing from `registered`. */
function danglingSkills(agents: readonly { name: string; text: string }[], registered: readonly string[]): string[] {
  return agents.flatMap((agent) =>
    agentSkills(agent.text)
      .filter((skill) => !registered.includes(skill))
      .map((skill) => `${agent.name}: ${skill}`),
  );
}

/** Exact flat file list of catalog/scripts/repo-map/. Update it in the same commit that adds a module. */
const REPO_MAP_FILES = [
  'args.mjs',
  'build-map.mjs',
  'extractors.mjs',
  'glob.mjs',
  'index.mjs',
  'jsonc.mjs',
  'project.mjs',
  'render-json.mjs',
  'scan.mjs',
  'script.json',
];

function expectSkillContract(
  name: string,
  { required, forbidden }: { required: readonly string[]; forbidden: readonly (string | RegExp)[] },
): void {
  const raw = readFileSync(join(catalogRoot, 'skills', name, 'SKILL.md'), 'utf8');
  const [, frontmatter = '', body = ''] = raw.split(/^---\r?\n|\r?\n---\r?\n/);
  const lines = frontmatter.split(/\r?\n/).filter((line) => line.length > 0);
  expect(lines).toHaveLength(2);
  expect(lines[0]).toBe(`name: ${name}`);
  const descriptionLine = lines[1] ?? '';
  expect(descriptionLine).toMatch(/^description: 'Trigger:.*'$/);
  const description = descriptionLine.slice("description: '".length, -1);
  expect(description.length).toBeLessThanOrEqual(250);
  expect(description).not.toMatch(/['"|]/);
  expect(raw).not.toContain('disable-model-invocation');

  for (const heading of ['Activation Contract', 'Hard Rules', 'Decision Gates', 'Execution Steps', 'Output Contract']) {
    expect(body).toContain(`## ${heading}`);
  }
  for (const token of required) {
    expect(raw).toContain(token);
  }
  for (const pattern of forbidden) {
    if (typeof pattern === 'string') expect(raw).not.toContain(pattern);
    else expect(raw).not.toMatch(pattern);
  }
}

describe('bundled catalog', () => {
  it('loads without issues and resolves profiles', async () => {
    const catalog = await new FolderCatalogSource(catalogRoot, 'bundled').load();
    expect(catalog.issues).toEqual([]);
    expect(catalog.mcps.map((m) => m.name)).toEqual([
      'github',
      'context7',
      'playwright',
      'figma',
      'vercel',
      'docker',
      'sqlite',
      'supabase',
      'notion',
      'atlassian',
      'brave-search',
      'cloudflare-docs',
      'cloudflare-bindings',
      'cloudflare-observability',
      'rea',
    ]);
    const mcpNames = catalog.mcps.map((m) => m.name);
    const skillNames = catalog.skills.map((sk) => sk.name);
    const scriptNames = catalog.scripts.map((s) => s.name);
    expect(
      resolveProfile('web', catalog.profiles, { mcps: mcpNames, skills: skillNames, scripts: scriptNames }),
    ).toEqual({
      mcps: [
        'context7',
        'github',
        'playwright',
        'figma',
        'vercel',
        'brave-search',
        'cloudflare-docs',
        'cloudflare-bindings',
        'cloudflare-observability',
      ],
      skills: [],
      scripts: [],
      commands: [],
      hooks: [],
      agents: [],
    });
    expect(
      resolveProfile('backend', catalog.profiles, { mcps: mcpNames, skills: skillNames, scripts: scriptNames }),
    ).toEqual({
      mcps: ['context7', 'github', 'docker', 'sqlite', 'supabase'],
      skills: [],
      scripts: [],
      commands: [],
      hooks: [],
      agents: [],
    });
  });

  it('ships the ten seed rules with the recommended set flagged', async () => {
    const catalog = await new FolderCatalogSource(catalogRoot, 'bundled').load();
    expect(catalog.issues).toEqual([]);
    expect(catalog.rules.map((r) => r.name).sort()).toEqual(
      [
        'ask-when-unsure',
        'conventional-commits',
        'error-handling',
        'explain-why',
        'module-readme',
        'naming',
        'no-new-deps',
        'no-secrets',
        'small-changes',
        'tests-for-changes',
      ].sort(),
    );
    expect(
      catalog.rules
        .filter((r) => r.recommended)
        .map((r) => r.name)
        .sort(),
    ).toEqual(['ask-when-unsure', 'conventional-commits', 'module-readme', 'no-secrets', 'tests-for-changes']);
    expect(catalog.rules.filter((r) => 'check' in r || 'severity' in r)).toEqual([]);
  });

  it('keeps every seed rule small, global and instruction-only', () => {
    const names = readdirSync(join(catalogRoot, 'rules'));
    expect(names).toHaveLength(10);
    for (const file of names) {
      const bytes = readFileSync(join(catalogRoot, 'rules', file));
      expect(bytes.length, file).toBeLessThanOrEqual(1500);
      const [, frontmatter = '', body = ''] = bytes.toString('utf8').split(/^---\r?\n|\r?\n---\r?\n/);
      const keys = frontmatter
        .split(/\r?\n/)
        .filter((line) => line.length > 0)
        .map((line) => line.slice(0, line.indexOf(':')));
      expect(keys, file).toEqual(['name', 'description']);
      expect(body.trim().length, file).toBeGreaterThan(0);
    }
  });

  it('ships rea as a pinned stdio MCP without env, outside every profile', async () => {
    const catalog = await new FolderCatalogSource(catalogRoot, 'bundled').load();
    const rea = catalog.mcps.find((m) => m.name === 'rea');
    expect(rea).toBeDefined();
    expect(rea?.server).toEqual({ type: 'stdio', command: 'npx', args: ['-y', 'rea-agents@6.9.0', 'mcp'] });
    expect(rea?.env).toEqual([]);
    const raw = readFileSync(join(catalogRoot, 'mcps', 'rea.json'), 'utf8');
    expect(raw).not.toContain('${');
    const args = rea?.server.type === 'stdio' ? rea.server.args : [];
    expect(args.some((arg) => arg.includes('@latest'))).toBe(false);
    const description = rea?.description ?? '';
    expect(description).not.toMatch(/\n/);
    expect(description).toMatch(/reverse/i);
    expect(description).toMatch(/Hopper|Ghidra|IDA/);
    expect(description).toContain('Node 22.23.4+, 24.22.1+ or 26.12.1+');

    const available = {
      mcps: catalog.mcps.map((m) => m.name),
      skills: catalog.skills.map((sk) => sk.name),
      scripts: catalog.scripts.map((s) => s.name),
    };
    for (const profile of ['base', 'web', 'backend']) {
      expect(resolveProfile(profile, catalog.profiles, available).mcps).not.toContain('rea');
    }
  });

  it('loads with an explicitly empty commands list', async () => {
    const catalog = await new FolderCatalogSource(catalogRoot, 'bundled').load();
    expect(catalog.issues).toEqual([]);
    expect(catalog.commands).toEqual([]);
    const index = JSON.parse(readFileSync(join(catalogRoot, 'catalog.json'), 'utf8')) as {
      items: { commands?: unknown };
    };
    expect(index.items.commands).toEqual([]);
  });

  it('ships complexity, dead-code, duplication, and repo-map as registered and loadable bundled scripts', async () => {
    const index = JSON.parse(readFileSync(join(catalogRoot, 'catalog.json'), 'utf8')) as {
      items: { scripts?: unknown };
    };
    expect(index.items.scripts).toEqual(['complexity', 'dead-code', 'duplication', 'repo-map']);

    const scriptsDir = join(catalogRoot, 'scripts');
    expect(statSync(scriptsDir).isDirectory()).toBe(true);
    const entries = readdirSync(scriptsDir)
      .filter((name) => !name.startsWith('.'))
      .sort();
    expect(entries).toEqual(['complexity', 'dead-code', 'duplication', 'repo-map']);

    const catalog = await new FolderCatalogSource(catalogRoot, 'bundled').load();
    expect(catalog.issues).toEqual([]);
    expect(catalog.scripts).toHaveLength(4);

    const byName = Object.fromEntries(catalog.scripts.map((s) => [s.name, s]));
    expect(byName['complexity']).toMatchObject({
      name: 'complexity',
      tools: ['eslint', 'eslint-plugin-sonarjs', 'typescript-eslint', 'typescript', '@eslint/js'],
    });
    expect(byName['complexity']?.files.map((f) => f.path).sort()).toEqual([
      'complexity.eslint.config.mjs',
      'eslint.rules.mjs',
      'index.mjs',
      'package-lock.json',
      'package.json',
      'script.json',
    ]);

    expect(byName['dead-code']).toMatchObject({
      name: 'dead-code',
      tools: ['knip'],
    });
    expect(byName['dead-code']?.files.map((f) => f.path).sort()).toEqual(['index.mjs', 'script.json']);

    expect(byName['duplication']).toMatchObject({
      name: 'duplication',
      tools: ['jscpd'],
    });
    expect(byName['duplication']?.files.map((f) => f.path).sort()).toEqual(['index.mjs', 'script.json']);

    expect(byName['repo-map']).toMatchObject({
      name: 'repo-map',
      tools: [],
    });
    expect(byName['repo-map']?.files.map((f) => f.path).sort()).toEqual(REPO_MAP_FILES);
  });

  it('ships dead-code and duplication without script-root npm bootstrap artifacts', () => {
    for (const scriptName of ['dead-code', 'duplication'] as const) {
      const scriptDir = join(catalogRoot, 'scripts', scriptName);
      expect(statSync(scriptDir).isDirectory()).toBe(true);

      const entries = readdirSync(scriptDir)
        .filter((name) => !name.startsWith('.'))
        .sort();
      expect(entries).toEqual(['index.mjs', 'script.json']);
      expect(entries).not.toContain('package.json');
      expect(entries).not.toContain('package-lock.json');
      expect(entries).not.toContain('node_modules');
    }
  });

  it('ships repo-map as a flat set of modules without script-root npm bootstrap artifacts', () => {
    const scriptDir = join(catalogRoot, 'scripts', 'repo-map');
    expect(statSync(scriptDir).isDirectory()).toBe(true);

    const entries = readdirSync(scriptDir)
      .filter((name) => !name.startsWith('.'))
      .sort();
    expect(entries).toEqual(REPO_MAP_FILES);
    expect(entries).not.toContain('package.json');
    expect(entries).not.toContain('package-lock.json');
    expect(entries).not.toContain('node_modules');
    expect(entries).not.toContain('lib');
  });

  it('ships docs-writing, example-skill, pr-writing, product-owner and socratic-method as registered loadable bundled skills', async () => {
    const index = JSON.parse(readFileSync(join(catalogRoot, 'catalog.json'), 'utf8')) as {
      items: { skills?: unknown };
    };
    expect(index.items.skills).toEqual([
      'docs-writing',
      'example-skill',
      'pr-writing',
      'product-owner',
      'socratic-method',
    ]);

    const skillsDir = join(catalogRoot, 'skills');
    expect(statSync(skillsDir).isDirectory()).toBe(true);
    const entries = readdirSync(skillsDir)
      .filter((name) => !name.startsWith('.'))
      .sort();
    expect(entries).toEqual(['docs-writing', 'example-skill', 'pr-writing', 'product-owner', 'socratic-method']);

    const catalog = await new FolderCatalogSource(catalogRoot, 'bundled').load();
    expect(catalog.issues).toEqual([]);
    expect(catalog.skills).toHaveLength(5);

    const byName = Object.fromEntries(catalog.skills.map((sk) => [sk.name, sk]));
    expect(byName['docs-writing']).toMatchObject({ name: 'docs-writing' });
    expect(byName['docs-writing']?.description.length).toBeGreaterThan(0);
    expect(byName['docs-writing']?.files.map((f) => f.path)).toEqual(['SKILL.md']);

    expect(byName['example-skill']).toMatchObject({ name: 'example-skill' });
    expect(byName['example-skill']?.description).toContain('example skill');
    expect(byName['example-skill']?.files.map((f) => f.path)).toEqual(['SKILL.md']);

    expect(byName['pr-writing']).toMatchObject({ name: 'pr-writing' });
    expect(byName['pr-writing']?.description.length).toBeGreaterThan(0);
    expect(byName['pr-writing']?.files.map((f) => f.path)).toEqual(['SKILL.md']);

    expect(byName['product-owner']).toMatchObject({ name: 'product-owner' });
    expect(byName['product-owner']?.description.length).toBeGreaterThan(0);
    expect(byName['product-owner']?.files.map((f) => f.path)).toEqual(['SKILL.md']);

    expect(byName['socratic-method']).toMatchObject({ name: 'socratic-method' });
    expect(byName['socratic-method']?.description.length).toBeGreaterThan(0);
    expect(byName['socratic-method']?.files.map((f) => f.path)).toEqual(['SKILL.md']);
  });

  it('keeps the pr-writing skill content contract', () => {
    expectSkillContract('pr-writing', {
      required: ['BREAKING CHANGE:', 'Closes #', 'CODEOWNERS', 'gh label list'],
      forbidden: [/topic/i, 'Co-Authored-By'],
    });
  });

  it('keeps the docs-writing skill content contract', () => {
    expectSkillContract('docs-writing', {
      required: ['Keep a Changelog', 'JSDoc', 'not what', 'Not for pull request'],
      forbidden: [/shitaku/i, 'Co-Authored-By'],
    });
  });

  it('keeps the product-owner skill content contract', () => {
    expectSkillContract('product-owner', {
      required: [
        'Given',
        'When',
        'Then',
        'acceptance criteria',
        'user stor',
        'MoSCoW',
        'MVP',
        'success metric',
        'roadmap',
        'tech lead',
        'Not for technical design',
      ],
      forbidden: [/shitaku/i, 'Co-Authored-By'],
    });
  });

  it('ships the bundled agents as registered loadable agents', async () => {
    const index = JSON.parse(readFileSync(join(catalogRoot, 'catalog.json'), 'utf8')) as {
      items: { agents?: unknown };
    };
    expect(index.items.agents).toEqual(['pr-creator', 'qa', 'socratic-challenger', 'docs-writer']);

    const entries = readdirSync(join(catalogRoot, 'agents'))
      .filter((name) => !name.startsWith('.'))
      .sort();
    expect(entries).toEqual(['docs-writer.md', 'pr-creator.md', 'qa.md', 'socratic-challenger.md']);

    const catalog = await new FolderCatalogSource(catalogRoot, 'bundled').load();
    expect(catalog.issues).toEqual([]);
    expect(catalog.agents.map((a) => a.name)).toEqual(['pr-creator', 'qa', 'socratic-challenger', 'docs-writer']);
    for (const agent of catalog.agents) {
      expect(agent.description.length).toBeGreaterThan(0);
    }
  });

  it('keeps the pr-creator agent content contract', () => {
    const raw = readFileSync(join(catalogRoot, 'agents', 'pr-creator.md'), 'utf8');
    const [, frontmatter = '', body = ''] = raw.split(/^---\r?\n|\r?\n---\r?\n/);
    const lines = frontmatter.split(/\r?\n/).filter((line) => line.length > 0);
    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe('name: pr-creator');
    const descriptionLine = lines.find((line) => line.startsWith('description:')) ?? '';
    const description = descriptionLine.slice('description:'.length).trim();
    expect(description.length).toBeGreaterThan(0);
    expect(description).not.toMatch(/: |['"|]/);
    expect(lines.filter((line) => line.startsWith('skills:'))).toEqual(['skills:']);
    expect(lines.filter((line) => /^\s+- /.test(line))).toEqual(['  - pr-writing']);
    expect(lines.filter((line) => line.startsWith('tools:'))).toHaveLength(1);
    expect(frontmatter).not.toMatch(/[>|]\s*$/m);

    const toolsLine = lines.find((line) => line.startsWith('tools:')) ?? '';
    const tools = toolsLine
      .slice('tools:'.length)
      .split(',')
      .map((tool) => tool.trim());
    const mcpTools = [
      'list_branches',
      'list_commits',
      'get_commit',
      'get_file_contents',
      'list_pull_requests',
      'issue_read',
      'list_label',
      'pull_request_read',
      'create_pull_request',
      'update_pull_request',
    ].map((tool) => `mcp__github__${tool}`);
    expect([...tools].sort()).toEqual(['Glob', 'Grep', 'Read', ...mcpTools].sort());
    for (const tool of tools.filter((t) => t.startsWith('mcp__'))) {
      expect(tool).toMatch(/^mcp__github__[a-z_]+$/);
    }
    for (const forbidden of [
      'Bash',
      'Write',
      'Edit',
      '*',
      'merge',
      'create_branch',
      'push_files',
      'create_or_update_file',
    ]) {
      expect(toolsLine).not.toContain(forbidden);
    }

    for (const required of [
      'pr-writing',
      'mcp__github__create_pull_request',
      'mcp__github__update_pull_request',
      'CONFIRMED: create pull request',
      'CONFIRMED: update pull request #',
      'pushed',
      'Not discovered',
      'draft: false',
      'Never set `state`',
      '`maintainer_can_modify`',
      'unverified',
      'Change `draft` only if',
      'not supported',
      'Before calling it, confirm the head exists on the remote',
    ]) {
      expect(body).toContain(required);
    }
    expect(body).not.toMatch(/\b(?:git|gh) (?:log|diff|push|pr|status|commit|symbolic-ref|repo)\b/);
    expect(raw).not.toMatch(/shitaku/i);
    expect(raw).not.toContain('Co-Authored-By');
  });

  it('keeps the socratic-challenger agent content contract', () => {
    const raw = readFileSync(join(catalogRoot, 'agents', 'socratic-challenger.md'), 'utf8');
    const [, frontmatter = '', body = ''] = raw.split(/^---\r?\n|\r?\n---\r?\n/);
    const lines = frontmatter.split(/\r?\n/).filter((line) => line.length > 0);
    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe('name: socratic-challenger');
    const descriptionLine = lines.find((line) => line.startsWith('description:')) ?? '';
    const description = descriptionLine.slice('description:'.length).trim();
    expect(description.length).toBeGreaterThan(0);
    expect(description).not.toMatch(/: |['"|]/);
    expect(description).toContain('socratic-method');
    expect(description).toContain('Q&A log');
    expect(lines.filter((line) => line.startsWith('skills:'))).toEqual(['skills:']);
    expect(lines.filter((line) => /^\s+- /.test(line))).toEqual(['  - socratic-method']);
    expect(lines.filter((line) => line.startsWith('tools:'))).toHaveLength(1);
    expect(frontmatter).not.toMatch(/[>|]\s*$/m);

    const toolsLine = lines.find((line) => line.startsWith('tools:')) ?? '';
    const tools = toolsLine
      .slice('tools:'.length)
      .split(',')
      .map((tool) => tool.trim());
    expect([...tools].sort()).toEqual(['Edit', 'Glob', 'Grep', 'Read', 'Write']);
    for (const forbidden of ['Bash', '*', 'mcp__']) {
      expect(toolsLine).not.toContain(forbidden);
    }

    for (const required of [
      'socratic-method',
      'Follow its rules and tone',
      'stop and report that it must be installed',
      'Do not improvise',
      'There is no default path',
      'ask for one and write nothing',
      'no log is wanted',
      'do not ask for a path again',
      'Every invocation is independent',
      'Use Edit and Write only for the Q&A log',
      '# Q&A log',
      'Never change or delete earlier content',
      'Never overwrite an existing file with Write',
      'decision summary',
      'Never implement features',
      'Never invent answers or decisions',
    ]) {
      expect(body).toContain(required);
    }
    expect(raw).not.toMatch(/shitaku/i);
    expect(raw).not.toContain('Co-Authored-By');
  });

  it('keeps the qa agent content contract', () => {
    const raw = readFileSync(join(catalogRoot, 'agents', 'qa.md'), 'utf8');
    const [, frontmatter = '', body = ''] = raw.split(/^---\r?\n|\r?\n---\r?\n/);
    const lines = frontmatter.split(/\r?\n/).filter((line) => line.length > 0);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('name: qa');
    const descriptionLine = lines.find((line) => line.startsWith('description:')) ?? '';
    const description = descriptionLine.slice('description:'.length).trim();
    expect(description.length).toBeGreaterThan(0);
    expect(description).not.toMatch(/: |['"|]/);
    expect(description).toContain('missing tests');
    expect(description).toContain('never claims a check it could not run');
    expect(lines.some((line) => line.startsWith('skills:'))).toBe(false);
    expect(lines.filter((line) => line.startsWith('tools:'))).toHaveLength(1);
    expect(frontmatter).not.toMatch(/[>|]\s*$/m);

    const toolsLine = lines.find((line) => line.startsWith('tools:')) ?? '';
    const tools = toolsLine
      .slice('tools:'.length)
      .split(',')
      .map((tool) => tool.trim());
    const playwrightTools = [
      'browser_navigate',
      'browser_snapshot',
      'browser_take_screenshot',
      'browser_console_messages',
      'browser_resize',
      'browser_click',
      'browser_type',
      'browser_wait_for',
      'browser_close',
    ].map((tool) => `mcp__playwright__${tool}`);
    expect([...tools].sort()).toEqual(['Edit', 'Glob', 'Grep', 'Read', 'Write', ...playwrightTools].sort());
    for (const tool of tools.filter((t) => t.startsWith('mcp__'))) {
      expect(tool).toMatch(/^mcp__playwright__[a-z_]+$/);
    }
    for (const forbidden of [
      'Bash',
      '*',
      'browser_evaluate',
      'browser_run_code',
      'browser_run_code_unsafe',
      'browser_file_upload',
      'browser_install',
    ]) {
      expect(toolsLine).not.toContain(forbidden);
    }

    for (const required of [
      'stop and ask for it, and write nothing',
      'Every invocation is independent',
      'Missing tests for changed behavior fail the gate',
      'never claim coverage you could not locate',
      'Write a failing test that reproduces each confirmed bug',
      'Use Write and Edit only for test files',
      'never remove or weaken an existing test',
      'Not run',
      'command unknown',
      '`unavailable`',
      'Never invent a baseline',
      '`static review passed`',
      'Never claim a check you could not run',
      'Never invent test output',
      'Never edit source, configuration, specs, docs or any other non-test file',
      'Never fix the bug',
      'mcp__playwright__<tool>',
    ]) {
      expect(body).toContain(required);
    }
    expect(raw).not.toMatch(/shitaku/i);
    expect(raw).not.toContain('Co-Authored-By');
  });

  it('keeps the docs-writer agent content contract', () => {
    const raw = readFileSync(join(catalogRoot, 'agents', 'docs-writer.md'), 'utf8');
    const [, frontmatter = '', body = ''] = raw.split(/^---\r?\n|\r?\n---\r?\n/);
    const lines = frontmatter.split(/\r?\n/).filter((line) => line.length > 0);
    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe('name: docs-writer');
    const descriptionLine = lines.find((line) => line.startsWith('description:')) ?? '';
    const description = descriptionLine.slice('description:'.length).trim();
    expect(description.length).toBeGreaterThan(0);
    expect(description).not.toMatch(/: |['"|]/);
    expect(description).toContain('docs-writing');
    expect(description).toContain('documentation');
    expect(description).toContain('code comments');
    expect(description).not.toMatch(/pull request|commit message|instruction file/i);
    expect(lines.filter((line) => line.startsWith('skills:'))).toEqual(['skills:']);
    expect(lines.filter((line) => /^\s+- /.test(line))).toEqual(['  - docs-writing']);
    expect(lines.filter((line) => line.startsWith('tools:'))).toHaveLength(1);
    expect(frontmatter).not.toMatch(/[>|]\s*$/m);

    const toolsLine = lines.find((line) => line.startsWith('tools:')) ?? '';
    const tools = toolsLine
      .slice('tools:'.length)
      .split(',')
      .map((tool) => tool.trim());
    expect([...tools].sort()).toEqual(['Edit', 'Glob', 'Grep', 'Read', 'Write']);
    for (const forbidden of ['Bash', '*', 'mcp__']) {
      expect(toolsLine).not.toContain(forbidden);
    }

    expect(body).toContain('## Requirements');
    for (const required of [
      'Follow its rules',
      'stop and report that it must be installed',
      'Do not improvise a documentation style',
      'Use Edit and Write only on documentation files and on comments or JSDoc inside source files',
      'only write documentation and comments',
      'Never change code logic, configuration or tests',
      'agent instruction files',
      'pull request text or commit messages',
      'cannot run docs generators, check scripts or `git diff`',
      'ask the caller to run it',
      'report it as not run',
      'ask the caller to provide the diff',
      'Never claim that generated documentation is in sync',
      'Never hand-edit generated output',
    ]) {
      expect(body).toContain(required);
    }
    expect(raw).not.toMatch(/shitaku/i);
    expect(raw).not.toContain('Co-Authored-By');
  });

  it('keeps every bundled agent skill registered in the catalog', async () => {
    const index = JSON.parse(readFileSync(join(catalogRoot, 'catalog.json'), 'utf8')) as {
      items: { skills: string[] };
    };
    const catalog = await new FolderCatalogSource(catalogRoot, 'bundled').load();
    const agents = catalog.agents.map((agent) => ({ name: agent.name, text: new TextDecoder().decode(agent.bytes) }));
    expect(agents.flatMap((agent) => agentSkills(agent.text)).length).toBeGreaterThan(0);
    expect(danglingSkills(agents, index.items.skills)).toEqual([]);
  });

  it('detects an agent skill missing from the registered skills', () => {
    const agents = [{ name: 'broken', text: '---\nname: broken\nskills:\n  - missing-skill\n---\nbody\n' }];
    expect(danglingSkills(agents, ['docs-writing'])).toEqual(['broken: missing-skill']);
  });

  it('documents scripts in README with generated markers and shitaku run', () => {
    const readme = readFileSync(join(catalogRoot, '..', 'README.md'), 'utf8');
    expect(readme).toContain('<!-- catalog:scripts:start -->');
    expect(readme).toContain('<!-- catalog:scripts:end -->');
    expect(readme).toMatch(/shitaku run(?:\s|$)/);
    expect(readme).toContain('`./.shitaku/scripts/`');
    expect(readme).toContain('script.json');
  });
});
