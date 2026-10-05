import { z } from 'zod';
import { upgradeCommand, type InstallMethod } from '@/domain/install-method.js';

export const UPDATE_TTL_MS = 86_400_000;

const UpdateCacheSchema = z.object({ checkedAt: z.string(), latest: z.string().nullable() });

export type UpdateCache = z.infer<typeof UpdateCacheSchema>;

/** A corrupt or schema-invalid cache is reported as absent. */
export function parseUpdateCache(text: string): UpdateCache | null {
  try {
    const result = UpdateCacheSchema.safeParse(JSON.parse(text));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Absent, expired, unparsable or future-dated (bad clock) caches are stale. */
export function isStale(cache: UpdateCache | null, now: Date, ttlMs: number = UPDATE_TTL_MS): boolean {
  if (cache === null) return true;
  const age = now.getTime() - Date.parse(cache.checkedAt);
  return !(age >= 0 && age < ttlMs);
}

const VERSION = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

interface Parsed {
  core: [number, number, number];
  prerelease: boolean;
}

function parseVersion(version: string): Parsed | null {
  const match = VERSION.exec(version);
  if (match === null) return null;
  return { core: [Number(match[1]), Number(match[2]), Number(match[3])], prerelease: match[4] !== undefined };
}

/** Numeric x.y.z comparison; a prerelease is only older than its own stable. Invalid input is never newer. */
export function isNewer(current: string, candidate: string | null): boolean {
  if (candidate === null) return false;
  const a = parseVersion(current);
  const b = parseVersion(candidate);
  if (a === null || b === null) return false;
  for (let i = 0; i < 3; i++) {
    const x = a.core[i] ?? 0;
    const y = b.core[i] ?? 0;
    if (x !== y) return y > x;
  }
  return a.prerelease && !b.prerelease;
}

export function isTruthyFlag(value: string | undefined): boolean {
  return ['1', 'true', 'yes'].includes((value ?? '').trim().toLowerCase());
}

export function updateNotice(current: string, latest: string, method: InstallMethod = 'unknown'): string {
  return `Update available: shitaku ${current} -> ${latest}. Run: ${upgradeCommand(method)}`;
}
