import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadRepoMapModule, SCRIPT_DIR, type Resolution, type ResolveModule } from '@test/helpers/repo-map.js';

let createResolver: ResolveModule['createResolver'];

beforeAll(async () => {
  createResolver = (await loadRepoMapModule<ResolveModule>('resolve.mjs')).createResolver;
});

const internal = (resolved: string): Resolution => ({ resolved, status: 'internal' });
const unresolved: Resolution = { resolved: null, status: 'unresolved' };

/** Resolve one specifier against an in-memory listing. */
const resolveIn = (files: string[], importer: string, specifier: string): Resolution =>
  createResolver({ files })(importer, specifier);

describe('createResolver: relative specifiers', () => {
  it('resolves a relative specifier to an extension-probed file', () => {
    const files = ['src/a.ts', 'src/util.ts'];
    expect(resolveIn(files, 'src/a.ts', './util')).toEqual(internal('src/util.ts'));
    expect(resolveIn(['a.ts', 'util.ts'], 'a.ts', './util')).toEqual(internal('util.ts'));
  });

  it('walks up through .. segments', () => {
    const files = ['src/a/b.ts', 'src/shared/x.ts'];
    expect(resolveIn(files, 'src/a/b.ts', '../shared/x')).toEqual(internal('src/shared/x.ts'));
  });

  it.each([
    ['.js', '.ts'],
    ['.jsx', '.tsx'],
    ['.mjs', '.mts'],
    ['.cjs', '.cts'],
  ])('maps %s to its TypeScript counterpart %s', (js, ts) => {
    expect(resolveIn([`src/a.ts`, `src/helper${ts}`], 'src/a.ts', `./helper${js}`)).toEqual(
      internal(`src/helper${ts}`),
    );
  });

  it('prefers the exact path over the TypeScript counterpart', () => {
    expect(resolveIn(['src/a.ts', 'src/helper.js', 'src/helper.ts'], 'src/a.ts', './helper.js')).toEqual(
      internal('src/helper.js'),
    );
  });

  it.each([
    ['.ts', '.tsx'],
    ['.tsx', '.mts'],
    ['.mts', '.cts'],
    ['.cts', '.js'],
    ['.js', '.jsx'],
    ['.jsx', '.mjs'],
    ['.mjs', '.cjs'],
  ])('probes %s before %s', (first, second) => {
    expect(resolveIn(['a.ts', `x${second}`, `x${first}`], 'a.ts', './x')).toEqual(internal(`x${first}`));
  });

  it('falls back to index files, after the file extensions', () => {
    expect(resolveIn(['a.ts', 'lib/index.ts'], 'a.ts', './lib')).toEqual(internal('lib/index.ts'));
    expect(resolveIn(['a.ts', 'lib/index.ts'], 'a.ts', './lib/')).toEqual(internal('lib/index.ts'));
    expect(resolveIn(['a.ts', 'lib.ts', 'lib/index.ts'], 'a.ts', './lib')).toEqual(internal('lib.ts'));
    expect(resolveIn(['lib/index.js', 'lib/index.ts', 'a.ts'], 'a.ts', './lib')).toEqual(internal('lib/index.ts'));
  });

  it('resolves . and .. as directories', () => {
    const files = ['src/index.ts', 'src/a/b.ts', 'src/a/index.ts'];
    expect(resolveIn(files, 'src/a/b.ts', '.')).toEqual(internal('src/a/index.ts'));
    expect(resolveIn(files, 'src/a/b.ts', '..')).toEqual(internal('src/index.ts'));
  });

  it('resolves non-source targets that are in the listing', () => {
    const files = ['src/a.ts', 'src/data.json', 'src/x.css'];
    expect(resolveIn(files, 'src/a.ts', './data.json')).toEqual(internal('src/data.json'));
    expect(resolveIn(files, 'src/a.ts', './x.css')).toEqual(internal('src/x.css'));
  });

  it('gives unresolved when nothing matches, including paths that leave the root', () => {
    const files = ['src/a.ts'];
    expect(resolveIn(files, 'src/a.ts', './missing')).toEqual(unresolved);
    expect(resolveIn(files, 'src/a.ts', '../../outside')).toEqual(unresolved);
  });

  it('matches case-sensitively', () => {
    expect(resolveIn(['src/a.ts', 'src/foo.ts'], 'src/a.ts', './Foo')).toEqual(unresolved);
    expect(resolveIn(['src/a.ts', 'src/Foo.ts'], 'src/a.ts', './Foo')).toEqual(internal('src/Foo.ts'));
  });

  it('is pure: the module never touches the filesystem, child processes or process state', () => {
    const source = readFileSync(join(SCRIPT_DIR, 'resolve.mjs'), 'utf8');
    expect(source.length).toBeGreaterThan(500);
    expect(source).not.toMatch(/node:(fs|child_process|path|os)|from 'fs'|process\./);
  });
});

type Configs = Record<string, unknown>;

/** A resolver over `files` with tsconfigs keyed by directory (or by file path for extended files). */
const withConfigs = (
  files: string[],
  configs: Configs,
  workspaces: { name: string | null; path: string }[] = [],
): ReturnType<ResolveModule['createResolver']> =>
  createResolver({ files, tsconfigs: new Map(Object.entries(configs)), workspaces });

const aliasConfig = (paths: Record<string, string[]>, baseUrl?: string): unknown => ({
  compilerOptions: { ...(baseUrl === undefined ? {} : { baseUrl }), paths },
});

describe('createResolver: tsconfig paths', () => {
  it('resolves a wildcard alias relative to the tsconfig directory', () => {
    const resolve = withConfigs(['src/a.ts', 'src/foo.ts'], { '.': aliasConfig({ '@/*': ['./src/*'] }) });
    expect(resolve('src/a.ts', '@/foo')).toEqual(internal('src/foo.ts'));
  });

  it('resolves an exact alias, an alias with a suffix and a directory through its index', () => {
    const resolve = withConfigs(['a.ts', 'src/config/index.ts', 'assets/logo.svg', 'src/lib/index.ts'], {
      '.': aliasConfig({ '~config': ['src/config/index.ts'], '*.svg': ['assets/*.svg'], '@lib': ['./src/lib'] }),
    });
    expect(resolve('a.ts', '~config')).toEqual(internal('src/config/index.ts'));
    expect(resolve('a.ts', 'logo.svg')).toEqual(internal('assets/logo.svg'));
    expect(resolve('a.ts', '@lib')).toEqual(internal('src/lib/index.ts'));
  });

  it('prefers the pattern with the longest prefix, and an exact pattern over a wildcard', () => {
    const files = [
      'a.ts',
      'src/ui/button.ts',
      'src/components/ui/button.ts',
      'src/any.ts',
      'src/exact.ts',
      'other/exact.ts',
    ];
    const resolve = withConfigs(files, {
      '.': aliasConfig({
        '*': ['./src/*'],
        '@/*': ['./src/*'],
        '@/ui/*': ['./src/components/ui/*'],
        '@/exact': ['./other/exact.ts'],
      }),
    });
    expect(resolve('a.ts', '@/ui/button')).toEqual(internal('src/components/ui/button.ts'));
    expect(resolve('a.ts', '@/exact')).toEqual(internal('other/exact.ts'));
    expect(resolve('a.ts', 'any')).toEqual(internal('src/any.ts'));
  });

  it('takes the first candidate that exists', () => {
    const resolve = withConfigs(['a.ts', 'lib/z.ts'], { '.': aliasConfig({ '@/*': ['./src/*', './lib/*'] }) });
    expect(resolve('a.ts', '@/z')).toEqual(internal('lib/z.ts'));
  });

  it('gives unresolved when a pattern matches but no candidate exists', () => {
    const resolve = withConfigs(['a.ts', 'src/foo.ts'], { '.': aliasConfig({ '@/*': ['./src/*'] }) });
    expect(resolve('a.ts', '@/missing')).toEqual(unresolved);
  });

  it('resolves paths relative to baseUrl, which is relative to its own tsconfig', () => {
    const files = ['packages/web/a.ts', 'packages/web/src/app/x.ts', 'packages/web/src/utils/y.ts'];
    const resolve = withConfigs(files, { 'packages/web': aliasConfig({ '@/*': ['app/*'] }, 'src') }, [
      { name: 'web', path: 'packages/web' },
    ]);
    expect(resolve('packages/web/a.ts', '@/x')).toEqual(internal('packages/web/src/app/x.ts'));
    // baseUrl alone also resolves non-relative specifiers.
    expect(resolve('packages/web/a.ts', 'utils/y')).toEqual(internal('packages/web/src/utils/y.ts'));
  });

  it('uses the importer workspace tsconfig, and the root one when the workspace has none', () => {
    const files = ['a.ts', 'src/r.ts', 'packages/web/a.ts', 'packages/web/w/x.ts', 'packages/api/a.ts'];
    const resolve = withConfigs(
      files,
      { '.': aliasConfig({ '@/*': ['./src/*'] }), 'packages/web': aliasConfig({ '@/*': ['./w/*'] }) },
      [
        { name: 'web', path: 'packages/web' },
        { name: 'api', path: 'packages/api' },
      ],
    );
    expect(resolve('packages/web/a.ts', '@/x')).toEqual(internal('packages/web/w/x.ts'));
    expect(resolve('packages/api/a.ts', '@/r')).toEqual(internal('src/r.ts'));
    expect(resolve('a.ts', '@/r')).toEqual(internal('src/r.ts'));
    // The root alias is not consulted for an importer whose workspace has its own tsconfig.
    expect(resolve('packages/web/a.ts', '@/r').resolved).toBeNull();
  });

  it('ignores an invalid tsconfig and a tsconfig without paths', () => {
    const files = ['a.ts', 'src/foo.ts'];
    expect(withConfigs(files, { '.': null })('a.ts', '@/foo').resolved).toBeNull();
    expect(withConfigs(files, { '.': { compilerOptions: { strict: true } } })('a.ts', '@/foo').resolved).toBeNull();
    expect(withConfigs(files, {})('a.ts', '@/foo').resolved).toBeNull();
  });

  describe('extends', () => {
    const files = ['a.ts', 'src/x.ts', 'packages/web/a.ts', 'packages/web/src/x.ts'];
    const base = { compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } };

    it('follows a relative extends one level, with paths relative to the declaring config', () => {
      const resolve = withConfigs(files, {
        '.': { extends: './tsconfig.base.json' },
        'tsconfig.base.json': base,
      });
      expect(resolve('a.ts', '@/x')).toEqual(internal('src/x.ts'));
    });

    it('resolves an inherited baseUrl against the extended config, not the extending one', () => {
      const resolve = withConfigs(
        files,
        { 'packages/web': { extends: '../../tsconfig.base.json' }, 'tsconfig.base.json': base },
        [{ name: 'web', path: 'packages/web' }],
      );
      expect(resolve('packages/web/a.ts', '@/x')).toEqual(internal('src/x.ts'));
    });

    it('accepts an extends path without the .json extension and an extended tsconfig.json', () => {
      expect(
        withConfigs(files, { '.': { extends: './tsconfig.base' }, 'tsconfig.base.json': base })('a.ts', '@/x'),
      ).toEqual(internal('src/x.ts'));
      expect(
        withConfigs(files, { 'packages/web': { extends: '../../tsconfig.json' }, '.': base }, [
          { name: 'web', path: 'packages/web' },
        ])('packages/web/a.ts', '@/x'),
      ).toEqual(internal('src/x.ts'));
    });

    it('lets own paths replace inherited paths', () => {
      const resolve = withConfigs(files, {
        '.': { extends: './tsconfig.base.json', compilerOptions: { paths: { '#/*': ['./src/*'] } } },
        'tsconfig.base.json': base,
      });
      expect(resolve('a.ts', '#/x')).toEqual(internal('src/x.ts'));
      expect(resolve('a.ts', '@/x').resolved).toBeNull();
    });

    it('does not follow a package extends or a second level', () => {
      const packageExtends = withConfigs(files, {
        '.': { extends: '@tsconfig/node20/tsconfig.json' },
        '@tsconfig/node20/tsconfig.json': base,
      });
      expect(packageExtends('a.ts', '@/x').resolved).toBeNull();
      const twoLevels = withConfigs(files, {
        '.': { extends: './one.json' },
        'one.json': { extends: './two.json' },
        'two.json': base,
      });
      expect(twoLevels('a.ts', '@/x').resolved).toBeNull();
    });
  });
});

const external: Resolution = { resolved: null, status: 'external' };
const CORE = { name: '@acme/core', path: 'packages/core' };

/** A resolver with one workspace package whose manifest is `manifest`. */
const withWorkspace = (files: string[], manifest: unknown): ReturnType<ResolveModule['createResolver']> =>
  createResolver({
    files: ['apps/web/a.ts', ...files],
    workspaces: [CORE, { name: 'web', path: 'apps/web' }, { name: null, path: 'apps/anonymous' }],
    manifests: new Map([['packages/core', manifest]]),
  });

describe('createResolver: workspace packages', () => {
  it('probes a subpath under the workspace directory', () => {
    const resolve = withWorkspace(['packages/core/utils.ts', 'packages/core/lib/index.ts'], {});
    expect(resolve('apps/web/a.ts', '@acme/core/utils')).toEqual(internal('packages/core/utils.ts'));
    expect(resolve('apps/web/a.ts', '@acme/core/lib')).toEqual(internal('packages/core/lib/index.ts'));
    expect(resolve('apps/web/a.ts', '@acme/core/missing')).toEqual(unresolved);
  });

  it('resolves an unscoped workspace name and the package importing itself', () => {
    const resolve = createResolver({
      files: ['apps/web/index.ts', 'apps/web/util.ts'],
      workspaces: [{ name: 'web', path: 'apps/web' }],
    });
    expect(resolve('apps/web/util.ts', 'web')).toEqual(internal('apps/web/index.ts'));
    expect(resolve('apps/web/util.ts', 'web/util')).toEqual(internal('apps/web/util.ts'));
  });

  it.each([
    ['an exports string', { exports: './lib/entry.js' }, ['lib/entry.ts'], 'lib/entry.ts'],
    ['the exports dot entry', { exports: { '.': './src/main.ts' } }, ['src/main.ts'], 'src/main.ts'],
    [
      'the import condition',
      { exports: { '.': { import: './esm.js', default: './cjs.js' } } },
      ['esm.js', 'cjs.js'],
      'esm.js',
    ],
    ['the default condition', { exports: { '.': { import: './esm.js', default: './cjs.js' } } }, ['cjs.js'], 'cjs.js'],
    ['bare conditions', { exports: { import: './i.js', default: './d.js' } }, ['i.js', 'd.js'], 'i.js'],
    ['module over main', { module: './m.js', main: './c.js' }, ['m.js', 'c.js'], 'm.js'],
    ['exports over module', { exports: './e.js', module: './m.js', main: './c.js' }, ['e.js', 'm.js', 'c.js'], 'e.js'],
    ['main', { main: './c.js' }, ['c.js'], 'c.js'],
    ['main without an extension', { main: 'lib/index' }, ['lib/index.ts'], 'lib/index.ts'],
    ['src/index when main points into an ignored dist', { main: 'dist/index.js' }, ['src/index.ts'], 'src/index.ts'],
    ['src/index over index', {}, ['src/index.ts', 'index.ts'], 'src/index.ts'],
    ['index at the package root', {}, ['index.js'], 'index.js'],
  ])('resolves the bare name through %s', (_label, manifest, inside, expected) => {
    const resolve = withWorkspace(
      inside.map((file) => `packages/core/${file}`),
      manifest,
    );
    expect(resolve('apps/web/a.ts', '@acme/core')).toEqual(internal(`packages/core/${expected}`));
  });

  it('gives unresolved when a workspace package has no entry in the listing', () => {
    const resolve = withWorkspace(['packages/core/README.md'], {
      main: 'dist/index.js',
      exports: { './sub': './x.js' },
    });
    expect(resolve('apps/web/a.ts', '@acme/core')).toEqual(unresolved);
  });

  it('matches whole package names only', () => {
    const resolve = withWorkspace(['packages/core/index.ts'], {});
    expect(resolve('apps/web/a.ts', '@acme/core-utils')).toEqual(external);
    expect(resolve('apps/web/a.ts', '@acme')).toEqual(external);
    expect(resolve('apps/web/a.ts', 'core')).toEqual(external);
  });

  it('lets a tsconfig alias win over a workspace name', () => {
    const resolve = createResolver({
      files: ['a.ts', 'overrides/core.ts', 'packages/core/index.ts'],
      tsconfigs: new Map([['.', aliasConfig({ '@acme/core': ['./overrides/core.ts'] })]]),
      workspaces: [CORE],
    });
    expect(resolve('a.ts', '@acme/core')).toEqual(internal('overrides/core.ts'));
  });

  it('falls back from a baseUrl miss to workspaces and externals', () => {
    const resolve = createResolver({
      files: ['a.ts', 'src/own.ts', 'packages/core/index.ts'],
      tsconfigs: new Map([['.', aliasConfig({}, 'src')]]),
      workspaces: [CORE],
    });
    expect(resolve('a.ts', 'own')).toEqual(internal('src/own.ts'));
    expect(resolve('a.ts', '@acme/core')).toEqual(internal('packages/core/index.ts'));
    expect(resolve('a.ts', 'lodash')).toEqual(external);
  });
});

describe('createResolver: externals and unresolved', () => {
  let resolve: ReturnType<ResolveModule['createResolver']>;

  beforeAll(() => {
    resolve = createResolver({ files: ['a.ts'] });
  });

  it.each(['lodash', 'lodash/fp', '@scope/pkg', '@scope/pkg/deep/path', 'fs', 'node:fs', 'node:fs/promises'])(
    'marks %s as external with no resolved path',
    (specifier) => {
      expect(resolve('a.ts', specifier)).toEqual(external);
    },
  );

  it.each([
    ['a subpath import', '#internal/thing'],
    ['an absolute path', '/etc/passwd'],
    ['a protocol-relative URL', '//cdn.example.com/x.js'],
    ['an https URL', 'https://example.com/a.js'],
    ['a file URL', 'file:///tmp/a.js'],
    ['a data URL', 'data:text/javascript,export{}'],
    ['a Windows drive path', 'C:\\temp\\a.js'],
    ['a dot-prefixed name that is not relative', '.hidden/x'],
    ['an empty specifier', ''],
  ])('marks %s as unresolved', (_label, specifier) => {
    expect(resolve('a.ts', specifier)).toEqual(unresolved);
  });
});
