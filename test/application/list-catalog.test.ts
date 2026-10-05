import { describe, expect, it } from 'vitest';
import { CatalogLoadError, listCatalog } from '@/application/list-catalog.js';
import type { CatalogSource, LoadedCatalog } from '@/ports/catalog-source.js';

const loaded: LoadedCatalog = {
  mcps: [{ name: 'fs', description: 'Filesystem', server: { type: 'stdio', command: 'npx', args: [] }, env: [] }],
  skills: [{ name: 'demo', description: 'Browser automation', files: [] }],
  scripts: [],
  profiles: [],
  issues: [{ file: 'skills/bad', reason: 'missing SKILL.md' }],
};

const sourceOf = (load: () => Promise<LoadedCatalog>): CatalogSource => ({
  ref: () => ({ kind: 'folder', location: '/cat' }),
  load,
});

describe('listCatalog', () => {
  it('returns the entries and passes the catalog issues through', async () => {
    const report = await listCatalog({ source: sourceOf(() => Promise.resolve(loaded)) }, {});
    expect(report.items).toEqual([
      { kind: 'mcp', name: 'fs', description: 'Filesystem' },
      { kind: 'skill', name: 'demo', description: 'Browser automation' },
    ]);
    expect(report.issues).toEqual([{ file: 'skills/bad', reason: 'missing SKILL.md' }]);
  });

  it('applies the kind and search request', async () => {
    const report = await listCatalog(
      { source: sourceOf(() => Promise.resolve(loaded)) },
      { kind: 'skills', search: 'BROWSER' },
    );
    expect(report.items).toEqual([{ kind: 'skill', name: 'demo', description: 'Browser automation' }]);
  });

  it('wraps a rejected load in CatalogLoadError with the original message', async () => {
    const source = sourceOf(() => Promise.reject(new Error('ENOENT: no catalog.json')));
    const failure = await listCatalog({ source }, {}).then(
      () => null,
      (e: unknown) => e,
    );
    expect(failure).toBeInstanceOf(CatalogLoadError);
    expect((failure as CatalogLoadError).message).toBe('ENOENT: no catalog.json');
  });

  it('wraps a non-Error rejection using its string form', async () => {
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the port may reject with any value
    const source = sourceOf(() => Promise.reject('boom'));
    const failure = await listCatalog({ source }, {}).then(
      () => null,
      (e: unknown) => e,
    );
    expect(failure).toBeInstanceOf(CatalogLoadError);
    expect((failure as CatalogLoadError).message).toBe('boom');
  });
});
