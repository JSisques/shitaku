import { hashEntry, sha256, treeHash } from '@/domain/hash.js';
import { ConfigError, readAtPath } from '@/domain/json-merge.js';
import type { OwnedItem } from '@/domain/manifest.js';
import type { Desired, Observed } from '@/domain/plan/status-plan.js';
import type { AgentTarget } from '@/ports/agent-target.js';
import type { LoadedCatalog } from '@/ports/catalog-source.js';
import { UnsafeTreeError, type FileSystem } from '@/ports/file-system.js';
import { readPresent } from './skill-tree.js';

export interface InstalledDeps {
  fs: FileSystem;
  target: AgentTarget;
}

/** What is on disk for one owned item. `config` describes the MCP config file; skills/scripts/commands always report `present`. */
export interface InstalledObservation {
  config: 'present' | 'missing' | 'unreadable';
  current: Observed;
  /** The installed MCP entry, when there is one. */
  entry?: unknown;
}

/** The servers object of a config file, `missing` when the file does not exist, or `unreadable` when it cannot be parsed. */
type ConfigEntries = Record<string, unknown> | 'missing' | 'unreadable';

const UNREADABLE: Observed = { kind: 'unreadable' };
const ABSENT: Observed = { kind: 'absent' };

/** Filesystem errors that mean a path exists but cannot be read as expected. */
const UNREADABLE_CODES = new Set(['EACCES', 'EPERM', 'ENOTDIR', 'EISDIR', 'ELOOP']);

/** Failures that make one item unreadable. Anything else is a real fault and propagates. */
export function isUnreadable(error: unknown): boolean {
  if (error instanceof UnsafeTreeError || error instanceof ConfigError) return true;
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return code !== undefined && UNREADABLE_CODES.has(code);
}

/**
 * Builds a reader of what is installed for each owned item. Config files are read once and shared between the items
 * that live in them. Never writes.
 */
export function observeInstalled(deps: InstalledDeps): (item: OwnedItem) => Promise<InstalledObservation> {
  const configs = new Map<string, Promise<ConfigEntries>>();
  const readConfig = (item: OwnedItem): Promise<ConfigEntries> => {
    const configKey = JSON.stringify([item.scope, item.path]);
    let entries = configs.get(configKey);
    if (entries === undefined) {
      entries = deps.fs
        .readText(item.path)
        .then((text) =>
          text === null ? ('missing' as const) : readAtPath(text, deps.target.serversKeyPath(item.scope)),
        )
        .catch((error: unknown) => {
          if (isUnreadable(error)) return 'unreadable' as const;
          throw error;
        });
      configs.set(configKey, entries);
    }
    return entries;
  };

  const observeMcp = async (item: OwnedItem): Promise<InstalledObservation> => {
    const entries = await readConfig(item);
    if (entries === 'unreadable') return { config: 'unreadable', current: UNREADABLE };
    if (entries === 'missing') return { config: 'missing', current: ABSENT };
    const entry = entries[item.name];
    return entry === undefined
      ? { config: 'present', current: ABSENT }
      : { config: 'present', current: { kind: 'hash', hash: hashEntry(entry) }, entry };
  };

  const observeTree = async (item: OwnedItem): Promise<InstalledObservation> => {
    try {
      const files = await readPresent(deps.fs, item.path);
      const hash = files === null ? null : treeHash(files);
      return { config: 'present', current: hash === null ? ABSENT : { kind: 'hash', hash } };
    } catch (error) {
      if (isUnreadable(error)) return { config: 'present', current: UNREADABLE };
      throw error;
    }
  };

  /** A command is one file: read as bytes, never walked as a tree, so a directory or symlink there is only `unreadable`. */
  const observeFile = async (item: OwnedItem): Promise<InstalledObservation> => {
    try {
      const bytes = await deps.fs.readBytes(item.path);
      return { config: 'present', current: bytes === null ? ABSENT : { kind: 'hash', hash: sha256(bytes) } };
    } catch (error) {
      if (isUnreadable(error)) return { config: 'present', current: UNREADABLE };
      throw error;
    }
  };

  return (item) =>
    item.kind === 'mcp' ? observeMcp(item) : item.kind === 'command' ? observeFile(item) : observeTree(item);
}

/** What the catalog says the item should currently be, or `unavailable` when the catalog could not be loaded. */
export function desiredFor(catalog: LoadedCatalog | null, target: AgentTarget, item: OwnedItem): Desired {
  if (catalog === null) return { kind: 'unavailable' };
  if (item.kind === 'mcp') {
    const mcp = catalog.mcps.find((m) => m.name === item.name);
    return mcp !== undefined && target.supports(mcp)
      ? { kind: 'hash', hash: hashEntry(target.toEntry(mcp)) }
      : { kind: 'absent' };
  }
  if (item.kind === 'command') {
    const command = catalog.commands.find((c) => c.name === item.name);
    return command === undefined ? { kind: 'absent' } : { kind: 'hash', hash: sha256(command.bytes) };
  }
  if (item.kind === 'script') {
    const hash = treeHash(catalog.scripts.find((s) => s.name === item.name)?.files ?? []);
    return hash === null ? { kind: 'absent' } : { kind: 'hash', hash };
  }
  const hash = treeHash(catalog.skills.find((s) => s.name === item.name)?.files ?? []);
  return hash === null ? { kind: 'absent' } : { kind: 'hash', hash };
}
