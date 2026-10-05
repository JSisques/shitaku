/** Spawns a subprocess without a shell; returns only the exit code. */
export interface ProcessRunner {
  run(
    command: string,
    args: readonly string[],
    opts: {
      cwd: string;
      env?: Record<string, string | undefined>;
    },
  ): Promise<{ exitCode: number }>;
}
