import { chmod, symlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  loadRepoMapModule,
  makeTempTree,
  nonGit,
  simpleApp,
  type ScanModule,
  type Snapshot,
  type TempTree,
  type Tree,
} from '@test/helpers/repo-map.js';

let mod: ScanModule;
const temps: TempTree[] = [];

beforeAll(async () => {
  mod = await loadRepoMapModule<ScanModule>('scan.mjs');
});

afterEach(async () => {
  await Promise.all(temps.splice(0).map((temp) => temp.cleanup()));
});

/** Build a temp tree and scan it with git forced out of the picture. */
async function scanTree(
  files: Tree,
  opts: { ignore?: string[]; outRel?: string | null } = {},
): Promise<{ dir: string; snapshot: Snapshot }> {
  const temp = await makeTempTree(files);
  temps.push(temp);
  const previous = process.env['GIT_CEILING_DIRECTORIES'];
  process.env['GIT_CEILING_DIRECTORIES'] = dirname(temp.dir);
  try {
    return { dir: temp.dir, snapshot: mod.scan(temp.dir, { ignore: opts.ignore ?? [], outRel: opts.outRel ?? null }) };
  } finally {
    if (previous === undefined) delete process.env['GIT_CEILING_DIRECTORIES'];
    else process.env['GIT_CEILING_DIRECTORIES'] = previous;
  }
}

const posixOnly = process.platform === 'win32';
const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;

describe('scan (walk)', () => {
  it('lists files in code-unit order, independent of creation order', async () => {
    const forward = await scanTree({ 'a/x.ts': '', 'a-b/x.ts': '', 'B.ts': '', 'a.ts': '', 'z.ts': '' });
    const reverse = await scanTree({ 'z.ts': '', 'a.ts': '', 'B.ts': '', 'a-b/x.ts': '', 'a/x.ts': '' });
    expect(forward.snapshot.files).toEqual(['B.ts', 'a-b/x.ts', 'a.ts', 'a/x.ts', 'z.ts']);
    expect(reverse.snapshot.files).toEqual(forward.snapshot.files);
  });

  it('applies the built-in ignores to any path segment', async () => {
    const { snapshot } = await scanTree({ ...nonGit, 'src/dist/inner.ts': '', 'src/keep.ts': '' });
    expect(snapshot.files).toEqual(['src/a.ts', 'src/b.ts', 'src/keep.ts', 'src/nested/c.ts']);
  });

  it('applies --ignore globs on top of the built-ins', async () => {
    const files = { 'src/a.ts': '', 'src/generated/g.ts': '', 'lib/generated/h.ts': '', 'src/x.snap': '' };
    const plain = await scanTree(files);
    expect(plain.snapshot.files).toHaveLength(4);
    const { snapshot } = await scanTree(files, { ignore: ['**/generated/**', '*.snap'] });
    expect(snapshot.files).toEqual(['src/a.ts']);
  });

  it('excludes the --out directory but not a sibling that shares its prefix', async () => {
    const { snapshot } = await scanTree(
      { 'maps/repo-map.json': '{}', 'maps/deep/x.ts': '', 'maps-extra/a.ts': '', 'src/a.ts': '' },
      { outRel: 'maps' },
    );
    expect(snapshot.files).toEqual(['maps-extra/a.ts', 'src/a.ts']);
  });

  it('never scans the installed script under .shitaku', async () => {
    const { snapshot } = await scanTree({
      '.shitaku/scripts/repo-map/index.mjs': 'export {};\n',
      'src/a.ts': 'export const a = 1;\n',
    });
    expect(snapshot.files).toEqual(['src/a.ts']);
    expect([...snapshot.sources.keys()]).toEqual(['src/a.ts']);
  });

  it('skips a source over 1 MiB as too-large and keeps it out of sources', async () => {
    const { snapshot } = await scanTree({
      'big.ts': 'x'.repeat(1_048_577),
      'edge.ts': 'y'.repeat(1_048_576),
      'small.ts': 'z',
    });
    expect(snapshot.skipped).toEqual([{ path: 'big.ts', reason: 'too-large' }]);
    expect(snapshot.files).toEqual(['big.ts', 'edge.ts', 'small.ts']);
    expect([...snapshot.sources.keys()]).toEqual(['edge.ts', 'small.ts']);
  });

  it.skipIf(posixOnly)('records file and directory symlinks as skipped and does not follow them', async () => {
    const temp = await makeTempTree({ 'real/inner.ts': 'export const i = 1;\n', 'target.ts': 'export {};\n' });
    temps.push(temp);
    await symlink(join(temp.dir, 'target.ts'), join(temp.dir, 'link.ts'));
    await symlink(join(temp.dir, 'real'), join(temp.dir, 'linked'));
    const snapshot = mod.scan(temp.dir, { ignore: [], outRel: null });
    expect(snapshot.files).toEqual(['real/inner.ts', 'target.ts']);
    expect(snapshot.skipped).toEqual([
      { path: 'link.ts', reason: 'symlink' },
      { path: 'linked', reason: 'symlink' },
    ]);
  });

  it.skipIf(posixOnly || isRoot)('records an unreadable source as skipped', async () => {
    const temp = await makeTempTree({ 'locked.ts': 'export const l = 1;\n', 'open.ts': 'export const o = 1;\n' });
    temps.push(temp);
    await chmod(join(temp.dir, 'locked.ts'), 0o000);
    const snapshot = mod.scan(temp.dir, { ignore: [], outRel: null });
    expect(snapshot.skipped).toEqual([{ path: 'locked.ts', reason: 'unreadable' }]);
    expect([...snapshot.sources.keys()]).toEqual(['open.ts']);
  });

  it('reads manifests per directory and records an invalid package.json as skipped', async () => {
    const { snapshot } = await scanTree({
      'package.json': '{"name":"root","version":"1.0.0"}',
      'packages/a/package.json': '{"name":"a"}',
      'packages/bad/package.json': '{ not json',
      'packages/list/package.json': '[]',
    });
    expect([...snapshot.manifests.keys()]).toEqual(['.', 'packages/a', 'packages/bad', 'packages/list']);
    expect(snapshot.manifests.get('.')).toEqual({ name: 'root', version: '1.0.0' });
    expect(snapshot.manifests.get('packages/a')).toEqual({ name: 'a' });
    expect(snapshot.manifests.get('packages/bad')).toEqual({ invalid: true });
    expect(snapshot.manifests.get('packages/list')).toEqual({ invalid: true });
    expect(snapshot.skipped).toEqual([
      { path: 'packages/bad/package.json', reason: 'invalid-json' },
      { path: 'packages/list/package.json', reason: 'invalid-json' },
    ]);
  });

  it('parses tsconfig.json as JSONC and gives null when it is invalid', async () => {
    const { snapshot } = await scanTree({
      'tsconfig.json': '{\n  // comment\n  "compilerOptions": { "strict": true, },\n}\n',
      'packages/a/tsconfig.json': '{ nope',
    });
    expect(snapshot.tsconfigs.get('.')).toEqual({ compilerOptions: { strict: true } });
    expect(snapshot.tsconfigs.get('packages/a')).toBeNull();
    expect(snapshot.skipped).toEqual([]);
  });

  it('also reads the relative config a tsconfig extends, keyed by file path, one level deep', async () => {
    const { snapshot } = await scanTree({
      'tsconfig.json': '{ "extends": "./tsconfig.base.json" }',
      'tsconfig.base.json':
        '{\n  // shared\n  "compilerOptions": { "baseUrl": ".", },\n  "extends": "./deeper.json"\n}\n',
      'deeper.json': '{ "compilerOptions": { "strict": true } }',
      'packages/a/tsconfig.json': '{ "extends": "../../tsconfig.base" }',
      'packages/b/tsconfig.json': '{ "extends": "@tsconfig/node20/tsconfig.json" }',
      'packages/c/tsconfig.json': '{ "extends": "./missing.json" }',
    });
    expect([...snapshot.tsconfigs.keys()].sort()).toEqual([
      '.',
      'packages/a',
      'packages/b',
      'packages/c',
      'tsconfig.base.json',
    ]);
    expect(snapshot.tsconfigs.get('tsconfig.base.json')).toEqual({
      compilerOptions: { baseUrl: '.' },
      extends: './deeper.json',
    });
    expect(snapshot.skipped).toEqual([]);
  });

  it('returns the documented snapshot shape for a simple app', async () => {
    const { snapshot } = await scanTree({ ...simpleApp, 'pnpm-workspace.yaml': "packages:\n  - 'packages/*'\n" });
    expect(Object.keys(snapshot).sort()).toEqual([
      'commit',
      'files',
      'manifests',
      'skipped',
      'sources',
      'textFiles',
      'tsconfigs',
    ]);
    expect(snapshot.commit).toBeNull();
    expect(snapshot.files).toEqual([
      'README.md',
      'package.json',
      'pnpm-workspace.yaml',
      'src/index.ts',
      'src/util.ts',
      'test/util.test.ts',
      'tsconfig.json',
    ]);
    expect([...snapshot.sources.keys()]).toEqual(['src/index.ts', 'src/util.ts', 'test/util.test.ts']);
    expect(snapshot.sources.get('src/util.ts')).toBe(simpleApp['src/util.ts']);
    expect(snapshot.textFiles.get('pnpm-workspace.yaml')).toBe("packages:\n  - 'packages/*'\n");
    expect(snapshot.skipped).toEqual([]);
  });

  it('exposes the 1 MiB guard', () => {
    expect(mod.MAX_FILE_BYTES).toBe(1_048_576);
  });
});
