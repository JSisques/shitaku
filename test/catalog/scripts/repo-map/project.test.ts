import { beforeAll, describe, expect, it } from 'vitest';
import {
  loadRepoMapModule,
  simpleApp,
  snapshotFromTree,
  workspaceMonorepo,
  type Snapshot,
  type Tree,
} from '@test/helpers/repo-map.js';

type ProjectModule = {
  detectWorkspaces: (snapshot: Snapshot) => { name: string | null; path: string }[];
  detectEntryPoints: (snapshot: Snapshot) => {
    path: string;
    package: string | null;
    field: string;
    key: string | null;
    file: string;
  }[];
  detectStack: (snapshot: Snapshot) => {
    languages: { name: string; files: number }[];
    packageManager: string | null;
    node: string | null;
    typescript: { config: boolean; version: string | null };
    frameworks: string[];
    testRunners: string[];
    linters: string[];
    formatters: string[];
    bundlers: string[];
  };
  detectConventions: (
    snapshot: Snapshot,
    modules?: { language: string; imports: { specifier: string }[] }[],
  ) => {
    moduleSystem: string;
    testFiles: { pattern: string | null; dirs: string[] };
    relativeImportExtensions: string | null;
    pathAliases: string[];
    tsStrict: boolean | null;
  };
  detectPackageManager: (snapshot: Snapshot) => string | null;
  detectCommands: (snapshot: Snapshot) => {
    packageManager: string | null;
    scripts: { path: string; name: string; command: string }[];
  };
};

let project: ProjectModule;

beforeAll(async () => {
  project = await loadRepoMapModule<ProjectModule>('project.mjs');
});

const pkg = (value: Record<string, unknown>): string => JSON.stringify(value);

describe('detectWorkspaces', () => {
  it('reads the pnpm-workspace.yaml packages list and sorts by path', () => {
    expect(project.detectWorkspaces(snapshotFromTree(workspaceMonorepo))).toEqual([
      { name: '@acme/web', path: 'apps/web' },
      { name: '@acme/core', path: 'packages/core' },
    ]);
  });

  it.each([
    ['single quotes', "packages:\n  - 'pkgs/*'\n"],
    ['double quotes', 'packages:\n  - "pkgs/*"\n'],
    ['no quotes', 'packages:\n  - pkgs/*\n'],
    ['comments', "# workspaces\npackages: # list\n  - pkgs/* # all\n  # - ignored/*\n  - 'nothing/*'\n"],
    ['CRLF line endings', "packages:\r\n  - 'pkgs/*'\r\n"],
    ['no indentation', 'packages:\n- pkgs/*\n'],
  ])('parses a pnpm-workspace.yaml with %s', (_label, yaml) => {
    const tree: Tree = {
      'package.json': pkg({ name: 'root' }),
      'pnpm-workspace.yaml': yaml,
      'pkgs/a/package.json': pkg({ name: 'a' }),
      'ignored/x/package.json': pkg({ name: 'x' }),
    };
    expect(project.detectWorkspaces(snapshotFromTree(tree))).toEqual([{ name: 'a', path: 'pkgs/a' }]);
  });

  it('stops reading the pnpm list at the next top-level key', () => {
    const tree: Tree = {
      'pnpm-workspace.yaml': "packages:\n  - 'pkgs/*'\ncatalog:\n  - 'other/*'\n",
      'pkgs/a/package.json': pkg({ name: 'a' }),
      'other/b/package.json': pkg({ name: 'b' }),
    };
    expect(project.detectWorkspaces(snapshotFromTree(tree))).toEqual([{ name: 'a', path: 'pkgs/a' }]);
  });

  it('honours ! negation in the pnpm list', () => {
    const tree: Tree = {
      'pnpm-workspace.yaml': "packages:\n  - 'pkgs/*'\n  - '!pkgs/skip'\n",
      'pkgs/a/package.json': pkg({ name: 'a' }),
      'pkgs/skip/package.json': pkg({ name: 'skip' }),
    };
    expect(project.detectWorkspaces(snapshotFromTree(tree))).toEqual([{ name: 'a', path: 'pkgs/a' }]);
  });

  it('reads package.json workspaces as an array', () => {
    const tree: Tree = {
      'package.json': pkg({ name: 'root', workspaces: ['pkgs/*'] }),
      'pkgs/b/package.json': pkg({ name: 'b' }),
      'pkgs/a/package.json': pkg({ name: 'a' }),
    };
    expect(project.detectWorkspaces(snapshotFromTree(tree))).toEqual([
      { name: 'a', path: 'pkgs/a' },
      { name: 'b', path: 'pkgs/b' },
    ]);
  });

  it('reads package.json workspaces as an object with packages', () => {
    const tree: Tree = {
      'package.json': pkg({ name: 'root', workspaces: { packages: ['libs/**'] } }),
      'libs/deep/er/package.json': pkg({ name: 'deeper' }),
    };
    expect(project.detectWorkspaces(snapshotFromTree(tree))).toEqual([{ name: 'deeper', path: 'libs/deep/er' }]);
  });

  it('only matches directories that hold a package.json and never the root', () => {
    const tree: Tree = {
      'package.json': pkg({ name: 'root', workspaces: ['pkgs/*', '.'] }),
      'pkgs/a/package.json': pkg({ name: 'a' }),
      'pkgs/empty/index.ts': '',
    };
    expect(project.detectWorkspaces(snapshotFromTree(tree))).toEqual([{ name: 'a', path: 'pkgs/a' }]);
  });

  it('gives name null for a manifest without a string name', () => {
    const tree: Tree = {
      'package.json': pkg({ workspaces: ['pkgs/*'] }),
      'pkgs/a/package.json': pkg({ version: '1.0.0' }),
      'pkgs/b/package.json': pkg({ name: 42 }),
    };
    expect(project.detectWorkspaces(snapshotFromTree(tree))).toEqual([
      { name: null, path: 'pkgs/a' },
      { name: null, path: 'pkgs/b' },
    ]);
  });

  it('ignores an invalid workspace manifest and an invalid root manifest', () => {
    const tree: Tree = {
      'package.json': '{ nope',
      'pnpm-workspace.yaml': 'packages:\n  - pkgs/*\n',
      'pkgs/ok/package.json': pkg({ name: 'ok' }),
      'pkgs/bad/package.json': '{ nope',
    };
    expect(project.detectWorkspaces(snapshotFromTree(tree))).toEqual([{ name: 'ok', path: 'pkgs/ok' }]);
  });

  it('returns no workspaces for a single package', () => {
    expect(project.detectWorkspaces(snapshotFromTree({ 'package.json': pkg({ name: 'solo' }) }))).toEqual([]);
  });
});

describe('detectPackageManager', () => {
  it.each([
    ['pnpm@9.0.0', 'pnpm'],
    ['yarn@4.1.0+sha256.abc', 'yarn'],
    ['npm@10.2.0', 'npm'],
    ['bun@1.1.0', 'bun'],
  ])('takes the name before @ from packageManager %s', (field, expected) => {
    const tree: Tree = { 'package.json': pkg({ packageManager: field }), 'yarn.lock': '' };
    expect(project.detectPackageManager(snapshotFromTree(tree))).toBe(expected);
  });

  it('lets the packageManager field win over a lockfile', () => {
    const tree: Tree = { 'package.json': pkg({ packageManager: 'pnpm@9' }), 'package-lock.json': '{}' };
    expect(project.detectPackageManager(snapshotFromTree(tree))).toBe('pnpm');
  });

  it.each([
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['package-lock.json', 'npm'],
    ['bun.lockb', 'bun'],
    ['bun.lock', 'bun'],
  ])('falls back to the lockfile %s', (lockfile, expected) => {
    const tree: Tree = { 'package.json': pkg({ name: 'x' }), [lockfile]: '' };
    expect(project.detectPackageManager(snapshotFromTree(tree))).toBe(expected);
  });

  it('checks lockfiles in the documented order', () => {
    const tree: Tree = { 'bun.lock': '', 'package-lock.json': '', 'yarn.lock': '' };
    expect(project.detectPackageManager(snapshotFromTree(tree))).toBe('yarn');
    const withPnpm: Tree = { ...tree, 'pnpm-lock.yaml': '' };
    expect(project.detectPackageManager(snapshotFromTree(withPnpm))).toBe('pnpm');
    const bunOnly: Tree = { 'bun.lock': '', 'bun.lockb': '' };
    expect(project.detectPackageManager(snapshotFromTree(bunOnly))).toBe('bun');
  });

  it('ignores lockfiles that are not at the root', () => {
    expect(project.detectPackageManager(snapshotFromTree({ 'pkgs/a/yarn.lock': '' }))).toBeNull();
  });

  it('gives null when there is no signal, and ignores a malformed packageManager', () => {
    expect(project.detectPackageManager(snapshotFromTree({ 'package.json': pkg({ name: 'x' }) }))).toBeNull();
    expect(
      project.detectPackageManager(snapshotFromTree({ 'package.json': pkg({ packageManager: '@9' }) })),
    ).toBeNull();
    expect(project.detectPackageManager(snapshotFromTree({ 'package.json': pkg({ packageManager: 7 }) }))).toBeNull();
  });
});

describe('detectCommands', () => {
  it('lists root and workspace scripts sorted by path then name', () => {
    const doc = project.detectCommands(snapshotFromTree(workspaceMonorepo));
    expect(doc).toEqual({
      packageManager: 'pnpm',
      scripts: [
        { path: '.', name: 'build', command: 'pnpm -r build' },
        { path: 'apps/web', name: 'dev', command: 'node bin/web.js' },
        { path: 'packages/core', name: 'build', command: 'tsc -p .' },
      ],
    });
  });

  it('sorts script names by code unit within a package', () => {
    const tree: Tree = { 'package.json': pkg({ scripts: { test: 't', build: 'b', Zed: 'z', lint: 'l' } }) };
    expect(project.detectCommands(snapshotFromTree(tree)).scripts.map((s) => s.name)).toEqual([
      'Zed',
      'build',
      'lint',
      'test',
    ]);
  });

  it('skips non-string scripts and manifests outside the root and the workspaces', () => {
    const tree: Tree = {
      'package.json': pkg({ scripts: { ok: 'x', bad: 1 }, workspaces: ['pkgs/*'] }),
      'pkgs/a/package.json': pkg({ scripts: { a: 'run a' } }),
      'other/package.json': pkg({ scripts: { z: 'nope' } }),
    };
    expect(project.detectCommands(snapshotFromTree(tree)).scripts).toEqual([
      { path: '.', name: 'ok', command: 'x' },
      { path: 'pkgs/a', name: 'a', command: 'run a' },
    ]);
  });

  it('returns an empty list when there are no manifests or an invalid one', () => {
    expect(project.detectCommands(snapshotFromTree({}))).toEqual({ packageManager: null, scripts: [] });
    expect(project.detectCommands(snapshotFromTree({ 'package.json': '{ nope' })).scripts).toEqual([]);
  });
});

describe('detectEntryPoints', () => {
  const entries = (tree: Tree) => project.detectEntryPoints(snapshotFromTree(tree));

  it('reads main, module and types with a null key and a normalized file', () => {
    expect(
      entries({
        'package.json': pkg({ name: 'p', main: './dist/index.js', module: 'dist/index.mjs', types: 'dist/i.d.ts' }),
      }),
    ).toEqual([
      { path: '.', package: 'p', field: 'main', key: null, file: 'dist/index.js' },
      { path: '.', package: 'p', field: 'module', key: null, file: 'dist/index.mjs' },
      { path: '.', package: 'p', field: 'types', key: null, file: 'dist/i.d.ts' },
    ]);
  });

  it('reads bin as a string (keyed by the unscoped package name) and as a map', () => {
    expect(entries({ 'package.json': pkg({ name: '@acme/tool', bin: './bin/tool.js' }) })).toEqual([
      { path: '.', package: '@acme/tool', field: 'bin', key: 'tool', file: 'bin/tool.js' },
    ]);
    expect(entries({ 'package.json': pkg({ name: 'p', bin: { zed: 'bin/z.js', alpha: './bin/a.js' } }) })).toEqual([
      { path: '.', package: 'p', field: 'bin', key: 'alpha', file: 'bin/a.js' },
      { path: '.', package: 'p', field: 'bin', key: 'zed', file: 'bin/z.js' },
    ]);
  });

  it('flattens exports with subpath and condition keys joined by >', () => {
    const exportsField = {
      '.': { import: './dist/index.mjs', require: { default: './dist/index.cjs' } },
      './sub': './dist/sub.js',
      './feature': ['./dist/f1.js', './dist/f2.js'],
    };
    expect(entries({ 'package.json': pkg({ name: 'p', exports: exportsField }) })).toEqual([
      // Code-unit order: '/' (0x2f) sorts before '>' (0x3e).
      { path: '.', package: 'p', field: 'exports', key: './feature', file: 'dist/f1.js' },
      { path: '.', package: 'p', field: 'exports', key: './feature', file: 'dist/f2.js' },
      { path: '.', package: 'p', field: 'exports', key: './sub', file: 'dist/sub.js' },
      { path: '.', package: 'p', field: 'exports', key: '.>import', file: 'dist/index.mjs' },
      { path: '.', package: 'p', field: 'exports', key: '.>require>default', file: 'dist/index.cjs' },
    ]);
  });

  it('uses "." as the key of a string exports field and plain condition keys otherwise', () => {
    expect(entries({ 'package.json': pkg({ name: 'p', exports: './index.js' }) })).toEqual([
      { path: '.', package: 'p', field: 'exports', key: '.', file: 'index.js' },
    ]);
    expect(entries({ 'package.json': pkg({ name: 'p', exports: { import: './a.mjs', require: './a.cjs' } }) })).toEqual(
      [
        { path: '.', package: 'p', field: 'exports', key: 'import', file: 'a.mjs' },
        { path: '.', package: 'p', field: 'exports', key: 'require', file: 'a.cjs' },
      ],
    );
  });

  it('keeps targets inside ignored directories such as dist', () => {
    const result = entries({ 'package.json': pkg({ main: 'dist/index.js' }) });
    expect(result.map((entry) => entry.file)).toEqual(['dist/index.js']);
    expect(result[0]?.package).toBeNull();
  });

  it('includes workspace manifests with their path, sorted by path, field and key', () => {
    expect(project.detectEntryPoints(snapshotFromTree(workspaceMonorepo))).toEqual([
      { path: 'apps/web', package: '@acme/web', field: 'bin', key: 'web', file: 'apps/web/bin/web.js' },
      { path: 'packages/core', package: '@acme/core', field: 'main', key: null, file: 'packages/core/dist/index.js' },
      {
        path: 'packages/core',
        package: '@acme/core',
        field: 'types',
        key: null,
        file: 'packages/core/dist/index.d.ts',
      },
    ]);
  });

  it('drops targets that escape the repository, absolute targets and non-string values', () => {
    const tree: Tree = {
      'package.json': pkg({
        main: '../outside.js',
        module: '/abs/path.js',
        types: 3,
        bin: { ok: './bin/ok.js', bad: null },
        exports: { '.': null, './x': './a/../x.js' },
      }),
    };
    expect(entries(tree).map((entry) => [entry.field, entry.key, entry.file])).toEqual([
      ['bin', 'ok', 'bin/ok.js'],
      ['exports', './x', 'x.js'],
    ]);
  });

  it('returns nothing without manifests or with an invalid one', () => {
    expect(entries({})).toEqual([]);
    expect(entries({ 'package.json': '{ nope' })).toEqual([]);
  });
});

describe('detectStack', () => {
  const stack = (tree: Tree) => project.detectStack(snapshotFromTree(tree));

  it('describes a simple TypeScript app', () => {
    expect(stack(simpleApp)).toEqual({
      languages: [{ name: 'typescript', files: 3 }],
      packageManager: null,
      node: null,
      typescript: { config: true, version: '^5.4.0' },
      frameworks: [],
      testRunners: ['vitest'],
      linters: [],
      formatters: [],
      bundlers: [],
    });
  });

  it('counts analyzed files per extractor language, sorted by name', () => {
    const result = stack({
      'a.ts': '',
      'b.mts': '',
      'c.tsx': '',
      'd.js': '',
      'e.cjs': '',
      'f.mjs': '',
      'g.jsx': '',
      'h.py': '',
      'README.md': '',
    });
    expect(result.languages).toEqual([
      { name: 'javascript', files: 3 },
      { name: 'jsx', files: 1 },
      { name: 'tsx', files: 1 },
      { name: 'typescript', files: 2 },
    ]);
  });

  it('leaves out languages without files and does not count skipped sources', () => {
    const snapshot = snapshotFromTree({ 'a.js': '', 'big.ts': '' });
    snapshot.sources.delete('big.ts');
    expect(project.detectStack(snapshot).languages).toEqual([{ name: 'javascript', files: 1 }]);
    expect(stack({ 'README.md': '' }).languages).toEqual([]);
  });

  it('reports the package manager and the node engine range', () => {
    const tree: Tree = { 'package.json': pkg({ packageManager: 'pnpm@9.1.0', engines: { node: '>=22.13' } }) };
    expect(stack(tree)).toMatchObject({ packageManager: 'pnpm', node: '>=22.13' });
    expect(stack({ 'package.json': pkg({ engines: { npm: '>=9' } }) }).node).toBeNull();
  });

  it('detects TypeScript by config presence and takes the version from any dependency map', () => {
    expect(stack({ 'tsconfig.json': '{}' }).typescript).toEqual({ config: true, version: null });
    expect(stack({ 'package.json': pkg({ dependencies: { typescript: '5.6.2' } }) }).typescript).toEqual({
      config: false,
      version: '5.6.2',
    });
    const monorepo: Tree = {
      'package.json': pkg({ workspaces: ['pkgs/*'] }),
      'pkgs/a/package.json': pkg({ name: 'a', peerDependencies: { typescript: '>=5' } }),
      'pkgs/a/tsconfig.json': '{}',
    };
    expect(stack(monorepo).typescript).toEqual({ config: true, version: '>=5' });
    expect(stack({}).typescript).toEqual({ config: false, version: null });
  });

  it('maps dependency names from the root and workspaces to sorted, deduplicated labels', () => {
    const tree: Tree = {
      'package.json': pkg({
        workspaces: ['pkgs/*'],
        dependencies: { react: '^18', express: '^4' },
        devDependencies: { vitest: '^1', eslint: '^9', prettier: '^3', vite: '^5' },
      }),
      'pkgs/a/package.json': pkg({
        name: 'a',
        dependencies: { react: '^18', '@nestjs/core': '^10' },
        devDependencies: { jest: '^29', esbuild: '^0.20', '@playwright/test': '^1' },
        peerDependencies: { next: '^14' },
      }),
    };
    expect(stack(tree)).toMatchObject({
      frameworks: ['express', 'nestjs', 'next', 'react'],
      testRunners: ['jest', 'playwright', 'vitest'],
      linters: ['eslint'],
      formatters: ['prettier'],
      bundlers: ['esbuild', 'vite'],
    });
  });

  it('adds tools that are only present as config files at the root or in a workspace', () => {
    const tree: Tree = {
      'package.json': pkg({ workspaces: ['pkgs/*'] }),
      'vitest.config.ts': '',
      'eslint.config.js': '',
      '.prettierrc.json': '',
      'pkgs/a/package.json': pkg({ name: 'a' }),
      'pkgs/a/jest.config.cjs': '',
      'pkgs/a/vite.config.mts': '',
    };
    expect(stack(tree)).toMatchObject({
      testRunners: ['jest', 'vitest'],
      linters: ['eslint'],
      formatters: ['prettier'],
      bundlers: ['vite'],
    });
  });

  it('counts a biome config as both a linter and a formatter, and .eslintrc variants', () => {
    expect(stack({ 'biome.json': '{}', '.eslintrc.cjs': '' })).toMatchObject({
      linters: ['biome', 'eslint'],
      formatters: ['biome'],
    });
    expect(stack({ 'biome.jsonc': '{}' })).toMatchObject({ linters: ['biome'], formatters: ['biome'] });
  });

  it('ignores config files outside the root and the workspaces', () => {
    const tree: Tree = { 'src/vitest.config.ts': '', 'src/eslint.config.js': '', 'tools/.prettierrc': '' };
    expect(stack(tree)).toMatchObject({ testRunners: [], linters: [], formatters: [] });
  });

  it('survives an invalid manifest', () => {
    expect(stack({ 'package.json': '{ nope', 'a.ts': '' })).toMatchObject({
      languages: [{ name: 'typescript', files: 1 }],
      node: null,
      frameworks: [],
    });
  });
});

describe('detectConventions', () => {
  const conventions = (tree: Tree) => project.detectConventions(snapshotFromTree(tree));
  const typeModule = { 'package.json': pkg({ type: 'module' }) };
  const typeCommonjs = { 'package.json': pkg({ type: 'commonjs' }) };

  it('describes a simple app', () => {
    expect(conventions(simpleApp)).toEqual({
      moduleSystem: 'esm',
      testFiles: { pattern: 'test', dirs: ['test'] },
      relativeImportExtensions: null,
      pathAliases: ['@/*'],
      tsStrict: true,
    });
  });

  it.each([
    ['type module with .ts and .js', { ...typeModule, 'a.ts': '', 'b.js': '' }, 'esm'],
    ['type commonjs with .ts and .js', { ...typeCommonjs, 'a.ts': '', 'b.js': '' }, 'commonjs'],
    ['no type field with .js only', { 'a.js': '' }, 'commonjs'],
    ['type module with .mjs only', { ...typeModule, 'a.mjs': '' }, 'esm'],
    ['no type field with .mjs only', { 'a.mjs': '', 'b.mts': '' }, 'esm'],
    ['type module with a .cjs file', { ...typeModule, 'a.js': '', 'b.cjs': '' }, 'mixed'],
    ['no type field with .mjs and .js', { 'a.mjs': '', 'b.js': '' }, 'mixed'],
    ['type module and no sources', { ...typeModule, 'README.md': '' }, 'esm'],
    ['no type field and no sources', { 'README.md': '' }, 'commonjs'],
  ])('derives moduleSystem for %s', (_label, tree, expected) => {
    expect(conventions(tree).moduleSystem).toBe(expected);
  });

  it.each([
    ['test files only', { 'src/a.test.ts': '', 'src/b.test.tsx': '' }, 'test'],
    ['spec files only', { 'src/a.spec.ts': '', 'src/b.spec.js': '' }, 'spec'],
    ['both kinds', { 'src/a.test.ts': '', 'lib/b.spec.ts': '' }, 'mixed'],
    ['neither', { 'src/a.ts': '', 'src/testing.ts': '' }, null],
  ])('derives the test file pattern for %s', (_label, tree, expected) => {
    expect(conventions(tree).testFiles.pattern).toBe(expected);
  });

  it('lists test directories: the shallowest test-like segment, else the file directory', () => {
    const tree: Tree = {
      'test/a.test.ts': '',
      'test/deep/b.test.ts': '',
      'packages/p/__tests__/c.test.ts': '',
      'src/feature/d.spec.ts': '',
      'src/feature/e.spec.ts': '',
    };
    expect(conventions(tree).testFiles).toEqual({
      pattern: 'mixed',
      dirs: ['packages/p/__tests__', 'src/feature', 'test'],
    });
  });

  it('has no test directories when there are no test files', () => {
    expect(conventions({ 'src/a.ts': '' }).testFiles).toEqual({ pattern: null, dirs: [] });
  });

  it('takes sorted path aliases from the root and workspace tsconfigs', () => {
    const tree: Tree = {
      'package.json': pkg({ workspaces: ['pkgs/*'] }),
      'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '~/*': ['src/*'], '@app/*': ['app/*'] } } }),
      'pkgs/a/package.json': pkg({ name: 'a' }),
      'pkgs/a/tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@app/*': ['x/*'], '#a': ['a.ts'] } } }),
      'other/tsconfig.json': JSON.stringify({ compilerOptions: { paths: { 'ignored/*': ['*'] } } }),
    };
    expect(conventions(tree).pathAliases).toEqual(['#a', '@app/*', '~/*']);
    expect(conventions({ 'tsconfig.json': '{}' }).pathAliases).toEqual([]);
  });

  it.each([
    ['strict true', JSON.stringify({ compilerOptions: { strict: true } }), true],
    ['strict false', JSON.stringify({ compilerOptions: { strict: false } }), false],
    ['strict unset', JSON.stringify({ compilerOptions: {} }), null],
    ['strict not a boolean', JSON.stringify({ compilerOptions: { strict: 'yes' } }), null],
  ])('reads tsStrict from the root tsconfig (%s)', (_label, tsconfig, expected) => {
    expect(conventions({ 'tsconfig.json': tsconfig }).tsStrict).toBe(expected);
  });

  it('gives tsStrict null without a usable root tsconfig and leaves relativeImportExtensions null', () => {
    const snapshot = snapshotFromTree({ 'a.ts': '' });
    snapshot.tsconfigs.set('.', null);
    expect(project.detectConventions(snapshot)).toMatchObject({ tsStrict: null, relativeImportExtensions: null });
    expect(conventions({ 'a.ts': '' }).tsStrict).toBeNull();
  });
});

describe('detectConventions: relativeImportExtensions', () => {
  const module = (language: string, ...specifiers: string[]) => ({
    language,
    imports: specifiers.map((specifier) => ({ specifier })),
  });
  const detect = (...modules: ReturnType<typeof module>[]): string | null =>
    project.detectConventions(snapshotFromTree({ 'a.ts': '' }), modules).relativeImportExtensions;
  const repeat = (specifier: string, times: number): string[] => Array.from({ length: times }, () => specifier);

  it('is null when there are no TypeScript modules or no countable relative specifiers', () => {
    expect(detect()).toBeNull();
    expect(detect(module('typescript'))).toBeNull();
    expect(detect(module('typescript', 'lodash', '@scope/pkg', '#internal', 'node:fs'))).toBeNull();
    expect(detect(module('javascript', './a.js', './b.js'), module('jsx', './c'))).toBeNull();
  });

  it('is js or none when one style has at least 80% of the countable specifiers', () => {
    expect(detect(module('typescript', ...repeat('./a.js', 4), './b'))).toBe('js');
    expect(detect(module('typescript', ...repeat('./a', 4), './b.js'))).toBe('none');
    expect(detect(module('typescript', './a.js'))).toBe('js');
    expect(detect(module('typescript', '../up/a'))).toBe('none');
  });

  it('is mixed when neither style reaches 80%', () => {
    expect(detect(module('typescript', ...repeat('./a.js', 3), ...repeat('./b', 2)))).toBe('mixed');
    expect(detect(module('typescript', './a.js', './b'))).toBe('mixed');
  });

  it('counts .js, .jsx, .mjs and .cjs as js, and tsx modules like TypeScript ones', () => {
    expect(detect(module('tsx', './a.jsx', './b.mjs'), module('typescript', './c.cjs', './d.js'))).toBe('js');
    expect(detect(module('tsx', './a'))).toBe('none');
  });

  it('skips directory specifiers and other dotted names that say nothing about the style', () => {
    expect(detect(module('typescript', './lib/', '.', '..', './data.json', './app.config', './x.css', './a.js'))).toBe(
      'js',
    );
  });
});
