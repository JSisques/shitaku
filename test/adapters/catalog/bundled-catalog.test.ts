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
    expect(resolveProfile('web', catalog.profiles, mcpNames, skillNames, scriptNames)).toEqual({
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
    });
    expect(resolveProfile('backend', catalog.profiles, mcpNames, skillNames, scriptNames)).toEqual({
      mcps: ['context7', 'github', 'docker', 'sqlite', 'supabase'],
      skills: [],
      scripts: [],
    });
  });

  it('ships an empty scripts catalog structure with no concrete scripts', async () => {
    const index = JSON.parse(readFileSync(join(catalogRoot, 'catalog.json'), 'utf8')) as {
      items: { scripts?: unknown };
    };
    expect(index.items.scripts).toEqual([]);

    const scriptsDir = join(catalogRoot, 'scripts');
    expect(statSync(scriptsDir).isDirectory()).toBe(true);
    const entries = readdirSync(scriptsDir).filter((name) => !name.startsWith('.'));
    expect(entries).toEqual([]);

    const catalog = await new FolderCatalogSource(catalogRoot, 'bundled').load();
    expect(catalog.scripts).toEqual([]);
  });

  it('loads the bundled example skill with its frontmatter', async () => {
    const catalog = await new FolderCatalogSource(catalogRoot, 'bundled').load();
    expect(catalog.skills).toHaveLength(1);
    expect(catalog.skills[0]).toMatchObject({ name: 'example-skill' });
    expect(catalog.skills[0]?.description).toContain('example skill');
    expect(catalog.skills[0]?.files.map((f) => f.path)).toEqual(['SKILL.md']);
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
