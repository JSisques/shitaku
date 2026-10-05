/**
 * How the running CLI was invoked. Shared by the update notice and (later) `shitaku upgrade`.
 * Detection gathers signals in the composition root; this module stays free of Node globals.
 */
export type InstallMethod = 'npx' | 'npm-global' | 'pnpm-global' | 'unknown';

/** Process signals the composition root may pass in; all fields optional except `binPath`. */
export interface InstallMethodSignals {
  npmCommand?: string;
  npmExecPath?: string;
  npmConfigUserAgent?: string;
  /** Path of the running entry script (typically argv index 1). */
  binPath: string;
}

export function upgradeCommand(method: InstallMethod): string {
  switch (method) {
    case 'npx':
      return 'npx @jsisques/shitaku@latest';
    case 'pnpm-global':
      return 'pnpm add -g @jsisques/shitaku';
    case 'npm-global':
    case 'unknown':
      return 'npm install -g @jsisques/shitaku';
  }
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').toLowerCase();
}

/** True when `path` looks like a pnpm global or dlx cache location. */
function isPnpmManagedPath(path: string): boolean {
  return (
    path.includes('/pnpm/global/') ||
    path.includes('/pnpm/dlx/') ||
    path.includes('/.local/share/pnpm/') ||
    /\/library\/pnpm\//.test(path)
  );
}

/**
 * Cheapest-signal-first heuristics from the issue notes. Defaults to `npm-global` when nothing
 * matches (a directly invoked global bin typically has no `npm_*` env vars).
 */
export function detectInstallMethod(signals: InstallMethodSignals): InstallMethod {
  const execPath = normalizePath(signals.npmExecPath ?? '');
  const binPath = normalizePath(signals.binPath);
  const userAgent = (signals.npmConfigUserAgent ?? '').toLowerCase();

  if (signals.npmCommand === 'exec' && execPath.includes('npx-cli.js')) return 'npx';
  if (binPath.includes('/_npx/')) return 'npx';
  if (isPnpmManagedPath(binPath)) return 'pnpm-global';
  if (userAgent.startsWith('pnpm/')) return 'pnpm-global';
  if (userAgent.startsWith('npm/') && signals.npmCommand === 'exec') return 'npx';
  return 'npm-global';
}
