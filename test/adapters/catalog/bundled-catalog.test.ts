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
    expect(catalog.mcps.map((m) => m.name)).toEqual(['github', 'context7', 'playwright', 'figma']);
    expect(
      resolveProfile(
        'web',
        catalog.profiles,
        catalog.mcps.map((m) => m.name),
        catalog.skills.map((sk) => sk.name),
      ),
    ).toEqual({ mcps: ['context7', 'github', 'playwright', 'figma'], skills: [] });
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
