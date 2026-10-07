import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FolderCatalogSource } from '@/adapters/catalog/folder-source.js';
import { resolveProfile } from '@/domain/catalog/profile.js';

const catalogRoot = join(import.meta.dirname, '..', '..', '..', 'catalog');

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
    ]);
    const mcpNames = catalog.mcps.map((m) => m.name);
    const skillNames = catalog.skills.map((sk) => sk.name);
    const scriptNames = catalog.scripts.map((s) => s.name);
    expect(resolveProfile('web', catalog.profiles, mcpNames, skillNames, scriptNames, [])).toEqual({
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
    });
    expect(resolveProfile('backend', catalog.profiles, mcpNames, skillNames, scriptNames, [])).toEqual({
      mcps: ['context7', 'github', 'docker', 'sqlite', 'supabase'],
      skills: [],
      scripts: [],
      commands: [],
    });
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

  it('ships example-skill and socratic-method as registered loadable bundled skills', async () => {
    const index = JSON.parse(readFileSync(join(catalogRoot, 'catalog.json'), 'utf8')) as {
      items: { skills?: unknown };
    };
    expect(index.items.skills).toEqual(['example-skill', 'socratic-method']);

    const skillsDir = join(catalogRoot, 'skills');
    expect(statSync(skillsDir).isDirectory()).toBe(true);
    const entries = readdirSync(skillsDir)
      .filter((name) => !name.startsWith('.'))
      .sort();
    expect(entries).toEqual(['example-skill', 'socratic-method']);

    const catalog = await new FolderCatalogSource(catalogRoot, 'bundled').load();
    expect(catalog.issues).toEqual([]);
    expect(catalog.skills).toHaveLength(2);

    const byName = Object.fromEntries(catalog.skills.map((sk) => [sk.name, sk]));
    expect(byName['example-skill']).toMatchObject({ name: 'example-skill' });
    expect(byName['example-skill']?.description).toContain('example skill');
    expect(byName['example-skill']?.files.map((f) => f.path)).toEqual(['SKILL.md']);

    expect(byName['socratic-method']).toMatchObject({ name: 'socratic-method' });
    expect(byName['socratic-method']?.description.length).toBeGreaterThan(0);
    expect(byName['socratic-method']?.files.map((f) => f.path)).toEqual(['SKILL.md']);
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
