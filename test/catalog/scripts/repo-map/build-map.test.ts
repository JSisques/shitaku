import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  loadRepoMapModule,
  makeTempTree,
  nonGit,
  simpleApp,
  snapshotFromTree,
  type BuildMapModule,
  type ScanModule,
  type TempTree,
} from '@test/helpers/repo-map.js';

let build: BuildMapModule['buildRepoMap'];
let SCHEMA: string;
let scanModule: ScanModule;
const temps: TempTree[] = [];

beforeAll(async () => {
  const mod = await loadRepoMapModule<BuildMapModule>('build-map.mjs');
  build = mod.buildRepoMap;
  SCHEMA = mod.SCHEMA;
  scanModule = await loadRepoMapModule<ScanModule>('scan.mjs');
});

afterEach(async () => {
  await Promise.all(temps.splice(0).map((temp) => temp.cleanup()));
});

describe('buildRepoMap (base document)', () => {
  it('has the versioned schema, every top-level key, the commit and the root package name', () => {
    const doc = build(snapshotFromTree(simpleApp, { commit: 'abc123' }));
    expect(doc.schema).toBe('shitaku.catalog.repo-map/v1');
    expect(SCHEMA).toBe('shitaku.catalog.repo-map/v1');
    expect(Object.keys(doc).sort()).toEqual([
      'commands',
      'commit',
      'conventions',
      'entryPoints',
      'graph',
      'modules',
      'root',
      'schema',
      'skipped',
      'stack',
      'tree',
      'workspaces',
    ]);
    expect(doc.commit).toBe('abc123');
    expect(doc.root).toEqual({ packageName: 'simple-app' });
  });

  it.each([
    ['no root manifest', { 'src/a.ts': '' }],
    ['a nameless root manifest', { 'package.json': '{"version":"1.0.0"}' }],
    ['an invalid root manifest', { 'package.json': '{ nope' }],
  ])('gives root.packageName null with %s', (_label, tree) => {
    expect(build(snapshotFromTree(tree)).root).toEqual({ packageName: null });
  });

  it('lists every directory with direct and recursive file counts', () => {
    const doc = build(
      snapshotFromTree({
        'a.ts': '',
        'src/x.ts': '',
        'src/deep/y.ts': '',
        'src/deep/z.py': '',
        'only/nested/w.go': '',
      }),
    );
    expect(doc.tree).toEqual([
      { path: '.', files: 1, totalFiles: 5 },
      { path: 'only', files: 0, totalFiles: 1 },
      { path: 'only/nested', files: 1, totalFiles: 1 },
      { path: 'src', files: 1, totalFiles: 3 },
      { path: 'src/deep', files: 2, totalFiles: 2 },
    ]);
  });

  it('keeps the root entry for an empty listing', () => {
    expect(build(snapshotFromTree({})).tree).toEqual([{ path: '.', files: 0, totalFiles: 0 }]);
  });

  it('creates modules only for files with an extractor extension, sorted by path', () => {
    const doc = build(
      snapshotFromTree({
        'z.ts': '',
        'b.mts': '',
        'c.cts': '',
        'd.tsx': '',
        'e.js': '',
        'f.mjs': '',
        'g.cjs': '',
        'h.jsx': '',
        'a.py': '',
        'a.go': '',
        'README.md': '',
        'data.json': '',
      }),
    );
    expect(doc.modules).toEqual([
      { path: 'b.mts', language: 'typescript', imports: [], exports: [] },
      { path: 'c.cts', language: 'typescript', imports: [], exports: [] },
      { path: 'd.tsx', language: 'tsx', imports: [], exports: [] },
      { path: 'e.js', language: 'javascript', imports: [], exports: [] },
      { path: 'f.mjs', language: 'javascript', imports: [], exports: [] },
      { path: 'g.cjs', language: 'javascript', imports: [], exports: [] },
      { path: 'h.jsx', language: 'jsx', imports: [], exports: [] },
      { path: 'z.ts', language: 'typescript', imports: [], exports: [] },
    ]);
    // Non-module files still count in the tree.
    expect(doc.tree).toEqual([{ path: '.', files: 12, totalFiles: 12 }]);
  });

  it('does not make a module of a source that was skipped', () => {
    const snapshot = snapshotFromTree({ 'big.ts': '', 'ok.ts': '' });
    snapshot.sources.delete('big.ts');
    snapshot.skipped.push({ path: 'big.ts', reason: 'too-large' });
    const doc = build(snapshot);
    expect(doc.modules.map((m) => m.path)).toEqual(['ok.ts']);
    expect(doc.skipped).toEqual([{ path: 'big.ts', reason: 'too-large' }]);
    expect(doc.tree).toEqual([{ path: '.', files: 2, totalFiles: 2 }]);
  });

  it('starts with no edges and a zero inbound count for every module', () => {
    const doc = build(snapshotFromTree(simpleApp));
    expect(doc.graph).toEqual({
      edges: [],
      importedByCount: { 'src/index.ts': 0, 'src/util.ts': 0, 'test/util.test.ts': 0 },
    });
  });

  it('sorts skipped entries by path', () => {
    const snapshot = snapshotFromTree({ 'a.ts': '' });
    snapshot.skipped.push({ path: 'z/package.json', reason: 'invalid-json' }, { path: 'big.ts', reason: 'too-large' });
    expect(build(snapshot).skipped.map((s) => s.path)).toEqual(['big.ts', 'z/package.json']);
  });

  it('contains no absolute path, even when scanning a temp directory', async () => {
    const temp = await makeTempTree({ ...simpleApp, ...nonGit });
    temps.push(temp);
    const previous = process.env['GIT_CEILING_DIRECTORIES'];
    process.env['GIT_CEILING_DIRECTORIES'] = temp.dir.slice(0, temp.dir.lastIndexOf('/'));
    try {
      const doc = build(scanModule.scan(temp.dir, { ignore: [], outRel: null }));
      const text = JSON.stringify(doc);
      expect(doc.modules.length).toBeGreaterThan(0);
      expect(text).not.toContain(temp.dir);
      expect(text).not.toMatch(/"\/|[A-Za-z]:\\\\/);
    } finally {
      if (previous === undefined) delete process.env['GIT_CEILING_DIRECTORIES'];
      else process.env['GIT_CEILING_DIRECTORIES'] = previous;
    }
  });
});
