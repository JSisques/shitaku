import { spawn as nodeSpawn, type SpawnOptions } from 'node:child_process';
import type { ProcessRunner } from '@/ports/process-runner.js';

export type SpawnFn = (
  command: string,
  args: readonly string[],
  options: SpawnOptions,
) => {
  on(event: 'close', listener: (code: number | null) => void): unknown;
  on(event: 'error', listener: (err: Error) => void): unknown;
};

export interface NodeProcessRunnerOptions {
  platform?: string;
  spawn?: SpawnFn;
  /** Windows command interpreter; defaults to `process.env.ComSpec` or `cmd.exe`. */
  comSpec?: string;
}

function isWindowsBatch(command: string): boolean {
  const lower = command.toLowerCase();
  return lower.endsWith('.cmd') || lower.endsWith('.bat');
}

/** Node `child_process.spawn` with `shell: false`. Windows `.cmd`/`.bat` go through `cmd.exe /d /s /c`. */
export class NodeProcessRunner implements ProcessRunner {
  private readonly platform: string;
  private readonly spawn: SpawnFn;
  private readonly comSpec: string;

  constructor(opts: NodeProcessRunnerOptions = {}) {
    this.platform = opts.platform ?? process.platform;
    this.spawn = opts.spawn ?? nodeSpawn;
    this.comSpec = opts.comSpec ?? process.env['ComSpec'] ?? 'cmd.exe';
  }

  run(
    command: string,
    args: readonly string[],
    opts: { cwd: string; env?: Record<string, string | undefined> },
  ): Promise<{ exitCode: number }> {
    const { file, argv, windowsVerbatimArguments } = this.resolveInvocation(command, args);
    return new Promise((resolve, reject) => {
      const child = this.spawn(file, argv, {
        cwd: opts.cwd,
        env: opts.env,
        shell: false,
        stdio: 'inherit',
        windowsVerbatimArguments,
      });
      child.on('error', reject);
      child.on('close', (code) => resolve({ exitCode: code ?? 1 }));
    });
  }

  private resolveInvocation(
    command: string,
    args: readonly string[],
  ): { file: string; argv: string[]; windowsVerbatimArguments?: boolean } {
    if (this.platform === 'win32' && isWindowsBatch(command)) {
      // Quote each token so spaces in paths survive cmd parsing without enabling shell:true.
      const tokens = [command, ...args].map((t) => (/\s/.test(t) ? `"${t}"` : t));
      return {
        file: this.comSpec,
        argv: ['/d', '/s', '/c', ...tokens],
        windowsVerbatimArguments: true,
      };
    }
    return { file: command, argv: [...args] };
  }
}
