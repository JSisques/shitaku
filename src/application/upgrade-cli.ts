import { isRunnableUpgrade, upgradeArgv, upgradeCommand, type InstallMethod } from '@/domain/install-method.js';
import { isNewer } from '@/domain/update.js';
import type { ProcessRunner } from '@/ports/process-runner.js';
import type { LatestVersionSource } from '@/ports/version-source.js';

const DEFAULT_TIMEOUT_MS = 10_000;

export interface UpgradeCliDeps {
  source: LatestVersionSource;
  runner: ProcessRunner;
  currentVersion: string;
  installMethod: InstallMethod;
  cwd: string;
  env?: Record<string, string | undefined>;
  out(line: string): void;
  err(line: string): void;
  /** Abort timeout for the fresh latest-version fetch; defaults to 10s. */
  timeoutMs?: number;
}

/** Resolves to the source's answer, or null once `signal` aborts, even if the source ignores it. */
function withAbort(source: LatestVersionSource, signal: AbortSignal): Promise<string | null> {
  return new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => resolve(null), { once: true });
    source.latest(signal).then(resolve, reject);
  });
}

/**
 * Self-updates the CLI package: fresh latest fetch, current→target messaging, then spawn
 * (npm/pnpm global) or print-only guidance (npx/unknown).
 */
export async function upgradeCli(deps: UpgradeCliDeps): Promise<number> {
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const latest = await withAbort(deps.source, AbortSignal.timeout(timeoutMs)).catch(() => null);

  if (latest === null) {
    deps.err('error: could not fetch the latest version; check your network and try again');
    return 1;
  }

  if (!isNewer(deps.currentVersion, latest)) {
    deps.out(`Already up to date (shitaku ${deps.currentVersion}).`);
    return 0;
  }

  deps.out(`Upgrading shitaku ${deps.currentVersion} → ${latest}`);

  if (!isRunnableUpgrade(deps.installMethod)) {
    deps.out(`Run: ${upgradeCommand(deps.installMethod)}`);
    return 0;
  }

  const { command, args } = upgradeArgv(deps.installMethod);
  const { exitCode } = await deps.runner.run(command, args, {
    cwd: deps.cwd,
    env: deps.env,
  });

  if (exitCode !== 0) {
    deps.err(
      `error: package manager exited with code ${exitCode}; install left unchanged. Retry manually: ${upgradeCommand(deps.installMethod)}`,
    );
    return exitCode;
  }

  return 0;
}
