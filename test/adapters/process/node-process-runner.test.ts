import { describe, expect, it, vi } from 'vitest';
import { NodeProcessRunner } from '@/adapters/process/node-process-runner.js';
import type { ProcessRunner } from '@/ports/process-runner.js';

describe('ProcessRunner port shape', () => {
  it('returns an exit code from run', async () => {
    const runner: ProcessRunner = {
      run: () => Promise.resolve({ exitCode: 7 }),
    };
    expect(await runner.run('node', ['-e', 'process.exit(7)'], { cwd: '/' })).toEqual({ exitCode: 7 });
  });
});

describe('NodeProcessRunner', () => {
  it('spawns with shell false and passes through the exit code', async () => {
    const runner = new NodeProcessRunner();
    const result = await runner.run(process.execPath, ['-e', 'process.exit(3)'], { cwd: process.cwd() });
    expect(result).toEqual({ exitCode: 3 });
  });

  it('passes zero when the child exits cleanly', async () => {
    const runner = new NodeProcessRunner();
    const result = await runner.run(process.execPath, ['-e', ''], { cwd: process.cwd() });
    expect(result).toEqual({ exitCode: 0 });
  });

  it('invokes cmd.exe for .cmd shims on win32 without shell true', async () => {
    const spawn = vi.fn((_cmd: string, _args: readonly string[], opts: { shell?: boolean }) => {
      expect(opts.shell).toBe(false);
      return {
        on(event: string, cb: (code: number | null) => void) {
          if (event === 'close') cb(0);
          return this;
        },
      };
    });
    const runner = new NodeProcessRunner({ platform: 'win32', spawn: spawn as never });
    await runner.run('C:\\repo\\node_modules\\.bin\\knip.cmd', ['--fix'], { cwd: 'C:\\repo' });
    expect(spawn).toHaveBeenCalledOnce();
    const [command, args, opts] = spawn.mock.calls[0]!;
    expect(command.toLowerCase()).toMatch(/cmd(\.exe)?$/);
    expect(opts).toMatchObject({ shell: false });
    expect(args[0]).toBe('/d');
    expect(args[1]).toBe('/s');
    expect(args[2]).toBe('/c');
    expect(args.slice(3).join(' ')).toContain('knip.cmd');
  });
});
