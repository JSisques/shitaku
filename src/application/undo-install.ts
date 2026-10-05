import { sha256 } from '@/domain/hash.js';
import type { Install, InstalledFile, Manifest } from '@/domain/manifest.js';
import { UnsafeTreeError, type FileSystem } from '@/ports/file-system.js';
import type { Paths } from '@/ports/paths.js';
import { loadManifest, saveManifest, stateDir } from './journal.js';

export interface UndoDeps {
  fs: FileSystem;
  paths: Paths;
  /** Clock for `undoneAt`; defaults to the system clock. */
  now?: () => Date;
}

export interface UndoRequest {
  /** Install to undo; defaults to the newest non-undone one. */
  id?: string;
  force?: boolean;
  dryRun?: boolean;
}

export interface UndoResult {
  status: 'nothing' | 'already-undone' | 'dry-run' | 'refused' | 'undone';
  /** 3 when a file changed since the install and `force` is not set, otherwise 0. */
  exitCode: 0 | 3;
  installId?: string;
  /** Files the install touched. */
  files: string[];
  /** Files whose current content no longer matches what the install wrote. */
  changed: string[];
}

/** The requested install is unknown, or a newer install still owns one of its files. */
export class UndoSelectionError extends Error {}
/** A restore did not produce the bytes recorded before the install. */
export class UndoVerifyError extends Error {}

const result = (status: UndoResult['status'], install?: Install, changed: string[] = []): UndoResult => ({
  status,
  exitCode: status === 'refused' ? 3 : 0,
  installId: install?.id,
  files: install?.files.map((f) => f.path) ?? [],
  changed,
});

const treeRoots = (install: Install): Set<string> =>
  new Set(
    install.files.flatMap((f) => f.items.flatMap((i) => (i.kind === 'skill' || i.kind === 'script' ? [i.root] : []))),
  );

/** Script install roots only — ADR-2 cleans runtime `node_modules` here, not under skills. */
const scriptRoots = (install: Install): Set<string> =>
  new Set(install.files.flatMap((f) => f.items.flatMap((i) => (i.kind === 'script' ? [i.root] : []))));

/** LIFO per file and per skill/script root: refuse while a newer non-undone install touched the same file or tree. */
function assertNewestPerFile(manifest: Manifest, install: Install): void {
  const newer = manifest.installs.slice(manifest.installs.indexOf(install) + 1).filter((i) => i.undoneAt === null);
  const roots = treeRoots(install);
  for (const file of install.files) {
    const blocker = newer.find((i) => i.files.some((f) => f.path === file.path));
    if (blocker) throw new UndoSelectionError(`${file.path} has a newer install (${blocker.id}); undo that one first`);
  }
  for (const root of roots) {
    const blocker = newer.find((i) => treeRoots(i).has(root));
    if (blocker) throw new UndoSelectionError(`${root} has a newer install (${blocker.id}); undo that one first`);
  }
}

const hashOf = (data: string | Uint8Array | null): string | null => (data === null ? null : sha256(data));

/** Skill and script files are raw bytes; MCP config files stay text. */
const isTreeFile = (file: InstalledFile): boolean => file.items.some((i) => i.kind === 'skill' || i.kind === 'script');

const currentHash = async (deps: UndoDeps, file: InstalledFile): Promise<string | null> =>
  hashOf(isTreeFile(file) ? await deps.fs.readBytes(file.path) : await deps.fs.readText(file.path));

/** Like `currentHash`, but a file that is unsafe on the current tree (a symlink, a special file) counts as drift. */
const UNSAFE = Symbol('unsafe');
async function driftHash(deps: UndoDeps, file: InstalledFile): Promise<string | null | typeof UNSAFE> {
  try {
    return await currentHash(deps, file);
  } catch (e) {
    if (e instanceof UnsafeTreeError) return UNSAFE;
    throw e;
  }
}

async function restore(deps: UndoDeps, file: InstalledFile): Promise<void> {
  const backupPath = file.backup === null ? null : `${stateDir(deps.paths.homeDir)}/${file.backup}`;
  if (backupPath === null) {
    await deps.fs.remove(file.path);
  } else if (isTreeFile(file)) {
    const bytes = await deps.fs.readBytes(backupPath);
    if (bytes === null) throw new UndoVerifyError(`backup for ${file.path} is missing`);
    await deps.fs.writeBytes(file.path, bytes);
  } else {
    const text = await deps.fs.readText(backupPath);
    if (text === null) throw new UndoVerifyError(`backup for ${file.path} is missing`);
    await deps.fs.writeAtomic(file.path, text);
  }
  if ((await currentHash(deps, file)) !== file.beforeHash)
    throw new UndoVerifyError(`${file.path} does not match its pre-install content after restore`);
}

/** Files under a skill/script root that the install did not record: user additions. */
async function unrecordedFiles(deps: UndoDeps, install: Install): Promise<string[]> {
  const recorded = new Set(install.files.map((f) => f.path));
  const extra: string[] = [];
  for (const root of treeRoots(install))
    try {
      for (const rel of (await deps.fs.listFiles(root)) ?? [])
        if (!recorded.has(`${root}/${rel}`)) extra.push(`${root}/${rel}`);
    } catch (e) {
      // A symlink or special file inside the tree: the tree can no longer be proven ours, so report the root.
      if (!(e instanceof UnsafeTreeError)) throw e;
      extra.push(root);
    }
  return extra;
}

/** Every backup the undo reads must exist before the first mutation, so a refusal leaves everything in place. */
async function assertBackupsPresent(deps: UndoDeps, install: Install): Promise<void> {
  for (const file of install.files) {
    if (file.backup === null) continue;
    if (!(await deps.fs.exists(`${stateDir(deps.paths.homeDir)}/${file.backup}`)))
      throw new UndoVerifyError(`backup for ${file.path} is missing; nothing was changed`);
  }
}

/**
 * Only directories the install can have created are pruned: a recorded skill/script root, one of its ancestors or one of
 * its subdirectories, that lies strictly inside the home or working directory. Anything else in a tampered manifest is ignored.
 */
function prunableDirs(deps: UndoDeps, install: Install): string[] {
  const { homeDir, cwd } = deps.paths;
  const roots = [...treeRoots(install)];
  const inside = (dir: string, base: string): boolean => dir.startsWith(`${base}/`);
  return install.createdDirs.filter(
    (dir) =>
      (inside(dir, homeDir) || inside(dir, cwd)) &&
      roots.some((root) => root === dir || root.startsWith(`${dir}/`) || dir.startsWith(`${root}/`)),
  );
}

export async function undoInstall(deps: UndoDeps, req: UndoRequest = {}): Promise<UndoResult> {
  const { homeDir } = deps.paths;
  const manifest = await loadManifest(deps.fs, homeDir);
  const install =
    req.id === undefined
      ? [...manifest.installs].reverse().find((i) => i.undoneAt === null)
      : manifest.installs.find((i) => i.id === req.id);
  if (req.id !== undefined && !install) throw new UndoSelectionError(`no install with id ${req.id}`);
  if (!install) return result('nothing');
  if (install.undoneAt !== null) return result('already-undone', install);
  assertNewestPerFile(manifest, install);

  const changed: string[] = [];
  for (const file of install.files) if ((await driftHash(deps, file)) !== file.afterHash) changed.push(file.path);
  changed.push(...(await unrecordedFiles(deps, install)));
  if (changed.length > 0 && !req.force) return result('refused', install, changed);
  if (req.dryRun) return result('dry-run', install, changed);

  await assertBackupsPresent(deps, install);
  for (const file of install.files) await restore(deps, file);
  // ADR-2: drop runtime script deps so pruned roots are not blocked by node_modules.
  for (const root of scriptRoots(install)) await deps.fs.remove(`${root}/node_modules`);
  // Non-recursive and deepest first: a directory that still holds a user file is skipped, never emptied.
  for (const dir of prunableDirs(deps, install).reverse()) await deps.fs.removeDir(dir);
  const undoneAt = (deps.now ?? (() => new Date()))().toISOString();
  await saveManifest(deps.fs, homeDir, {
    ...manifest,
    installs: manifest.installs.map((i) => (i === install ? { ...i, undoneAt } : i)),
  });
  return result('undone', install, changed);
}
