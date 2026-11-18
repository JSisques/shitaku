import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Directory of the bundled repo-map script (source of truth, not an installed copy). */
export const SCRIPT_DIR = join(import.meta.dirname, '..', '..', 'catalog', 'scripts', 'repo-map');

/** Import one of the script's plain `.mjs` modules and view it through a local type. */
export async function loadRepoMapModule<T>(name: string): Promise<T> {
  return (await import(pathToFileURL(join(SCRIPT_DIR, name)).href)) as T;
}

export type RepoMapOptions = {
  format: 'json';
  out: string;
  ignore: string[];
};

export type ArgsModule = {
  parseArgs: (argv: string[]) => RepoMapOptions;
};

/** A virtual tree: repository-relative POSIX path to file content. */
export type Tree = Record<string, string>;

export type SkipReason = 'too-large' | 'unreadable' | 'symlink' | 'invalid-json';

export type Snapshot = {
  commit: string | null;
  files: string[];
  sources: Map<string, string>;
  manifests: Map<string, Record<string, unknown> | { invalid: true }>;
  tsconfigs: Map<string, unknown>;
  skipped: { path: string; reason: SkipReason }[];
  textFiles: Map<string, string>;
};

export type ScanModule = {
  scan: (root: string, opts: { ignore: string[]; outRel: string | null }) => Snapshot;
  MAX_FILE_BYTES: number;
};

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/** A tiny TypeScript package: one import edge, scripts, a tsconfig and a test file. */
export const simpleApp: Tree = {
  'package.json': json({
    name: 'simple-app',
    version: '1.0.0',
    type: 'module',
    main: 'dist/index.js',
    scripts: { build: 'tsc', test: 'vitest run' },
    devDependencies: { typescript: '^5.4.0', vitest: '^1.6.0' },
  }),
  'tsconfig.json': json({ compilerOptions: { strict: true, target: 'ES2022', paths: { '@/*': ['./src/*'] } } }),
  'src/index.ts': "import { add } from './util.js';\n\nexport function main(): number {\n  return add(1, 2);\n}\n",
  'src/util.ts': 'export const add = (a: number, b: number): number => a + b;\n',
  'test/util.test.ts': "import { add } from '@/util.js';\n\nadd(1, 2);\n",
  'README.md': '# simple app\n',
};

/** A tree with content under every built-in ignored directory, for walk (non-git) listings. */
export const nonGit: Tree = {
  'src/b.ts': 'export const b = 1;\n',
  'src/a.ts': 'export const a = 1;\n',
  'src/nested/c.ts': 'export const c = 1;\n',
  'node_modules/dep/index.js': 'module.exports = 1;\n',
  'packages/p/node_modules/dep/index.js': 'module.exports = 1;\n',
  'dist/out.js': 'export {};\n',
  'build/out.js': 'export {};\n',
  'coverage/lcov.info': 'TN:\n',
  '.git/notes.txt': 'not a repository\n',
  '.hg/notes.txt': 'x\n',
  '.svn/notes.txt': 'x\n',
  '.shitaku/repo-map.json': '{}\n',
};

/** A pnpm monorepo with two packages. Manifests only; sources arrive with the slice 2 tasks. */
export const workspaceMonorepo: Tree = {
  'package.json': json({
    name: 'acme',
    private: true,
    packageManager: 'pnpm@9.0.0',
    scripts: { build: 'pnpm -r build' },
    devDependencies: { typescript: '^5.4.0' },
  }),
  'pnpm-workspace.yaml': "packages:\n  - 'packages/*'\n  - 'apps/*'\n",
  'packages/core/package.json': json({
    name: '@acme/core',
    version: '1.0.0',
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    scripts: { build: 'tsc -p .' },
  }),
  'apps/web/package.json': json({
    name: '@acme/web',
    version: '1.0.0',
    bin: { web: 'bin/web.js' },
    scripts: { dev: 'node bin/web.js' },
    dependencies: { '@acme/core': 'workspace:*' },
  }),
};

const SOURCE_EXTENSION = /\.(?:ts|mts|cts|tsx|js|mjs|cjs|jsx)$/;

const compareCodeUnits = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Build a snapshot from a virtual tree without touching the filesystem, so pure modules can be
 * tested with in-memory input. Mirrors what `scan` returns for a non-git directory.
 */
export function snapshotFromTree(tree: Tree, overrides: Partial<Snapshot> = {}): Snapshot {
  const snapshot: Snapshot = {
    commit: null,
    files: Object.keys(tree).sort(compareCodeUnits),
    sources: new Map(),
    manifests: new Map(),
    tsconfigs: new Map(),
    skipped: [],
    textFiles: new Map(),
  };
  for (const path of snapshot.files) {
    const text = tree[path] ?? '';
    const slash = path.lastIndexOf('/');
    const dir = slash === -1 ? '.' : path.slice(0, slash);
    const base = path.slice(slash + 1);
    if (base === 'package.json') {
      try {
        snapshot.manifests.set(dir, JSON.parse(text) as Record<string, unknown>);
      } catch {
        snapshot.manifests.set(dir, { invalid: true });
        snapshot.skipped.push({ path, reason: 'invalid-json' });
      }
    } else if (base === 'tsconfig.json') {
      snapshot.tsconfigs.set(dir, JSON.parse(text) as unknown);
    } else if (base === 'pnpm-workspace.yaml') {
      snapshot.textFiles.set(path, text);
    } else if (SOURCE_EXTENSION.test(base)) {
      snapshot.sources.set(path, text);
    }
  }
  return { ...snapshot, ...overrides };
}

export type RepoMapDocument = {
  schema: string;
  commit: string | null;
  root: { packageName: string | null };
  stack: Record<string, unknown>;
  workspaces: { name: string | null; path: string }[];
  commands: { packageManager: string | null; scripts: { path: string; name: string; command: string }[] };
  entryPoints: unknown[];
  tree: { path: string; files: number; totalFiles: number }[];
  modules: { path: string; language: string; imports: unknown[]; exports: unknown[] }[];
  graph: { edges: { from: string; to: string }[]; importedByCount: Record<string, number> };
  conventions: Record<string, unknown>;
  skipped: { path: string; reason: SkipReason }[];
};

export type BuildMapModule = {
  buildRepoMap: (snapshot: Snapshot) => RepoMapDocument;
  SCHEMA: string;
};

export type Token = {
  type: 'ident' | 'punct' | 'string' | 'template' | 'number';
  value: string;
  start: number;
  end: number;
  line: number;
  /** True when whitespace or a comment sits between the previous token and this one. */
  gap: boolean;
};

export type TokenizeModule = {
  tokenize: (source: string) => Token[];
};

export type RawImport = { specifier: string; kind: 'static' | 'type' | 'reexport' | 'require' | 'dynamic' };
export type RawExport = { name: string; kind: string; signature: string | null };

export type ExtractModule = {
  extractJs: (source: string) => { imports: RawImport[]; exports: RawExport[] };
};

/** Write a virtual tree under `dir`, creating parent directories. */
export async function writeTree(dir: string, files: Tree): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    const target = join(dir, ...path.split('/'));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
}

export type TempTree = { dir: string; cleanup: () => Promise<void> };

/** Create a temp directory (real path) holding `files`. Call `cleanup` when done. */
export async function makeTempTree(files: Tree = {}): Promise<TempTree> {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'shitaku-repo-map-')));
  await writeTree(dir, files);
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

/** Copy the bundled script to a temp directory, as an install would, so a run uses that copy. */
export async function copyScript(): Promise<TempTree> {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'shitaku-repo-map-script-')));
  await cp(SCRIPT_DIR, dir, { recursive: true });
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

export type RunResult = { code: number | null; stdout: string; stderr: string };

/** Spawn `index.mjs` of the script at `scriptRoot` with `cwd` as the working directory. */
export function runRepoMap(
  scriptRoot: string,
  args: string[],
  opts: { cwd: string; env?: NodeJS.ProcessEnv },
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(scriptRoot, 'index.mjs'), ...args], {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

/** True when a `git` executable is on PATH. Git-dependent tests use `it.skipIf(!hasGit)`. */
export const hasGit = spawnSync('git', ['--version']).status === 0;

/** Fixed identity and dates so commit hashes are reproducible; tests never read global git config. */
export const GIT_ENV: NodeJS.ProcessEnv = {
  GIT_AUTHOR_NAME: 'Repo Map Test',
  GIT_AUTHOR_EMAIL: 'repo-map@example.com',
  GIT_AUTHOR_DATE: '2024-01-02T03:04:05Z',
  GIT_COMMITTER_NAME: 'Repo Map Test',
  GIT_COMMITTER_EMAIL: 'repo-map@example.com',
  GIT_COMMITTER_DATE: '2024-01-02T03:04:05Z',
  GIT_CONFIG_NOSYSTEM: '1',
};

/** Run git in `dir` with the fixed identity; returns trimmed stdout. */
export function git(dir: string, args: string[]): string {
  const env = { ...process.env, ...GIT_ENV };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete env[key];
  return execFileSync('git', args, { cwd: dir, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** `git init` in `dir`; with `commit`, stage everything and commit it with the fixed identity. */
export function initGitRepo(dir: string, opts: { commit?: boolean } = {}): void {
  git(dir, ['init', '-q']);
  if (opts.commit === true) {
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'initial']);
  }
}
