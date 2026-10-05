import { scriptsDir } from '@/application/journal.js';
import { isPathLikeScriptName, SCRIPT_ENTRY } from '@/domain/scripts-run.js';
import type { Scope } from '@/ports/agent-target.js';
import type { FileSystem } from '@/ports/file-system.js';
import type { Paths } from '@/ports/paths.js';
import type { ProcessRunner } from '@/ports/process-runner.js';

export interface RunScriptDeps {
  fs: FileSystem;
  paths: Paths;
  runner: ProcessRunner;
  /** Node binary that should execute `index.mjs` (usually `process.execPath`). */
  execPath: string;
  env: Record<string, string | undefined>;
  /** Defaults to the host platform; injected for Windows PATH delimiter tests. */
  platform?: string;
  out(line: string): void;
  err(line: string): void;
}

export interface RunScriptRequest {
  name?: string;
  args?: readonly string[];
}

interface InstalledScript {
  name: string;
  scope: Scope;
  root: string;
  description: string;
}

async function readDescription(fs: FileSystem, root: string): Promise<string> {
  const text = await fs.readText(`${root}/script.json`);
  if (text === null) return '';
  try {
    const raw: unknown = JSON.parse(text);
    const description = (raw as { description?: unknown } | null)?.description;
    return typeof description === 'string' ? description : '';
  } catch {
    return '';
  }
}

/** Unique top-level directory names under a scripts root, derived from listed files. */
async function listScriptNames(fs: FileSystem, root: string): Promise<string[]> {
  const files = await fs.listFiles(root);
  if (files === null) return [];
  const names = new Set<string>();
  for (const rel of files) {
    const slash = rel.indexOf('/');
    if (slash <= 0) continue;
    names.add(rel.slice(0, slash));
  }
  return [...names].sort();
}

async function listInstalled(deps: RunScriptDeps): Promise<InstalledScript[]> {
  const scopes: Scope[] = ['project', 'user'];
  const found: InstalledScript[] = [];
  for (const scope of scopes) {
    const base = scriptsDir(scope, deps.paths);
    for (const name of await listScriptNames(deps.fs, base)) {
      const root = `${base}/${name}`;
      if (!(await deps.fs.exists(`${root}/${SCRIPT_ENTRY}`))) continue;
      found.push({
        name,
        scope,
        root,
        description: await readDescription(deps.fs, root),
      });
    }
  }
  return found;
}

function pathDelimiter(platform: string): string {
  return platform === 'win32' ? ';' : ':';
}

function withBinOnPath(
  env: Record<string, string | undefined>,
  cwd: string,
  platform: string,
): Record<string, string | undefined> {
  const bin = `${cwd}/node_modules/.bin`;
  const delim = pathDelimiter(platform);
  const existing = env['PATH'] ?? env['Path'] ?? '';
  return { ...env, PATH: existing === '' ? bin : `${bin}${delim}${existing}` };
}

/**
 * Lists installed scripts when `name` is omitted; otherwise resolves project-then-user and
 * spawns `execPath` with the installed `index.mjs` and passthrough args.
 */
export async function runScript(deps: RunScriptDeps, req: RunScriptRequest): Promise<number> {
  const platform = deps.platform ?? 'linux';
  const name = req.name;

  if (name === undefined || name === '') {
    const installed = await listInstalled(deps);
    if (installed.length === 0) {
      deps.out('no installed scripts');
      return 0;
    }
    const width = Math.max(...installed.map((s) => s.name.length));
    for (const s of installed) {
      const desc = s.description === '' ? '' : `  ${s.description}`;
      deps.out(`${s.name.padEnd(width)}  ${s.scope}${desc}`);
    }
    return 0;
  }

  if (isPathLikeScriptName(name)) {
    deps.err(`error: script name must not be a path (${name}); pass the catalog name only`);
    return 1;
  }

  const projectRoot = `${scriptsDir('project', deps.paths)}/${name}`;
  const userRoot = `${scriptsDir('user', deps.paths)}/${name}`;
  let root: string | null = null;
  if (await deps.fs.exists(`${projectRoot}/${SCRIPT_ENTRY}`)) root = projectRoot;
  else if (await deps.fs.exists(`${userRoot}/${SCRIPT_ENTRY}`)) root = userRoot;

  if (root === null) {
    deps.err(`error: unknown script '${name}'; run \`shitaku run\` to list installed scripts`);
    return 1;
  }

  const entry = `${root}/${SCRIPT_ENTRY}`;
  const { exitCode } = await deps.runner.run(deps.execPath, [entry, ...(req.args ?? [])], {
    cwd: deps.paths.cwd,
    env: withBinOnPath(deps.env, deps.paths.cwd, platform),
  });
  return exitCode;
}
