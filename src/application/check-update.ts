import { stateDir } from '@/application/journal.js';
import type { InstallMethod } from '@/domain/install-method.js';
import { isNewer, isStale, isTruthyFlag, parseUpdateCache, updateNotice, type UpdateCache } from '@/domain/update.js';
import type { FileSystem } from '@/ports/file-system.js';
import type { Paths } from '@/ports/paths.js';
import type { LatestVersionSource } from '@/ports/version-source.js';

const DEFAULT_TIMEOUT_MS = 1500;

export const updateCachePath = (homeDir: string): string => `${stateDir(homeDir)}/update-check.json`;

export interface UpdateCheckDeps {
  fs: FileSystem;
  paths: Paths;
  env: Record<string, string | undefined>;
  source: LatestVersionSource;
  now?: () => Date;
}

export interface UpdateCheckRequest {
  currentVersion: string;
  interactive: boolean;
  /** How this CLI was installed; defaults to `unknown` (npm global upgrade hint). */
  installMethod?: InstallMethod;
  timeoutMs?: number;
}

/** Resolves to the source's answer, or null once `signal` aborts, even if the source ignores it. */
function withAbort(source: LatestVersionSource, signal: AbortSignal): Promise<string | null> {
  return new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => resolve(null), { once: true });
    source.latest(signal).then(resolve, reject);
  });
}

async function refresh(
  deps: UpdateCheckDeps,
  previous: UpdateCache | null,
  now: Date,
  timeoutMs: number,
): Promise<string | null> {
  const fetched = await withAbort(deps.source, AbortSignal.timeout(timeoutMs)).catch(() => null);
  const latest = fetched ?? previous?.latest ?? null;
  const next: UpdateCache = { checkedAt: now.toISOString(), latest };
  await deps.fs
    .writeAtomic(updateCachePath(deps.paths.homeDir), `${JSON.stringify(next, null, 2)}\n`)
    .catch(() => undefined);
  return latest;
}

/**
 * Resolves to the one-line update notice, or null when there is nothing to say. Never rejects: every failure
 * (cache, network, timeout) means "no notice".
 */
export async function checkForUpdate(deps: UpdateCheckDeps, req: UpdateCheckRequest): Promise<string | null> {
  try {
    if (isTruthyFlag(deps.env.SHITAKU_NO_UPDATE_CHECK) || (deps.env.CI ?? '') !== '' || !req.interactive) return null;
    const now = (deps.now ?? (() => new Date()))();
    const text = await deps.fs.readText(updateCachePath(deps.paths.homeDir));
    const cache = text === null ? null : parseUpdateCache(text);
    const latest = isStale(cache, now)
      ? await refresh(deps, cache, now, req.timeoutMs ?? DEFAULT_TIMEOUT_MS)
      : (cache?.latest ?? null);
    return latest !== null && isNewer(req.currentVersion, latest)
      ? updateNotice(req.currentVersion, latest, req.installMethod ?? 'unknown')
      : null;
  } catch {
    return null;
  }
}
