import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FolderCatalogSource } from '@/adapters/catalog/folder-source.js';
import { resolveProfile } from '@/domain/catalog/profile.js';

const catalogRoot = join(import.meta.dirname, '..', '..', '..', 'catalog');

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

  it('ships complexity, dead-code, and duplication as registered and loadable bundled scripts', async () => {
    const index = JSON.parse(readFileSync(join(catalogRoot, 'catalog.json'), 'utf8')) as {
      items: { scripts?: unknown };
    };
    expect(index.items.scripts).toEqual(['complexity', 'dead-code', 'duplication']);

    const scriptsDir = join(catalogRoot, 'scripts');
    expect(statSync(scriptsDir).isDirectory()).toBe(true);
    const entries = readdirSync(scriptsDir)
      .filter((name) => !name.startsWith('.'))
      .sort();
    expect(entries).toEqual(['complexity', 'dead-code', 'duplication']);

    const catalog = await new FolderCatalogSource(catalogRoot, 'bundled').load();
    expect(catalog.issues).toEqual([]);
    expect(catalog.scripts).toHaveLength(3);

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

  it('documents scripts in README with generated markers and shitaku run', () => {
    const readme = readFileSync(join(catalogRoot, '..', 'README.md'), 'utf8');
    expect(readme).toContain('<!-- catalog:scripts:start -->');
    expect(readme).toContain('<!-- catalog:scripts:end -->');
    expect(readme).toMatch(/shitaku run(?:\s|$)/);
    expect(readme).toContain('`./.shitaku/scripts/`');
    expect(readme).toContain('script.json');
  });
});
