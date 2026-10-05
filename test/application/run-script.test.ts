import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { claudeCodeTarget } from '@/adapters/claude-code/target.js';
import { NodeFileSystem } from '@/adapters/fs/node-fs.js';
import { initMcps, type InitDeps } from '@/application/init-mcps.js';
import { stateDir } from '@/application/journal.js';
import { runScript, type RunScriptDeps } from '@/application/run-script.js';
import type { ScriptItem } from '@/domain/catalog/script.js';
import type { ProcessRunner } from '@/ports/process-runner.js';
import { enc, SCRIPT_V1, scriptSource } from '@test/helpers/scripts.js';
import { makeTmpPaths, type TmpPaths } from '@test/helpers/tmp-paths.js';

const scriptNamed = (name: string, description: string): ScriptItem => ({
  name,
  description,
  tools: [],
  files: [
    { path: 'index.mjs', bytes: enc(`export default '${name}';\n`) },
    {
      path: 'script.json',
      bytes: enc(JSON.stringify({ name, description, tools: [] })),
    },
  ],
});

describe('runScript', () => {
  let tmp: TmpPaths;
  let calls: { command: string; args: readonly string[]; cwd: string; env?: Record<string, string | undefined> }[];
  let exitCode: number;
  let out: string[];
  let err: string[];
  const fs = new NodeFileSystem();

  const runner = (): ProcessRunner => ({
    run: (command, args, opts) => {
      calls.push({ command, args, cwd: opts.cwd, env: opts.env });
      return Promise.resolve({ exitCode });
    },
  });

  const initDeps = (scripts: ScriptItem[]): InitDeps => ({
    source: scriptSource(scripts),
    fs,
    target: claudeCodeTarget,
    paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
    env: {},
  });

  const deps = (extra: Partial<RunScriptDeps> = {}): RunScriptDeps => ({
    fs,
    paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
    runner: runner(),
    execPath: '/fake/node',
    env: { PATH: '/usr/bin' },
    platform: 'linux',
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    ...extra,
  });

  const install = (scripts: ScriptItem[], scope: 'project' | 'user') =>
    initMcps(initDeps(scripts), { mcps: [], skills: [], scripts: scripts.map((s) => s.name), scope });

  beforeEach(async () => {
    tmp = await makeTmpPaths();
    calls = [];
    exitCode = 0;
    out = [];
    err = [];
  });
  afterEach(() => tmp.cleanup());

  describe('path-like names (threat)', () => {
    it('rejects ./demo without spawning', async () => {
      await install([SCRIPT_V1], 'project');
      expect(await runScript(deps(), { name: './demo', args: [] })).toBe(1);
      expect(calls).toEqual([]);
      expect(err.some((l) => /path|name/i.test(l))).toBe(true);
    });

    it('rejects absolute and Windows path forms without spawning', async () => {
      for (const name of ['/abs/lint', 'C:\\scripts\\lint', '..\\lint', 'lint/../x']) {
        calls = [];
        err = [];
        expect(await runScript(deps(), { name, args: [] })).toBe(1);
        expect(calls).toEqual([]);
      }
    });

    it('never passes script.json as the spawn target', async () => {
      await install([SCRIPT_V1], 'project');
      await runScript(deps(), { name: 'lint', args: ['--json'] });
      expect(calls).toHaveLength(1);
      const spawned = calls[0]!;
      expect(spawned.command).toBe('/fake/node');
      expect(spawned.args[0]).toMatch(/index\.mjs$/);
      expect(spawned.args.join(' ')).not.toContain('script.json');
    });
  });

  describe('bare list', () => {
    it('lists installed scripts with name, scope and description and exits 0', async () => {
      await install([SCRIPT_V1], 'project');
      await install([scriptNamed('format', 'fmt')], 'user');
      expect(await runScript(deps(), {})).toBe(0);
      expect(calls).toEqual([]);
      const text = out.join('\n');
      expect(text).toMatch(/lint/);
      expect(text).toMatch(/project/);
      expect(text).toMatch(/format/);
      expect(text).toMatch(/user/);
      expect(text).toMatch(/fmt/);
    });

    it('prints a clear empty message when nothing is installed', async () => {
      expect(await runScript(deps(), {})).toBe(0);
      expect(out.some((l) => /no .*script/i.test(l))).toBe(true);
    });
  });

  describe('resolve and passthrough', () => {
    it('prefers project over user and passes args and exit code', async () => {
      await install([SCRIPT_V1], 'user');
      await install([SCRIPT_V1], 'project');
      exitCode = 1;
      expect(await runScript(deps(), { name: 'lint', args: ['--json'] })).toBe(1);
      expect(calls).toHaveLength(1);
      const spawned = calls[0]!;
      expect(spawned.args).toEqual([join(tmp.cwd, '.shitaku', 'scripts', 'lint', 'index.mjs'), '--json']);
      expect(spawned.args[0]).not.toContain(join(stateDir(tmp.homeDir), 'scripts'));
    });

    it('prepends node_modules/.bin to PATH for tool resolution', async () => {
      await install([SCRIPT_V1], 'project');
      await runScript(deps(), { name: 'lint', args: [] });
      const pathEnv = calls[0]?.env?.['PATH'] ?? '';
      expect(pathEnv.startsWith(join(tmp.cwd, 'node_modules', '.bin'))).toBe(true);
    });

    it('does not modify package.json contents or mtime', async () => {
      const pkgPath = join(tmp.cwd, 'package.json');
      const original = `${JSON.stringify({ name: 'fixture', private: true }, null, 2)}\n`;
      await writeFile(pkgPath, original);
      const before = await stat(pkgPath);
      await install([SCRIPT_V1], 'project');
      expect(await runScript(deps(), { name: 'lint', args: ['--json'] })).toBe(0);
      expect(calls).toHaveLength(1);
      const after = await stat(pkgPath);
      expect(await readFile(pkgPath, 'utf8')).toBe(original);
      expect(after.mtimeMs).toBe(before.mtimeMs);
      expect(after.size).toBe(before.size);
    });
  });

  describe('unknown name', () => {
    it('exits non-zero and suggests bare run without spawning', async () => {
      await install([SCRIPT_V1], 'project');
      expect(await runScript(deps(), { name: 'ghost', args: [] })).toBe(1);
      expect(calls).toEqual([]);
      expect(err.join('\n')).toMatch(/ghost/);
      expect(err.join('\n')).toMatch(/shitaku run/);
    });
  });
});
