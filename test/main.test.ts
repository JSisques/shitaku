import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localePrefersUtf8, terminalSupportsColor } from '@/adapters/cli/banner.js';
import type { CliDeps } from '@/adapters/cli/program.js';
import { claudeCodeTarget } from '@/adapters/claude-code/target.js';
import { makeTmpPaths, type TmpPaths } from '@test/helpers/tmp-paths.js';

const runCli = vi.fn<(argv: string[], deps: CliDeps) => Promise<number>>();
let tmp: TmpPaths;

vi.mock('@/adapters/cli/program.js', () => ({ runCli: (argv: string[], deps: CliDeps) => runCli(argv, deps) }));
// test/setup.ts makes os.homedir() throw; the composition root must still be importable, so serve a temp home.
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  const homedir = (): string => process.env['HOME'] ?? '';
  return { ...actual, default: { ...actual, homedir }, homedir };
});

/** Imports the composition root fresh (it runs at import time) and returns the deps it handed to `runCli`. */
async function bootMain(): Promise<CliDeps> {
  vi.resetModules();
  await import('@/main.js');
  const call = runCli.mock.calls[0];
  if (!call) throw new Error('runCli was not called');
  return call[1];
}

describe('main (composition root)', () => {
  const originalExitCode = process.exitCode;

  beforeEach(async () => {
    tmp = await makeTmpPaths();
    runCli.mockReset();
    runCli.mockResolvedValue(0);
    vi.spyOn(process, 'cwd').mockReturnValue(tmp.cwd);
    vi.stubEnv('HOME', tmp.homeDir);
  });

  afterEach(async () => {
    process.exitCode = originalExitCode;
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await tmp.cleanup();
  });

  it('passes argv and the injected paths, target and env to runCli', async () => {
    const deps = await bootMain();
    expect(runCli.mock.calls[0]?.[0]).toBe(process.argv);
    expect(deps.paths).toEqual({ homeDir: tmp.homeDir, cwd: tmp.cwd });
    expect(deps.target.id).toBe(claudeCodeTarget.id);
    expect(deps.env).toBe(process.env);
  });

  it('passes terminal facts for the banner', async () => {
    const deps = await bootMain();
    expect(deps.terminal).toEqual({
      tty: Boolean(process.stdout.isTTY && process.stderr.isTTY),
      color: terminalSupportsColor(process.env, Boolean(process.stderr.isTTY)),
      unicode: localePrefersUtf8(process.env),
    });
  });

  it('forwards cliVersion from package.json', async () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
    const deps = await bootMain();
    expect(deps.cliVersion).toBe(pkg.version);
  });

  it('wires installMethod into updates from process signals', async () => {
    vi.stubEnv('npm_command', 'exec');
    vi.stubEnv('npm_execpath', '/usr/lib/node_modules/npm/bin/npx-cli.js');
    const deps = await bootMain();
    expect(deps.updates?.installMethod).toBe('npx');
  });

  it('resolves --source relative to the working directory', async () => {
    const deps = await bootMain();
    expect(deps.makeSource('my-catalog').ref()).toEqual({
      kind: 'folder',
      location: resolve(tmp.cwd, 'my-catalog'),
    });
  });

  it('keeps an absolute --source as is', async () => {
    const deps = await bootMain();
    expect(deps.makeSource(tmp.root).ref()).toEqual({ kind: 'folder', location: tmp.root });
  });

  it('uses the bundled catalog when no --source is given', async () => {
    const deps = await bootMain();
    const bundled = fileURLToPath(new URL('../catalog/', import.meta.url));
    expect(deps.makeSource().ref()).toEqual({ kind: 'bundled', location: bundled });
  });

  it('routes out and err to console.log and console.error', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const deps = await bootMain();
    deps.out('hello');
    deps.err('oops');
    expect(log).toHaveBeenCalledWith('hello');
    expect(error).toHaveBeenCalledWith('oops');
  });

  it.each([0, 1, 2, 3])('sets process.exitCode from the runCli result (%i)', async (code) => {
    runCli.mockResolvedValue(code);
    process.exitCode = undefined;
    await bootMain();
    expect(process.exitCode).toBe(code);
  });
});
