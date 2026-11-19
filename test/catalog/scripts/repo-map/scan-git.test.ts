import { chmod, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  git,
  hasGit,
  initGitRepo,
  loadRepoMapModule,
  makeTempTree,
  nonGit,
  simpleApp,
  writeTree,
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

const posixOnly = process.platform === 'win32';

async function tempTree(files: Tree = {}): Promise<string> {
  const temp = await makeTempTree(files);
  temps.push(temp);
  return temp.dir;
}

/** Run `fn` with temporary environment overrides (`undefined` deletes a variable). */
function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => T): T {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function scanDir(dir: string, ignore: string[] = [], env: Record<string, string | undefined> = {}): Snapshot {
  return withEnv(env, () => mod.scan(dir, { ignore, outRel: null }));
}

/** Stop git from discovering a repository above `dir`. */
const ceiling = (dir: string): Record<string, string> => ({ GIT_CEILING_DIRECTORIES: dirname(dir) });

const BASE: Tree = { 'a.ts': 'export const a = 1;\n', 'docs/readme.md': '# docs\n' };

describe.skipIf(!hasGit)('scan (git listing)', () => {
  it('lists tracked and untracked files but not gitignored ones, and reports HEAD', async () => {
    const dir = await tempTree({ ...BASE, '.gitignore': 'ignored.ts\n', 'ignored.ts': 'export {};\n' });
    initGitRepo(dir, { commit: true });
    await writeTree(dir, { 'untracked.ts': 'export const u = 1;\n' });
    const snapshot = scanDir(dir);
    expect(snapshot.files).toEqual(['.gitignore', 'a.ts', 'docs/readme.md', 'untracked.ts']);
    expect(snapshot.commit).toBe(git(dir, ['rev-parse', 'HEAD']));
    expect(snapshot.commit).toMatch(/^[0-9a-f]{40,64}$/);
  });

  it('gives the same commit for the same tree in two repositories (fixed identity and dates)', async () => {
    const first = await tempTree(BASE);
    const second = await tempTree(BASE);
    initGitRepo(first, { commit: true });
    initGitRepo(second, { commit: true });
    expect(scanDir(first).commit).toBe(scanDir(second).commit);
  });

  it('applies the built-in and user ignores to git listings too', async () => {
    const dir = await tempTree({ ...BASE, 'dist/out.js': 'export {};\n', 'src/generated/g.ts': 'export {};\n' });
    initGitRepo(dir, { commit: true });
    expect(scanDir(dir, ['**/generated/**']).files).toEqual(['a.ts', 'docs/readme.md']);
  });

  it('lists the same files as the walk on a tree without .gitignore', async () => {
    const gitDir = await tempTree(nonGit);
    const walkDir = await tempTree(nonGit);
    initGitRepo(gitDir, { commit: true });
    const viaGit = scanDir(gitDir);
    const viaWalk = scanDir(walkDir, [], ceiling(walkDir));
    expect(viaGit.commit).not.toBeNull();
    expect(viaWalk.commit).toBeNull();
    expect(viaGit.files).toEqual(viaWalk.files);
    expect(viaGit.files).toEqual(['src/a.ts', 'src/b.ts', 'src/nested/c.ts']);
  });

  it('reads sources, manifests and tsconfigs from git listings', async () => {
    const dir = await tempTree(simpleApp);
    initGitRepo(dir, { commit: true });
    const snapshot = scanDir(dir);
    expect([...snapshot.sources.keys()]).toEqual(['src/index.ts', 'src/util.ts', 'test/util.test.ts']);
    expect(snapshot.manifests.get('.')).toMatchObject({ name: 'simple-app' });
    expect(snapshot.tsconfigs.get('.')).toMatchObject({ compilerOptions: { strict: true } });
  });

  describe('repository selection', () => {
    it('run from a subdirectory lists only that subtree with relative paths', async () => {
      const dir = await tempTree({ 'root.ts': '', 'sub/b.ts': '', 'sub/deep/c.ts': '' });
      initGitRepo(dir, { commit: true });
      const snapshot = scanDir(join(dir, 'sub'));
      expect(snapshot.files).toEqual(['b.ts', 'deep/c.ts']);
      expect(snapshot.commit).toBe(git(dir, ['rev-parse', 'HEAD']));
    });

    it('uses the walk in a directory that is not a git repository', async () => {
      const dir = await tempTree({ ...BASE, '.gitignore': 'ignored.ts\n', 'ignored.ts': 'export {};\n' });
      const snapshot = scanDir(dir, [], ceiling(dir));
      expect(snapshot.commit).toBeNull();
      // The walk does not read .gitignore, which proves git was not used.
      expect(snapshot.files).toEqual(['.gitignore', 'a.ts', 'docs/readme.md', 'ignored.ts']);
    });

    it('uses the walk with commit null, and does not throw, when git is missing from PATH', async () => {
      const dir = await tempTree({ ...BASE, '.gitignore': 'ignored.ts\n', 'ignored.ts': 'export {};\n' });
      initGitRepo(dir, { commit: true });
      const snapshot = scanDir(dir, [], { PATH: join(dir, 'no-such-bin') });
      expect(snapshot.commit).toBeNull();
      expect(snapshot.files).toEqual(['.gitignore', 'a.ts', 'docs/readme.md', 'ignored.ts']);
    });

    describe.skipIf(posixOnly)('with a recording git', () => {
      /** A fake `git` first on PATH that logs its cwd and argv, then prints canned output. */
      async function fakeGit(listing: string): Promise<{ bin: string; log: string; work: string }> {
        const work = await tempTree({
          'src/a.ts': 'export const a = 1;\n',
          'src/b.ts': 'export const b = 1;\n',
        });
        const bin = await tempTree();
        const log = join(bin, 'calls.log');
        const script = [
          '#!/bin/sh',
          `printf 'cwd=%s argv=%s\\n' "$PWD" "$*" >> '${log}'`,
          'case "$1" in',
          `  ls-files) printf '${listing}' ;;`,
          "  rev-parse) echo '0123456789abcdef0123456789abcdef01234567' ;;",
          'esac',
          '',
        ].join('\n');
        await writeFile(join(bin, 'git'), script);
        await chmod(join(bin, 'git'), 0o755);
        return { bin, log, work };
      }

      it('spawns git with a fixed argv, the real path as cwd and never forwards ignore values', async () => {
        const { bin, log, work } = await fakeGit('src/a.ts\\0src/b.ts\\0');
        const sentinel = join(work, 'pwned');
        const ignore = [`;touch ${sentinel}`, '$(touch pwned)', '`touch pwned`', '--exec=evil'];
        const snapshot = scanDir(work, ignore, { PATH: `${bin}:${process.env['PATH'] ?? ''}` });
        expect(snapshot.files).toEqual(['src/a.ts', 'src/b.ts']);
        expect(snapshot.commit).toBe('0123456789abcdef0123456789abcdef01234567');
        expect((await readFile(log, 'utf8')).trimEnd().split('\n')).toEqual([
          `cwd=${work} argv=ls-files -z --cached --others --exclude-standard`,
          `cwd=${work} argv=rev-parse HEAD`,
        ]);
        await expect(readFile(sentinel)).rejects.toMatchObject({ code: 'ENOENT' });
        await expect(readFile(join(work, 'pwned'))).rejects.toMatchObject({ code: 'ENOENT' });
      });

      it('drops any path git returns that contains a .. segment', async () => {
        const { bin, work } = await fakeGit('src/a.ts\\0../escape.ts\\0src/../../x.ts\\0src/b.ts\\0');
        const snapshot = scanDir(work, [], { PATH: `${bin}:${process.env['PATH'] ?? ''}` });
        expect(snapshot.files).toEqual(['src/a.ts', 'src/b.ts']);
      });
    });
  });

  describe('commit state', () => {
    it('gives commit null for an empty repository and still lists the files', async () => {
      const dir = await tempTree(BASE);
      initGitRepo(dir);
      const snapshot = scanDir(dir);
      expect(snapshot.commit).toBeNull();
      expect(snapshot.files).toEqual(['a.ts', 'docs/readme.md']);
    });

    it('includes an untracked new file', async () => {
      const dir = await tempTree(BASE);
      initGitRepo(dir, { commit: true });
      await writeTree(dir, { 'new.ts': 'export {};\n' });
      expect(scanDir(dir).files).toEqual(['a.ts', 'docs/readme.md', 'new.ts']);
    });

    it('excludes a tracked file deleted from the work tree', async () => {
      const dir = await tempTree(BASE);
      initGitRepo(dir, { commit: true });
      await rm(join(dir, 'a.ts'));
      expect(scanDir(dir).files).toEqual(['docs/readme.md']);
    });

    it('excludes a submodule gitlink', async () => {
      const dir = await tempTree(BASE);
      initGitRepo(dir, { commit: true });
      git(dir, ['update-index', '--add', '--cacheinfo', `160000,${git(dir, ['rev-parse', 'HEAD'])},vendor/lib`]);
      await mkdir(join(dir, 'vendor', 'lib'), { recursive: true });
      expect(git(dir, ['ls-files', '--cached'])).toContain('vendor/lib');
      expect(scanDir(dir).files).toEqual(['a.ts', 'docs/readme.md']);
    });

    it.skipIf(posixOnly)('records a tracked symlink as skipped instead of listing it', async () => {
      const dir = await tempTree(BASE);
      await symlink('a.ts', join(dir, 'link.ts'));
      initGitRepo(dir, { commit: true });
      const snapshot = scanDir(dir);
      expect(snapshot.files).toEqual(['a.ts', 'docs/readme.md']);
      expect(snapshot.skipped).toEqual([{ path: 'link.ts', reason: 'symlink' }]);
    });

    it.each(['staged only', 'after commit -a', 'an emptied index'])(
      'lists the same files when the repository is %s',
      async (state) => {
        const dir = await tempTree(BASE);
        initGitRepo(dir);
        git(dir, ['add', '-A']);
        if (state !== 'staged only') git(dir, ['commit', '-q', '-m', 'one']);
        if (state === 'after commit -a') {
          await writeFile(join(dir, 'a.ts'), 'export const a = 2;\n');
          git(dir, ['commit', '-q', '-a', '-m', 'two']);
        }
        if (state === 'an emptied index') git(dir, ['rm', '-r', '--cached', '-q', '.']);
        const snapshot = scanDir(dir);
        expect(snapshot.files).toEqual(['a.ts', 'docs/readme.md']);
        expect(snapshot.commit === null).toBe(state === 'staged only');
      },
    );

    it('leaves HEAD, the index and the work tree status byte-identical', async () => {
      const dir = await tempTree({ ...BASE, 'staged.ts': 'export {};\n' });
      initGitRepo(dir, { commit: true });
      await writeTree(dir, { 'untracked.ts': 'export {};\n', 'a.ts': 'export const a = 9;\n' });
      git(dir, ['add', 'staged.ts']);
      git(dir, ['status', '--porcelain=v1']); // settle any index refresh before measuring
      const measure = async () => ({
        index: await readFile(join(dir, '.git', 'index')),
        head: git(dir, ['rev-parse', 'HEAD']),
        status: git(dir, ['status', '--porcelain=v1']),
      });
      const readIndex = () => readFile(join(dir, '.git', 'index'));
      const before = await readIndex();
      const beforeState = await measure();
      scanDir(dir);
      const after = await readIndex();
      const afterState = await measure();
      expect(after.equals(before)).toBe(true);
      expect(afterState.index.equals(beforeState.index)).toBe(true);
      expect(afterState.head).toBe(beforeState.head);
      expect(afterState.status).toBe(beforeState.status);
      expect(afterState.status).toContain('untracked.ts');
    });
  });
});

describe.skipIf(hasGit)('scan (git listing) without git installed', () => {
  it('falls back to the walk', async () => {
    const dir = await tempTree(BASE);
    expect(scanDir(dir).commit).toBeNull();
  });
});
