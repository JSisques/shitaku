import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
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

/** Write a virtual tree under `dir`, creating parent directories. */
export async function writeTree(dir: string, files: Tree): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    const target = join(dir, ...path.split('/'));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
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
