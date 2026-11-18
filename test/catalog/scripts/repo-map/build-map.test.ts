import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  aliases,
  loadRepoMapModule,
  makeTempTree,
  nonGit,
  simpleApp,
  snapshotFromTree,
  trickySyntax,
  type BuildMapModule,
  type ScanModule,
  type TempTree,
  workspaceMonorepo,
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

  it('keeps a zero inbound count for every module that nothing imports', () => {
    const doc = build(snapshotFromTree({ 'a.ts': 'export const a = 1;\n', 'b.ts': 'export const b = 2;\n' }));
    expect(doc.graph).toEqual({ edges: [], importedByCount: { 'a.ts': 0, 'b.ts': 0 } });
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

describe('buildRepoMap (project detection)', () => {
  it('includes stack, workspaces, commands, entry points and conventions for a simple app', () => {
    const doc = build(snapshotFromTree(simpleApp));
    expect(doc.stack).toMatchObject({
      languages: [{ name: 'typescript', files: 3 }],
      testRunners: ['vitest'],
      typescript: { config: true, version: '^5.4.0' },
    });
    expect(doc.workspaces).toEqual([]);
    expect(doc.commands).toEqual({
      packageManager: null,
      scripts: [
        { path: '.', name: 'build', command: 'tsc' },
        { path: '.', name: 'test', command: 'vitest run' },
      ],
    });
    expect(doc.entryPoints).toEqual([
      { path: '.', package: 'simple-app', field: 'main', key: null, file: 'dist/index.js' },
    ]);
    expect(doc.conventions).toEqual({
      moduleSystem: 'esm',
      testFiles: { pattern: 'test', dirs: ['test'] },
      relativeImportExtensions: 'js',
      pathAliases: ['@/*'],
      tsStrict: true,
    });
  });

  it('describes a workspace monorepo from its manifests', () => {
    const doc = build(snapshotFromTree(workspaceMonorepo));
    expect(doc.root).toEqual({ packageName: 'acme' });
    expect(doc.workspaces).toEqual([
      { name: '@acme/web', path: 'apps/web' },
      { name: '@acme/core', path: 'packages/core' },
    ]);
    expect(doc.commands.packageManager).toBe('pnpm');
    expect(doc.commands.scripts.map((script) => `${script.path}:${script.name}`)).toEqual([
      '.:build',
      'apps/web:dev',
      'packages/core:build',
    ]);
    expect(doc.entryPoints).toHaveLength(3);
    expect(doc.stack).toMatchObject({ packageManager: 'pnpm', typescript: { config: false, version: '^5.4.0' } });
  });

  it('records an invalid manifest as skipped and still builds the document', () => {
    const doc = build(snapshotFromTree({ 'package.json': '{ nope', 'src/a.ts': 'export {};\n' }));
    expect(doc.skipped).toEqual([{ path: 'package.json', reason: 'invalid-json' }]);
    expect(doc.root).toEqual({ packageName: null });
    expect(doc.commands).toEqual({ packageManager: null, scripts: [] });
    expect(doc.entryPoints).toEqual([]);
    expect(doc.modules.map((module) => module.path)).toEqual(['src/a.ts']);
  });

  it('keeps every collection in the documented sort order, whatever the input order', () => {
    const tree = {
      ...workspaceMonorepo,
      'zeta/b.ts': '',
      'alpha/a.ts': '',
      'alpha-b/c.ts': '',
      'bad/package.json': '{ nope',
    };
    const ordered = snapshotFromTree(tree);
    const shuffled = snapshotFromTree(tree, { files: [...ordered.files].reverse() });
    shuffled.skipped.reverse();
    const doc = build(shuffled);
    expect(JSON.stringify(doc)).toBe(JSON.stringify(build(ordered)));

    const sorted = <T>(items: T[], key: (item: T) => string) =>
      items.map(key).every((k, i, all) => i === 0 || (all[i - 1] ?? '') <= k);
    expect(sorted(doc.tree, (e) => e.path)).toBe(true);
    expect(sorted(doc.modules, (e) => e.path)).toBe(true);
    expect(sorted(doc.skipped, (e) => e.path)).toBe(true);
    expect(sorted(doc.workspaces, (e) => e.path)).toBe(true);
    expect(sorted(doc.commands.scripts, (e) => `${e.path}\0${e.name}`)).toBe(true);
    expect(doc.tree.map((entry) => entry.path)).toEqual([
      '.',
      'alpha',
      'alpha-b',
      'apps',
      'apps/web',
      'apps/web/bin',
      'apps/web/src',
      'bad',
      'packages',
      'packages/core',
      'packages/core/src',
      'zeta',
    ]);
  });
});

type Doc = ReturnType<BuildMapModule['buildRepoMap']>;
const moduleAt = (doc: Doc, path: string): Doc['modules'][number] | undefined =>
  doc.modules.find((module) => module.path === path);

describe('buildRepoMap (imports, exports and graph)', () => {
  it('populates imports with status and resolved path, and exports with signatures', () => {
    const doc = build(snapshotFromTree(simpleApp));
    expect(moduleAt(doc, 'src/index.ts')).toEqual({
      path: 'src/index.ts',
      language: 'typescript',
      imports: [{ specifier: './util.js', kind: 'static', status: 'internal', resolved: 'src/util.ts' }],
      exports: [{ name: 'main', kind: 'function', signature: 'function main(): number' }],
    });
    expect(moduleAt(doc, 'src/util.ts')?.exports).toEqual([{ name: 'add', kind: 'const', signature: 'const add' }]);
    expect(moduleAt(doc, 'test/util.test.ts')?.imports).toEqual([
      { specifier: '@/util.js', kind: 'static', status: 'internal', resolved: 'src/util.ts' },
    ]);
  });

  it('lists only internal module-to-module edges and counts inbound edges (A imported by B and C is 2)', () => {
    const doc = build(snapshotFromTree(simpleApp));
    expect(doc.graph).toEqual({
      edges: [
        { from: 'src/index.ts', to: 'src/util.ts' },
        { from: 'test/util.test.ts', to: 'src/util.ts' },
      ],
      importedByCount: { 'src/index.ts': 0, 'src/util.ts': 2, 'test/util.test.ts': 0 },
    });
  });

  it('dedupes edges across import kinds but keeps each import entry, sorted by specifier then kind', () => {
    const doc = build(
      snapshotFromTree({
        'a.ts': "import { x } from './c';\nimport type { T } from './c';\nexport const a = 1;\n",
        'b.ts': "import './c';\n",
        'c.ts': 'export const x = 1;\nexport type T = string;\n',
      }),
    );
    expect(moduleAt(doc, 'a.ts')?.imports.map((i) => `${i.specifier}:${i.kind}`)).toEqual(['./c:static', './c:type']);
    expect(doc.graph.edges).toEqual([
      { from: 'a.ts', to: 'c.ts' },
      { from: 'b.ts', to: 'c.ts' },
    ]);
    expect(doc.graph.importedByCount).toEqual({ 'a.ts': 0, 'b.ts': 0, 'c.ts': 2 });
  });

  it('creates no edge for external, unresolved or non-module targets', () => {
    const doc = build(
      snapshotFromTree({
        'a.ts':
          "import fs from 'node:fs';\nimport _ from 'lodash';\nimport './missing';\nimport data from './data.json';\n",
        'data.json': '{}',
      }),
    );
    expect(moduleAt(doc, 'a.ts')?.imports).toEqual([
      { specifier: './data.json', kind: 'static', status: 'internal', resolved: 'data.json' },
      { specifier: './missing', kind: 'static', status: 'unresolved', resolved: null },
      { specifier: 'lodash', kind: 'static', status: 'external', resolved: null },
      { specifier: 'node:fs', kind: 'static', status: 'external', resolved: null },
    ]);
    expect(doc.graph).toEqual({ edges: [], importedByCount: { 'a.ts': 0 } });
  });

  it('sorts edges by from, then to, whatever order the sources arrive in', () => {
    const tree = {
      'a.ts': "import './z';\nimport './m';\n",
      'm.ts': "import './z';\n",
      'z.ts': '',
    };
    const forward = snapshotFromTree(tree);
    const reversed = snapshotFromTree(tree, { sources: new Map([...forward.sources].reverse()) });
    const doc = build(reversed);
    expect(doc.graph.edges).toEqual([
      { from: 'a.ts', to: 'm.ts' },
      { from: 'a.ts', to: 'z.ts' },
      { from: 'm.ts', to: 'z.ts' },
    ]);
    expect(JSON.stringify(doc)).toBe(JSON.stringify(build(forward)));
  });

  it('extracts only real imports and exports from tricky syntax, and survives broken files', () => {
    const doc = build(snapshotFromTree(trickySyntax));
    expect(moduleAt(doc, 'src/index.ts')).toEqual({
      path: 'src/index.ts',
      language: 'typescript',
      imports: [
        { specifier: './lazy', kind: 'dynamic', status: 'internal', resolved: 'src/lazy.ts' },
        { specifier: './real.js', kind: 'static', status: 'internal', resolved: 'src/real.ts' },
        { specifier: './reexport', kind: 'reexport', status: 'internal', resolved: 'src/reexport.ts' },
        { specifier: './types', kind: 'type', status: 'internal', resolved: 'src/types.ts' },
      ],
      exports: [
        { name: '*', kind: 'reexport-all', signature: null },
        { name: 'lazy', kind: 'const', signature: 'const lazy' },
        { name: 'main', kind: 'function', signature: 'function main(shape: Shape): string' },
      ],
    });
    expect(moduleAt(doc, 'src/view.tsx')).toEqual({
      path: 'src/view.tsx',
      language: 'tsx',
      imports: [{ specifier: './real', kind: 'static', status: 'internal', resolved: 'src/real.ts' }],
      exports: [
        { name: 'Other', kind: 'const', signature: 'const Other' },
        { name: 'View', kind: 'const', signature: 'const View' },
      ],
    });
    expect(moduleAt(doc, 'src/broken.ts')).toEqual({
      path: 'src/broken.ts',
      language: 'typescript',
      imports: [{ specifier: './missing', kind: 'static', status: 'unresolved', resolved: null }],
      exports: [
        { name: 'after', kind: 'function', signature: 'function after(): void' },
        { name: 'ok', kind: 'const', signature: 'const ok' },
      ],
    });
    expect(moduleAt(doc, 'src/nonliteral.ts')?.imports).toEqual([]);
    expect(doc.graph.importedByCount['src/real.ts']).toBe(2);
    expect(doc.graph.edges).toEqual([
      { from: 'src/index.ts', to: 'src/lazy.ts' },
      { from: 'src/index.ts', to: 'src/real.ts' },
      { from: 'src/index.ts', to: 'src/reexport.ts' },
      { from: 'src/index.ts', to: 'src/types.ts' },
      { from: 'src/view.tsx', to: 'src/real.ts' },
    ]);
  });

  it('resolves tsconfig aliases through extends and marks unresolved aliases and externals', () => {
    const doc = build(snapshotFromTree(aliases));
    expect(moduleAt(doc, 'src/main.ts')?.imports).toEqual([
      { specifier: '@/gone', kind: 'static', status: 'unresolved', resolved: null },
      { specifier: '@/util', kind: 'static', status: 'internal', resolved: 'src/util.ts' },
      { specifier: 'react', kind: 'static', status: 'external', resolved: null },
      { specifier: '~lib', kind: 'static', status: 'internal', resolved: 'src/lib/index.ts' },
    ]);
    expect(doc.graph.edges).toEqual([
      { from: 'src/main.ts', to: 'src/lib/index.ts' },
      { from: 'src/main.ts', to: 'src/util.ts' },
    ]);
  });

  it('resolves workspace package imports to the package entry', () => {
    const doc = build(snapshotFromTree(workspaceMonorepo));
    expect(moduleAt(doc, 'apps/web/src/page.ts')?.imports).toEqual([
      { specifier: './helper.js', kind: 'static', status: 'internal', resolved: 'apps/web/src/helper.ts' },
      { specifier: '@acme/core', kind: 'static', status: 'internal', resolved: 'packages/core/src/index.ts' },
    ]);
    expect(moduleAt(doc, 'apps/web/bin/web.js')?.imports).toEqual([
      { specifier: '@acme/core', kind: 'static', status: 'internal', resolved: 'packages/core/src/index.ts' },
      { specifier: 'node:fs', kind: 'static', status: 'external', resolved: null },
    ]);
    expect(doc.graph.importedByCount['packages/core/src/index.ts']).toBe(2);
    expect(doc.graph.importedByCount['apps/web/src/helper.ts']).toBe(1);
  });

  it('records a module whose extraction throws with empty arrays and keeps going', () => {
    const snapshot = snapshotFromTree({ 'ok.ts': "import './x';\n", 'bad.ts': '' });
    snapshot.sources.set('bad.ts', null as unknown as string);
    const doc = build(snapshot);
    expect(moduleAt(doc, 'bad.ts')).toEqual({ path: 'bad.ts', language: 'typescript', imports: [], exports: [] });
    expect(moduleAt(doc, 'ok.ts')?.imports).toEqual([
      { specifier: './x', kind: 'static', status: 'unresolved', resolved: null },
    ]);
  });
});

describe('buildRepoMap (relativeImportExtensions)', () => {
  const extensions = (tree: Record<string, string>): unknown =>
    build(snapshotFromTree(tree)).conventions['relativeImportExtensions'];

  it.each([
    ['js', { 'a.ts': "import './b.js';\n", 'b.ts': '' }],
    ['none', { 'a.ts': "import './b';\n", 'b.ts': '' }],
    ['mixed', { 'a.ts': "import './b.js';\nimport './c';\n", 'b.ts': '', 'c.ts': '' }],
  ])('is %s for TypeScript files by their relative specifiers', (expected, tree) => {
    expect(extensions(tree)).toBe(expected);
  });

  it('is null without relative specifiers in TypeScript files, whatever JavaScript files do', () => {
    expect(extensions({ 'a.ts': "import 'lodash';\n" })).toBeNull();
    expect(extensions({ 'a.js': "import './b.js';\n", 'b.js': '' })).toBeNull();
    expect(extensions({ 'a.tsx': "import './b.js';\n", 'b.ts': '' })).toBe('js');
  });
});
