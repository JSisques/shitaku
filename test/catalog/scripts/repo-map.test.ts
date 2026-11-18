import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  aliases,
  copyScript,
  hasGit,
  initGitRepo,
  makeTempTree,
  nonGit,
  runRepoMap,
  simpleApp,
  trickySyntax,
  workspaceMonorepo,
  type RepoMapDocument,
  type RunResult,
  type TempTree,
  type Tree,
} from '@test/helpers/repo-map.js';

const temps: TempTree[] = [];
let script: TempTree;

beforeAll(async () => {
  script = await copyScript();
  temps.push(script);
});

afterEach(async () => {
  // Keep the shared script copy; remove every project directory created by a test.
  const projects = temps.splice(0).filter((temp) => temp !== script);
  temps.push(script);
  await Promise.all(projects.map((temp) => temp.cleanup()));
});

async function project(files: Tree): Promise<string> {
  const temp = await makeTempTree(files);
  temps.push(temp);
  return temp.dir;
}

/** Force the non-git path so results do not depend on any enclosing repository. */
const noGit = (dir: string): NodeJS.ProcessEnv => ({ GIT_CEILING_DIRECTORIES: dirname(dir) });

const run = (dir: string, args: string[] = [], env: NodeJS.ProcessEnv = noGit(dir)): Promise<RunResult> =>
  runRepoMap(script.dir, args, { cwd: dir, env });

const readMap = async (dir: string, path = '.shitaku/repo-map.json'): Promise<RepoMapDocument> =>
  JSON.parse(await readFile(join(dir, path), 'utf8')) as RepoMapDocument;

const exists = (path: string): Promise<boolean> =>
  stat(path).then(
    () => true,
    () => false,
  );

describe('repo-map CLI', () => {
  it('writes .shitaku/repo-map.json by default, reports it and exits 0', async () => {
    const dir = await project(simpleApp);
    const result = await run(dir);
    expect(result).toEqual({ code: 0, stdout: 'wrote .shitaku/repo-map.json\n', stderr: '' });
    const doc = await readMap(dir);
    expect(doc.schema).toBe('shitaku.catalog.repo-map/v1');
    expect(doc.commit).toBeNull();
    expect(doc.root).toEqual({ packageName: 'simple-app' });
    expect(doc.modules.map((m) => m.path)).toEqual(['src/index.ts', 'src/util.ts', 'test/util.test.ts']);
    expect(await readdir(join(dir, '.shitaku'))).toEqual(['repo-map.json']);
  });

  it('writes the file with canonical formatting: sorted keys, two-space indent, trailing newline', async () => {
    const dir = await project(simpleApp);
    await run(dir);
    const text = await readFile(join(dir, '.shitaku', 'repo-map.json'), 'utf8');
    expect(text.startsWith('{\n  "commands": {')).toBe(true);
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).not.toMatch(/generatedAt|timestamp/i);
  });

  it('writes to --out and not to .shitaku', async () => {
    const dir = await project(simpleApp);
    const result = await run(dir, ['--out', 'maps']);
    expect(result).toEqual({ code: 0, stdout: 'wrote maps/repo-map.json\n', stderr: '' });
    expect((await readMap(dir, 'maps/repo-map.json')).schema).toBe('shitaku.catalog.repo-map/v1');
    expect(await exists(join(dir, '.shitaku'))).toBe(false);
  });

  it('creates a nested --out directory', async () => {
    const dir = await project(simpleApp);
    expect((await run(dir, ['--out', 'build-info/maps'])).code).toBe(0);
    expect(await exists(join(dir, 'build-info', 'maps', 'repo-map.json'))).toBe(true);
  });

  it('never lists its own output, including with a custom --out', async () => {
    const dir = await project(simpleApp);
    await run(dir, ['--out', 'maps']);
    await run(dir, ['--out', 'maps']);
    const doc = await readMap(dir, 'maps/repo-map.json');
    expect(doc.tree.map((entry) => entry.path)).not.toContain('maps');
    expect(doc.tree[0]).toEqual({ path: '.', files: 3, totalFiles: 6 });
  });

  it('is stable when --out is the repository root itself', async () => {
    const dir = await project(simpleApp);
    await run(dir, ['--out', '.']);
    const first = await readFile(join(dir, 'repo-map.json'));
    expect((await run(dir, ['--out', '.'])).code).toBe(0);
    expect((await readFile(join(dir, 'repo-map.json'))).equals(first)).toBe(true);
  });

  it('accepts --format json', async () => {
    const dir = await project(simpleApp);
    expect((await run(dir, ['--format', 'json'])).code).toBe(0);
    expect(await exists(join(dir, '.shitaku', 'repo-map.json'))).toBe(true);
  });

  it.each([
    [['--bogus'], 'repo-map: unsupported option --bogus'],
    [['--out'], 'repo-map: --out requires a value'],
    [['--format', 'markdown'], 'repo-map: unsupported --format markdown'],
    [['stray'], 'repo-map: unexpected argument stray'],
  ])('exits 2 with a usage message and writes nothing for %j', async (args, message) => {
    const dir = await project(simpleApp);
    const result = await run(dir, args);
    expect(result).toEqual({ code: 2, stdout: '', stderr: `${message}\n` });
    expect(await exists(join(dir, '.shitaku'))).toBe(false);
    expect(await exists(join(dir, 'maps'))).toBe(false);
  });

  it('exits 2 when the output directory cannot be created', async () => {
    const dir = await project({ ...simpleApp, blocker: 'a file, not a directory\n' });
    const result = await run(dir, ['--out', 'blocker/maps']);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/^repo-map: /);
  });

  it('exits 2 when the output file cannot be written', async () => {
    const dir = await project(simpleApp);
    await mkdir(join(dir, 'maps', 'repo-map.json'), { recursive: true });
    const result = await run(dir, ['--out', 'maps']);
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/^repo-map: /);
    expect(await readdir(join(dir, 'maps'))).toEqual(['repo-map.json']);
  });

  it('leaves no temporary file behind', async () => {
    const dir = await project(simpleApp);
    await run(dir);
    await run(dir);
    expect(await readdir(join(dir, '.shitaku'))).toEqual(['repo-map.json']);
  });

  it('does not touch .gitignore', async () => {
    const gitignore = '# keep me\nnode_modules\r\n.env\n';
    const dir = await project({ ...simpleApp, '.gitignore': gitignore });
    await run(dir);
    expect(await readFile(join(dir, '.gitignore'), 'utf8')).toBe(gitignore);
    expect(await readdir(dir)).not.toContain('.gitignore.tmp');
  });

  it('exits 0 for content that cannot be parsed or resolved', async () => {
    const dir = await project({
      'src/broken.ts': "import { from '\n export class {{{ <<<\n",
      'src/missing.ts': "import './does-not-exist.js';\n",
    });
    const result = await run(dir);
    expect(result.code).toBe(0);
    expect((await readMap(dir)).modules.map((m) => m.path)).toEqual(['src/broken.ts', 'src/missing.ts']);
  });

  it('treats --ignore values as globs and never runs them', async () => {
    const dir = await project(simpleApp);
    const result = await run(dir, [
      '--ignore',
      ';touch pwned',
      '--ignore',
      '$(touch pwned)',
      '--ignore',
      '`touch pwned`',
    ]);
    expect(result.code).toBe(0);
    expect(await exists(join(dir, 'pwned'))).toBe(false);
    expect((await readMap(dir)).modules).toHaveLength(3);
  });

  it('applies --ignore globs to the map', async () => {
    const dir = await project({ ...simpleApp, 'src/generated/g.ts': 'export {};\n' });
    await run(dir, ['--ignore', '**/generated/**']);
    expect((await readMap(dir)).modules.map((m) => m.path)).not.toContain('src/generated/g.ts');
  });

  it('puts no absolute path or machine detail in the JSON', async () => {
    const dir = await project({ ...simpleApp, ...nonGit });
    await run(dir);
    const text = await readFile(join(dir, '.shitaku', 'repo-map.json'), 'utf8');
    expect(text).not.toContain(dir);
    expect(text).not.toContain(dirname(dir));
    expect(text).not.toContain(script.dir);
  });

  it('describes a workspace monorepo end to end', async () => {
    const dir = await project(workspaceMonorepo);
    await run(dir);
    const doc = await readMap(dir);
    expect(doc.workspaces.map((w) => w.path)).toEqual(['apps/web', 'packages/core']);
    expect(doc.commands.packageManager).toBe('pnpm');
  });
});

describe('repo-map determinism', () => {
  it('gives identical bytes on two runs, the second seeing the first output on disk', async () => {
    const dir = await project(simpleApp);
    await run(dir);
    const first = await readFile(join(dir, '.shitaku', 'repo-map.json'));
    await run(dir);
    const second = await readFile(join(dir, '.shitaku', 'repo-map.json'));
    expect(second.equals(first)).toBe(true);
  });

  it('gives identical bytes for the same tree in two different directories', async () => {
    const one = await project(simpleApp);
    const two = await project(simpleApp);
    await run(one);
    await run(two);
    const a = await readFile(join(one, '.shitaku', 'repo-map.json'));
    const b = await readFile(join(two, '.shitaku', 'repo-map.json'));
    expect(one).not.toBe(two);
    expect(b.equals(a)).toBe(true);
  });

  it('does not depend on the order in which files were created', async () => {
    const paths = Object.keys(simpleApp);
    const forward = await project(Object.fromEntries(paths.map((p) => [p, simpleApp[p] ?? ''])));
    const reverse = await project(Object.fromEntries([...paths].reverse().map((p) => [p, simpleApp[p] ?? ''])));
    await run(forward);
    await run(reverse);
    const a = await readFile(join(forward, '.shitaku', 'repo-map.json'));
    const b = await readFile(join(reverse, '.shitaku', 'repo-map.json'));
    expect(b.equals(a)).toBe(true);
  });

  it.skipIf(!hasGit)('records the HEAD commit and is byte-identical for equal git fixtures', async () => {
    const one = await project(simpleApp);
    const two = await project(simpleApp);
    initGitRepo(one, { commit: true });
    initGitRepo(two, { commit: true });
    await writeFile(join(one, 'untracked.ts'), 'export {};\n');
    await writeFile(join(two, 'untracked.ts'), 'export {};\n');
    expect((await run(one, [], {})).code).toBe(0);
    expect((await run(two, [], {})).code).toBe(0);
    const a = await readFile(join(one, '.shitaku', 'repo-map.json'));
    const b = await readFile(join(two, '.shitaku', 'repo-map.json'));
    expect(b.equals(a)).toBe(true);
    expect((await readMap(one)).commit).toMatch(/^[0-9a-f]{40,64}$/);
  });
});

/** The map of `files` after one default run in a fresh non-git directory. */
async function mapOf(files: Tree): Promise<{ dir: string; doc: RepoMapDocument; text: string }> {
  const dir = await project(files);
  const result = await run(dir);
  expect(result).toEqual({ code: 0, stdout: 'wrote .shitaku/repo-map.json\n', stderr: '' });
  const text = await readFile(join(dir, '.shitaku', 'repo-map.json'), 'utf8');
  return { dir, doc: JSON.parse(text) as RepoMapDocument, text };
}

const importsOf = (doc: RepoMapDocument, path: string): string[] =>
  (doc.modules.find((m) => m.path === path)?.imports ?? []).map(
    (i) => `${i.specifier} ${i.kind} ${i.status} ${i.resolved ?? '-'}`,
  );

describe('repo-map extraction through the CLI', () => {
  it('records real imports and exports from tricky syntax and exits 0 on a broken file', async () => {
    const { dir, doc, text } = await mapOf(trickySyntax);
    expect(importsOf(doc, 'src/index.ts')).toEqual([
      './lazy dynamic internal src/lazy.ts',
      './real.js static internal src/real.ts',
      './reexport reexport internal src/reexport.ts',
      './types type internal src/types.ts',
    ]);
    expect(doc.modules.find((m) => m.path === 'src/index.ts')?.exports.map((e) => e.name)).toEqual([
      '*',
      'lazy',
      'main',
    ]);
    // The unparsable file yields what could be extracted; its unresolved import is marked, not fatal.
    expect(importsOf(doc, 'src/broken.ts')).toEqual(['./missing static unresolved -']);
    expect(doc.modules.find((m) => m.path === 'src/broken.ts')?.exports.map((e) => e.name)).toEqual(['after', 'ok']);
    expect(doc.graph.importedByCount['src/real.ts']).toBe(2);
    expect(text).not.toContain(dir);
  });

  it('resolves tsconfig aliases read from a JSONC config and its extended base', async () => {
    const jsonc =
      '{\n  // shared by every package\n  "compilerOptions": {\n    "baseUrl": ".",\n    "paths": {\n      "@/*": ["src/*"],\n      "~lib": ["src/lib/index.ts"],\n    },\n  },\n}\n';
    const { doc } = await mapOf({ ...aliases, 'tsconfig.base.json': jsonc });
    expect(importsOf(doc, 'src/main.ts')).toEqual([
      '@/gone static unresolved -',
      '@/util static internal src/util.ts',
      'react static external -',
      '~lib static internal src/lib/index.ts',
    ]);
    expect(doc.graph.edges).toEqual([
      { from: 'src/main.ts', to: 'src/lib/index.ts' },
      { from: 'src/main.ts', to: 'src/util.ts' },
    ]);
  });

  it('resolves workspace package imports in a monorepo', async () => {
    const { doc } = await mapOf(workspaceMonorepo);
    expect(importsOf(doc, 'apps/web/src/page.ts')).toEqual([
      './helper.js static internal apps/web/src/helper.ts',
      '@acme/core static internal packages/core/src/index.ts',
    ]);
    expect(importsOf(doc, 'apps/web/bin/web.js')).toEqual([
      '@acme/core static internal packages/core/src/index.ts',
      'node:fs static external -',
    ]);
    expect(doc.graph.importedByCount['packages/core/src/index.ts']).toBe(2);
  });

  it('keeps the JSON complete and self-consistent', async () => {
    const { doc } = await mapOf({
      ...trickySyntax,
      ...workspaceMonorepo,
      'package.json': trickySyntax['package.json'] ?? '',
    });
    const modulePaths = doc.modules.map((m) => m.path);
    expect(Object.keys(doc.graph.importedByCount).sort()).toEqual([...modulePaths].sort());
    expect(modulePaths.length).toBeGreaterThan(10);
    for (const { from, to } of doc.graph.edges) {
      expect(modulePaths).toContain(from);
      expect(modulePaths).toContain(to);
    }
    for (const module of doc.modules) {
      for (const entry of module.imports) {
        expect(entry.resolved === null).toBe(entry.status !== 'internal');
      }
    }
  });

  it.each([
    ['tricky syntax', trickySyntax],
    ['aliases', aliases],
    ['a workspace monorepo', workspaceMonorepo],
  ])('is byte-identical across two runs and two directories for %s', async (_label, files) => {
    const first = await mapOf(files);
    const again = await run(first.dir);
    expect(again.code).toBe(0);
    const second = await readFile(join(first.dir, '.shitaku', 'repo-map.json'), 'utf8');
    expect(second).toBe(first.text);
    expect((await mapOf(files)).text).toBe(first.text);
  });

  it('does not depend on file creation order with populated modules', async () => {
    const paths = Object.keys(trickySyntax);
    const forward = await mapOf(Object.fromEntries(paths.map((p) => [p, trickySyntax[p] ?? ''])));
    const reverse = await mapOf(Object.fromEntries([...paths].reverse().map((p) => [p, trickySyntax[p] ?? ''])));
    expect(reverse.text).toBe(forward.text);
  });

  it.skipIf(!hasGit)('gives the same modules and graph through git as through the walk', async () => {
    const walked = await mapOf(workspaceMonorepo);
    const dir = await project(workspaceMonorepo);
    initGitRepo(dir, { commit: true });
    expect((await run(dir, [], {})).code).toBe(0);
    const viaGit = await readMap(dir);
    expect(viaGit.commit).toMatch(/^[0-9a-f]{40,64}$/);
    expect(viaGit.modules).toEqual(walked.doc.modules);
    expect(viaGit.graph).toEqual(walked.doc.graph);
  });
});
