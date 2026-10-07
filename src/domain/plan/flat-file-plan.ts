import { sha256 } from '@/domain/hash.js';
import type { Action } from '@/domain/plan/change-plan.js';
import { classifyOwned } from '@/domain/plan/classify.js';
import type { Scope } from '@/ports/agent-target.js';

/** The plan for one single-file item (a command today); the hash of a file is the sha256 of its bytes. */
export interface FlatFileChange {
  name: string;
  /** Absolute path of the file. */
  path: string;
  scope: Scope;
  action: Action;
  reason?: string;
  /** The bytes of the catalog version, the ones an install writes. */
  bytes: Uint8Array;
  /** What the file holds now; null when it is absent. Kept so an apply can back the bytes up. */
  present: Uint8Array | null;
  desiredHash: string;
  /** sha256 of `present`; null when the file is absent. */
  presentHash: string | null;
}

export interface FlatFilePlanEntry {
  name: string;
  path: string;
  scope: Scope;
  bytes: Uint8Array;
  present: Uint8Array | null;
}

export interface BuildFlatFilePlanInput {
  entries: FlatFilePlanEntry[];
  /** file path -> hash of the version shitaku last installed there (derived from the manifest). */
  owned: Record<string, string>;
  /** Names the kind in conflict reasons, e.g. "command". */
  noun: string;
  /** Replace a differing file even when shitaku does not own it. */
  force?: boolean;
}

export function buildFlatFilePlan({ entries, owned, noun, force = false }: BuildFlatFilePlanInput): FlatFileChange[] {
  return entries.map(({ name, path, scope, bytes, present }): FlatFileChange => {
    const desiredHash = sha256(bytes);
    const presentHash = present === null ? null : sha256(present);
    const decision = classifyOwned(presentHash, desiredHash, owned[path], force, noun);
    return { name, path, scope, ...decision, bytes, present, desiredHash, presentHash };
  });
}
