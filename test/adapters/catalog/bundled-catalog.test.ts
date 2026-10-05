import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FolderCatalogSource } from '@/adapters/catalog/folder-source.js';
import { resolveProfile } from '@/domain/catalog/profile.js';

describe('bundled catalog', () => {
  it('loads without issues and resolves profiles', async () => {
    const catalog = await new FolderCatalogSource(
      join(import.meta.dirname, '..', '..', '..', 'catalog'),
      'bundled',
    ).load();
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

  it('loads with an empty scripts list', async () => {
    const catalog = await new FolderCatalogSource(
      join(import.meta.dirname, '..', '..', '..', 'catalog'),
      'bundled',
    ).load();
    expect(catalog.scripts).toEqual([]);
  });

  it('loads the bundled example skill with its frontmatter', async () => {
    const catalog = await new FolderCatalogSource(
      join(import.meta.dirname, '..', '..', '..', 'catalog'),
      'bundled',
    ).load();
    expect(catalog.skills).toHaveLength(1);
    expect(catalog.skills[0]).toMatchObject({ name: 'example-skill' });
    expect(catalog.skills[0]?.description).toContain('example skill');
    expect(catalog.skills[0]?.files.map((f) => f.path)).toEqual(['SKILL.md']);
  });
});
