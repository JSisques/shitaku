import { describe, expect, it } from 'vitest';
import { upgradeCli, type UpgradeCliDeps } from '@/application/upgrade-cli.js';
import { upgradeArgv } from '@/domain/install-method.js';
import type { ProcessRunner } from '@/ports/process-runner.js';
import type { LatestVersionSource } from '@/ports/version-source.js';

describe('upgradeCli', () => {
  let latestCalls: AbortSignal[];
  let runnerCalls: {
    command: string;
    args: readonly string[];
    cwd: string;
    env?: Record<string, string | undefined>;
  }[];
  let out: string[];
  let err: string[];
  let exitCode: number;

  const sourceReturning = (value: string | null): LatestVersionSource => ({
    latest: (signal) => {
      latestCalls.push(signal);
      return Promise.resolve(value);
    },
  });

  const runner = (): ProcessRunner => ({
    run: (command, args, opts) => {
      runnerCalls.push({ command, args, cwd: opts.cwd, env: opts.env });
      return Promise.resolve({ exitCode });
    },
  });

  const deps = (over: Partial<UpgradeCliDeps> = {}): UpgradeCliDeps => ({
    source: sourceReturning('0.3.0'),
    runner: runner(),
    currentVersion: '0.2.0',
    installMethod: 'npm-global',
    cwd: '/tmp/project',
    env: { PATH: '/usr/bin' },
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    ...over,
  });

  const reset = (): void => {
    latestCalls = [];
    runnerCalls = [];
    out = [];
    err = [];
    exitCode = 0;
  };

  it('always calls source.latest with an AbortSignal (fresh fetch)', async () => {
    reset();
    await upgradeCli(deps());
    expect(latestCalls).toHaveLength(1);
    expect(latestCalls[0]).toBeInstanceOf(AbortSignal);
  });

  it('exits non-zero with a clear error and does not spawn when latest is null', async () => {
    reset();
    const code = await upgradeCli(deps({ source: sourceReturning(null) }));
    expect(code).not.toBe(0);
    expect(runnerCalls).toEqual([]);
    expect(err.join('\n')).toMatch(/fail|unable|could not|error/i);
  });

  it('exits 0 with an already-up-to-date message and does not spawn when versions match', async () => {
    reset();
    const code = await upgradeCli(deps({ currentVersion: '0.3.0', source: sourceReturning('0.3.0') }));
    expect(code).toBe(0);
    expect(runnerCalls).toEqual([]);
    expect(out.join('\n')).toMatch(/up.to.date|already|latest/i);
  });

  it('shows current→target before the next action when a newer version is available', async () => {
    reset();
    await upgradeCli(deps({ installMethod: 'npx' }));
    const text = out.join('\n');
    expect(text).toMatch(/0\.2\.0/);
    expect(text).toMatch(/0\.3\.0/);
    const versionIdx = Math.min(text.indexOf('0.2.0'), text.indexOf('0.3.0'));
    const guidanceIdx = text.search(/npx @jsisques\/shitaku@latest/);
    expect(versionIdx).toBeGreaterThanOrEqual(0);
    expect(guidanceIdx).toBeGreaterThan(versionIdx);
  });

  it('spawns exact npm-global upgradeArgv via the runner', async () => {
    reset();
    const code = await upgradeCli(deps({ installMethod: 'npm-global' }));
    expect(code).toBe(0);
    expect(runnerCalls).toHaveLength(1);
    const expected = upgradeArgv('npm-global');
    expect(runnerCalls[0]).toMatchObject({
      command: expected.command,
      args: expected.args,
      cwd: '/tmp/project',
    });
  });

  it('spawns exact pnpm-global upgradeArgv via the runner', async () => {
    reset();
    const code = await upgradeCli(deps({ installMethod: 'pnpm-global' }));
    expect(code).toBe(0);
    expect(runnerCalls).toHaveLength(1);
    const expected = upgradeArgv('pnpm-global');
    expect(runnerCalls[0]).toMatchObject({
      command: expected.command,
      args: expected.args,
      cwd: '/tmp/project',
    });
  });

  it.each(['npx', 'unknown'] as const)('prints guidance only for %s with zero runner calls', async (method) => {
    reset();
    const code = await upgradeCli(deps({ installMethod: method }));
    expect(code).toBe(0);
    expect(runnerCalls).toEqual([]);
    expect(out.join('\n')).toMatch(/@jsisques\/shitaku/);
  });

  it('on non-zero PM exit returns non-zero, says install unchanged with recovery, and does not claim success', async () => {
    reset();
    exitCode = 1;
    const code = await upgradeCli(deps({ installMethod: 'npm-global' }));
    expect(code).not.toBe(0);
    expect(runnerCalls).toHaveLength(1);
    const errText = err.join('\n');
    expect(errText).toMatch(/unchanged|not updated|failed/i);
    expect(errText).toMatch(/npm install -g @jsisques\/shitaku|retry|manually/i);
    expect(out.join('\n') + errText).not.toMatch(/successfully upgraded|upgrade complete|upgraded to/i);
  });
});
