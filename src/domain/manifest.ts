import { z } from 'zod';
import type { Scope } from '@/ports/agent-target.js';

export class ManifestError extends Error {}

const TreeItemSchema = z.object({
  name: z.string(),
  action: z.enum(['create', 'update', 'remove']),
  /** Tree hash of the item as installed. */
  entryHash: z.string(),
  /** Absolute path of the item directory. */
  root: z.string(),
});

const HandlerSchema = z.record(z.string(), z.unknown());

const ItemSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('mcp'),
    name: z.string(),
    action: z.enum(['create', 'update', 'remove']),
    entryHash: z.string(),
  }),
  TreeItemSchema.extend({ kind: z.literal('skill') }),
  TreeItemSchema.extend({ kind: z.literal('script') }),
  /** A command is one file, so `root` is the file path itself. */
  TreeItemSchema.extend({ kind: z.literal('command') }),
  /** A hook is one handler inside the settings file, so it has no `root`: the file path is the owning file's. */
  z.object({
    kind: z.literal('hook'),
    name: z.string(),
    action: z.enum(['create', 'update', 'remove']),
    /** Hash of `{ event, matcher, handler }`. */
    entryHash: z.string(),
    event: z.string(),
    /** Null when the group has no `matcher` key. */
    matcher: z.string().nullable(),
    handler: HandlerSchema,
    /** The handler an update replaced. */
    previous: HandlerSchema.optional(),
    /** Whether the install created the event array / the matcher group; only those may be dropped again. */
    createdEvent: z.boolean(),
    createdGroup: z.boolean(),
  }),
]);

const FileSchema = z
  .object({
    path: z.string(),
    scope: z.enum(['project', 'user']),
    /** Path relative to the shitaku state directory; null when the file did not exist before the install. */
    backup: z.string().nullable(),
    beforeHash: z.string().nullable(),
    /** Null when the install deleted the file (a file of an older skill/script version that the new one drops). */
    afterHash: z.string().nullable(),
    items: z.array(ItemSchema),
  })
  .refine(
    (f) =>
      f.afterHash !== null || f.items.every((i) => i.kind === 'skill' || i.kind === 'script' || i.kind === 'command'),
    {
      message: 'afterHash may be null only for skill, script or command files',
      path: ['afterHash'],
    },
  );

const InstallSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  undoneAt: z.string().nullable(),
  source: z.object({ kind: z.enum(['bundled', 'folder']), location: z.string(), catalogVersion: z.number() }),
  files: z.array(FileSchema),
  /** Directories the install created, parents first. Absent in manifests written before skills existed. */
  createdDirs: z.array(z.string()).default([]),
});

export const ManifestSchema = z.object({ version: z.literal(1), installs: z.array(InstallSchema) });

export type Manifest = z.infer<typeof ManifestSchema>;
export type Install = z.infer<typeof InstallSchema>;
export type InstalledFile = z.infer<typeof FileSchema>;

export const emptyManifest = (): Manifest => ({ version: 1, installs: [] });

export function parseManifest(text: string): Manifest {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new ManifestError(`manifest is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  const parsed = ManifestSchema.safeParse(raw);
  if (!parsed.success) throw new ManifestError(`manifest is invalid: ${parsed.error.message}`);
  return parsed.data;
}

/** file path -> entry name -> hash of the entry shitaku last wrote. Undone installs do not count. */
export type Ownership = Record<string, Record<string, string>>;

/** Replays the non-undone installs in order, so a later install replaces an earlier hash. */
export function deriveOwnership(manifest: Manifest): Ownership {
  const owned: Ownership = {};
  for (const install of manifest.installs.filter((i) => i.undoneAt === null)) {
    for (const file of install.files) {
      for (const item of file.items) {
        if (item.kind !== 'mcp') continue;
        if (item.action === 'remove') {
          delete owned[file.path]?.[item.name];
          if (Object.keys(owned[file.path] ?? {}).length === 0) delete owned[file.path];
        } else (owned[file.path] ??= {})[item.name] = item.entryHash;
      }
    }
  }
  return owned;
}

function deriveTreeOwnership(manifest: Manifest, kind: 'skill' | 'script' | 'command'): Record<string, string> {
  const owned: Record<string, string> = {};
  for (const install of manifest.installs.filter((i) => i.undoneAt === null)) {
    for (const file of install.files) {
      for (const item of file.items) {
        if (item.kind !== kind) continue;
        if (item.action === 'remove') delete owned[item.root];
        else owned[item.root] = item.entryHash;
      }
    }
  }
  return owned;
}

/** skill root directory -> tree hash of the skill shitaku last installed there. Undone installs do not count. */
export function deriveSkillOwnership(manifest: Manifest): Record<string, string> {
  return deriveTreeOwnership(manifest, 'skill');
}

/** script root directory -> tree hash of the script shitaku last installed there. Undone installs do not count. */
export function deriveScriptOwnership(manifest: Manifest): Record<string, string> {
  return deriveTreeOwnership(manifest, 'script');
}

/** command file path -> hash of the command shitaku last installed there. Undone installs do not count. */
export function deriveCommandOwnership(manifest: Manifest): Record<string, string> {
  return deriveTreeOwnership(manifest, 'command');
}

type HookItem = Extract<z.infer<typeof ItemSchema>, { kind: 'hook' }>;

/** What shitaku last wrote for one hook; the located handler is the canonical `handler`. */
export type OwnedHook = Pick<HookItem, 'entryHash' | 'event' | 'matcher' | 'handler' | 'createdEvent' | 'createdGroup'>;

/** settings file path -> hook name -> the hook shitaku last wrote there. Undone installs do not count. */
export function deriveHookOwnership(manifest: Manifest): Record<string, Record<string, OwnedHook>> {
  const owned: Record<string, Record<string, OwnedHook>> = {};
  for (const install of manifest.installs.filter((i) => i.undoneAt === null)) {
    for (const file of install.files) {
      for (const item of file.items) {
        if (item.kind !== 'hook') continue;
        if (item.action === 'remove') {
          delete owned[file.path]?.[item.name];
          if (Object.keys(owned[file.path] ?? {}).length === 0) delete owned[file.path];
        } else {
          const { entryHash, event, matcher, handler, createdEvent, createdGroup } = item;
          (owned[file.path] ??= {})[item.name] = { entryHash, event, matcher, handler, createdEvent, createdGroup };
        }
      }
    }
  }
  return owned;
}

/** One item shitaku currently owns, with the hash it last wrote and the install that wrote it. */
export interface OwnedItem {
  kind: 'mcp' | 'skill' | 'script' | 'command' | 'hook';
  scope: Scope;
  /** Config file for an MCP, directory for a skill/script, file for a command, settings file for a hook. */
  path: string;
  name: string;
  hash: string;
  installId: string;
}

/** Replays the non-undone installs in order; the newest install of a scope + path + name wins and keeps its install id. */
export function deriveOwnedItems(manifest: Manifest): OwnedItem[] {
  const owned = new Map<string, OwnedItem>();
  for (const install of manifest.installs.filter((i) => i.undoneAt === null)) {
    for (const file of install.files) {
      for (const item of file.items) {
        const path = item.kind === 'mcp' || item.kind === 'hook' ? file.path : item.root;
        const key = JSON.stringify([file.scope, path, item.name]);
        if (item.action === 'remove') {
          owned.delete(key);
          continue;
        }
        owned.set(key, {
          kind: item.kind,
          scope: file.scope,
          path,
          name: item.name,
          hash: item.entryHash,
          installId: install.id,
        });
      }
    }
  }
  return [...owned.values()];
}
