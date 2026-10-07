import { dirname } from 'node:path';
import type { SkillFile } from '@/domain/catalog/skill.js';
import { hashEntry, sha256, treeHash } from '@/domain/hash.js';
import { readAtPath, removeAtPath } from '@/domain/json-merge.js';
import { deriveOwnedItems, type Install, type Manifest, type OwnedItem } from '@/domain/manifest.js';
import type { AgentTarget, Scope } from '@/ports/agent-target.js';
import type { FileSystem } from '@/ports/file-system.js';
import type { Paths } from '@/ports/paths.js';
import {
  backupPath,
  newInstallId,
  restoreBytes,
  restoreText,
  rollback,
  StaleFileError,
} from './install-transaction.js';
import { appendInstall, loadManifest, scriptsDir, stateDir } from './journal.js';
import { readPresent } from './skill-tree.js';

export interface UninstallDeps {
  fs: FileSystem;
  target: AgentTarget;
  paths: Paths;
  /** Clock for install ids and timestamps; defaults to the system clock. */
  now?: () => Date;
}

export interface UninstallRequest {
  name: string;
  kind?: OwnedItem['kind'];
  scope?: Scope;
  force?: boolean;
  dryRun?: boolean;
}

export interface UninstallResult {
  status: 'removed' | 'already-absent' | 'dry-run' | 'refused';
  /** 3 when the item changed since install and `force` is not set, otherwise 0. */
  exitCode: 0 | 3;
  item: { kind: OwnedItem['kind']; scope: Scope; name: string; path: string };
  /** Files that are (or would be) changed or deleted. */
  files: string[];
  /** The current hash differs from the one shitaku recorded. */
  modified: boolean;
  /** Set when removed. */
  installId?: string;
}

/** The name is not owned, or it matches several owned items; `candidates` lists the latter. */
export class UninstallSelectionError extends Error {
  constructor(
    message: string,
    readonly candidates: OwnedItem[] = [],
  ) {
    super(message);
  }
}

const SKILL_ENTRY = 'SKILL.md';
const SCRIPT_ENTRY = 'index.mjs';

interface Plan {
  item: OwnedItem;
  source: Install['source'];
  status: UninstallResult['status'];
  modified: boolean;
  /** Hash of what is on disk now; null when the item is absent. */
  observed: string | null;
  /** MCP: the config text that was read. */
  text: string | null;
  /** Skill/script/command: the files to delete by absolute path, entry file first. */
  doomed: SkillFile[];
  files: string[];
}

/** Where the item must live for this target and working directory; a manifest path that differs never matches. */
const expectedPath = (deps: UninstallDeps, item: OwnedItem): string => {
  if (item.kind === 'mcp') return deps.target.configPath(item.scope, deps.paths);
  if (item.kind === 'skill') return `${deps.target.skillsDir(item.scope, deps.paths)}/${item.name}`;
  if (item.kind === 'command') return `${deps.target.commandsDir(item.scope, deps.paths)}/${item.name}.md`;
  return `${scriptsDir(item.scope, deps.paths)}/${item.name}`;
};

function resolve(deps: UninstallDeps, manifest: Manifest, req: UninstallRequest): OwnedItem {
  const matches = deriveOwnedItems(manifest).filter(
    (item) =>
      item.name === req.name &&
      (req.kind === undefined || item.kind === req.kind) &&
      (req.scope === undefined || item.scope === req.scope) &&
      item.path === expectedPath(deps, item),
  );
  if (matches.length === 0) throw new UninstallSelectionError(`'${req.name}' was not installed by shitaku`);
  if (matches.length > 1) {
    const list = matches.map((m) => `${m.kind} (${m.scope})`).join(', ');
    throw new UninstallSelectionError(`'${req.name}' is ambiguous: ${list}; narrow with --kind or --scope`, matches);
  }
  return matches[0]!;
}

/** Recorded files of the owning install that exist now, entry file first so a half-removed tree never loads. */
function doomedFiles(install: Install, item: OwnedItem, present: SkillFile[]): SkillFile[] {
  const recorded = new Set(
    install.files
      .filter(
        (f) =>
          f.afterHash !== null &&
          f.items.some((i) => (i.kind === 'skill' || i.kind === 'script') && i.root === item.path),
      )
      .map((f) => f.path),
  );
  const doomed = present.filter((f) => recorded.has(`${item.path}/${f.path}`));
  const entry = item.kind === 'script' ? SCRIPT_ENTRY : SKILL_ENTRY;
  return [...doomed.filter((f) => f.path === entry), ...doomed.filter((f) => f.path !== entry)];
}

async function planUninstall(deps: UninstallDeps, req: UninstallRequest): Promise<Plan> {
  const manifest = await loadManifest(deps.fs, deps.paths.homeDir);
  const item = resolve(deps, manifest, req);
  const install = manifest.installs.find((i) => i.id === item.installId)!;

  let observed: string | null;
  let plan: Pick<Plan, 'text' | 'doomed' | 'files'>;
  if (item.kind === 'mcp') {
    const text = await deps.fs.readText(item.path);
    const entry = readAtPath(text, deps.target.serversKeyPath(item.scope))[item.name];
    observed = entry === undefined ? null : hashEntry(entry);
    plan = { text, doomed: [], files: observed === null ? [] : [item.path] };
  } else if (item.kind === 'command') {
    const bytes = await deps.fs.readBytes(item.path);
    observed = bytes === null ? null : sha256(bytes);
    plan = {
      text: null,
      doomed: bytes === null ? [] : [{ path: item.path, bytes }],
      files: bytes === null ? [] : [item.path],
    };
  } else {
    const present = (await readPresent(deps.fs, item.path)) ?? [];
    observed = treeHash(present);
    const doomed = (observed === null ? [] : doomedFiles(install, item, present)).map((f) => ({
      path: `${item.path}/${f.path}`,
      bytes: f.bytes,
    }));
    plan = { text: null, doomed, files: doomed.map((f) => f.path) };
  }

  const modified = observed !== null && observed !== item.hash;
  // The refusal check precedes the dry-run check, so a dry run reports exactly what a real run would do.
  const status: Plan['status'] =
    observed === null ? 'already-absent' : modified && !req.force ? 'refused' : req.dryRun ? 'dry-run' : 'removed';
  return { item, source: install.source, ...plan, status, modified, observed };
}

/** Re-reads the item; any difference from the plan means someone else changed it, so nothing is touched. */
async function assertFresh(deps: UninstallDeps, plan: Plan): Promise<void> {
  const { item } = plan;
  let fresh: boolean;
  if (item.kind === 'mcp') fresh = (await deps.fs.readText(item.path)) === plan.text;
  else if (item.kind === 'command') {
    const bytes = await deps.fs.readBytes(item.path);
    fresh = (bytes === null ? null : sha256(bytes)) === plan.observed;
  } else fresh = treeHash((await readPresent(deps.fs, item.path)) ?? []) === plan.observed;
  if (!fresh) throw new StaleFileError(`${item.path} changed since planning, re-run`);
}

/** Directories inside the tree root that the deletions empty, deepest first. */
function emptiedDirs(root: string, paths: string[]): string[] {
  const dirs = new Set<string>();
  for (const path of paths) for (let dir = dirname(path); dir.length >= root.length; dir = dirname(dir)) dirs.add(dir);
  return [...dirs].sort((a, b) => b.length - a.length);
}

async function applyUninstall(deps: UninstallDeps, plan: Plan): Promise<string> {
  const { item } = plan;
  const { homeDir } = deps.paths;
  await assertFresh(deps, plan);

  const now = (deps.now ?? (() => new Date()))();
  const id = newInstallId(now);
  const state = stateDir(homeDir);
  const files: Install['files'] = [];
  const undo: (() => Promise<void>)[] = [];

  // Temporary (PR 3 of catalog-add-hooks): no install records a hook yet; PR 6 adds the hook uninstall branches.
  if (item.kind === 'hook') throw new Error('uninstalling a hook is not supported yet');

  if (item.kind === 'mcp') {
    const before = plan.text!;
    const backup = backupPath(id, 0, item.path);
    await deps.fs.writeAtomic(`${state}/${backup}`, before);
    const after = removeAtPath(before, deps.target.serversKeyPath(item.scope), [item.name]);
    files.push({
      path: item.path,
      scope: item.scope,
      backup,
      beforeHash: sha256(before),
      afterHash: sha256(after),
      items: [{ kind: 'mcp', name: item.name, action: 'remove', entryHash: plan.observed! }],
    });
    try {
      await deps.fs.writeAtomic(item.path, after);
      undo.push(() => restoreText(deps.fs, item.path, before));
      await journal(deps, id, now, plan, files);
    } catch (error) {
      throw await rollback(deps.fs, undo, [], error);
    }
    return id;
  }

  for (const [n, file] of plan.doomed.entries()) {
    const path = file.path;
    const backup = backupPath(id, n, path);
    await deps.fs.writeBytes(`${state}/${backup}`, file.bytes);
    files.push({
      path,
      scope: item.scope,
      backup,
      beforeHash: sha256(file.bytes),
      afterHash: null,
      items: [
        {
          kind: item.kind,
          name: item.name,
          action: 'remove',
          entryHash: plan.observed!,
          root: item.path,
        },
      ],
    });
  }
  try {
    for (const { path, bytes } of plan.doomed) {
      await deps.fs.remove(path);
      undo.push(() => restoreBytes(deps.fs, path, bytes));
    }
    // ADR-2: runtime install-root deps are never owned; drop them so the script root can empty.
    if (item.kind === 'script') await deps.fs.remove(`${item.path}/node_modules`);
    // Non-recursive: a directory that still holds a user file is skipped, never emptied.
    for (const dir of emptiedDirs(item.path, plan.files)) await deps.fs.removeDir(dir);
    await journal(deps, id, now, plan, files);
  } catch (error) {
    throw await rollback(deps.fs, undo, [], error);
  }
  return id;
}

const journal = (deps: UninstallDeps, id: string, now: Date, plan: Plan, files: Install['files']): Promise<void> =>
  appendInstall(deps.fs, deps.paths.homeDir, {
    id,
    createdAt: now.toISOString(),
    undoneAt: null,
    source: plan.source,
    files,
    createdDirs: [],
  });

/**
 * Removes one shitaku-owned MCP entry, skill, script or command and records the removal as an install, so `undo` reverts it.
 * Refuses (exit 3) an item that changed since install unless forced; never touches an item shitaku does not own.
 */
export async function uninstallItem(deps: UninstallDeps, req: UninstallRequest): Promise<UninstallResult> {
  const plan = await planUninstall(deps, req);
  const { item } = plan;
  const result: UninstallResult = {
    status: plan.status,
    exitCode: plan.status === 'refused' ? 3 : 0,
    item: { kind: item.kind, scope: item.scope, name: item.name, path: item.path },
    files: plan.files,
    modified: plan.modified,
  };
  if (plan.status !== 'removed') return result;
  return { ...result, installId: await applyUninstall(deps, plan) };
}
