import { constants } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { MAX_DEPTH, MAX_FILE_BYTES, MAX_SKILL_BYTES, MAX_SKILL_FILES } from '@/domain/catalog/limits.js';
import type { SkillFile } from '@/domain/catalog/skill.js';
import { UnsafeTreeError } from '@/ports/file-system.js';

interface Entry {
  rel: string;
  abs: string;
  size: number;
}

const isMissing = (e: unknown): boolean => (e as NodeJS.ErrnoException).code === 'ENOENT';

/** Rejects a relative path with a `..` segment, a backslash, a NUL byte, or one that is empty or absolute. */
export function assertSafeRelPath(rel: string): void {
  const unsafe = rel === '' || rel.startsWith('/') || /[\\\0]/.test(rel) || rel.split('/').includes('..');
  if (unsafe) throw new UnsafeTreeError(`unsafe path: ${JSON.stringify(rel)}`);
}

/** Walks `root` with lstat only. Missing root resolves to null; anything unsafe or over the limits rejects. */
async function scan(root: string): Promise<Entry[] | null> {
  try {
    const top = await lstat(root);
    if (top.isSymbolicLink()) throw new UnsafeTreeError(`${root} is a symbolic link`);
    if (!top.isDirectory()) throw new UnsafeTreeError(`${root} is not a directory`);
  } catch (e) {
    if (isMissing(e)) return null;
    throw e;
  }

  const entries: Entry[] = [];
  let total = 0;
  const visit = async (dir: string, prefix: string, depth: number): Promise<void> => {
    for (const name of (await readdir(dir)).sort()) {
      // ADR-2: runtime deps under a script install root must not count toward ownership walks.
      if (prefix === '' && name === 'node_modules') continue;
      const rel = prefix === '' ? name : `${prefix}/${name}`;
      assertSafeRelPath(rel);
      const abs = join(dir, name);
      const info = await lstat(abs);
      if (info.isSymbolicLink()) throw new UnsafeTreeError(`symbolic link not allowed: ${rel}`);
      if (info.isDirectory()) {
        if (depth + 1 > MAX_DEPTH) throw new UnsafeTreeError(`depth above ${MAX_DEPTH}: ${rel}`);
        await visit(abs, rel, depth + 1);
      } else if (info.isFile()) {
        if (info.size > MAX_FILE_BYTES) throw new UnsafeTreeError(`file size above ${MAX_FILE_BYTES} bytes: ${rel}`);
        total += info.size;
        if (total > MAX_SKILL_BYTES) throw new UnsafeTreeError(`total size above ${MAX_SKILL_BYTES} bytes`);
        entries.push({ rel, abs, size: info.size });
        if (entries.length > MAX_SKILL_FILES) throw new UnsafeTreeError(`file count above ${MAX_SKILL_FILES}`);
      } else {
        throw new UnsafeTreeError(`special file not allowed: ${rel}`);
      }
    }
  };
  await visit(root, '', 0);
  return entries.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
}

export async function listTree(root: string): Promise<string[] | null> {
  return (await scan(root))?.map((e) => e.rel) ?? null;
}

/**
 * Reads one regular file without following a symlink at the final component (O_NOFOLLOW), checking on the opened
 * handle that it is still a regular file within the size limit. Resolves to null only when the file is missing.
 */
export async function readFileNoFollow(abs: string, label: string): Promise<Uint8Array | null> {
  let handle;
  try {
    handle = await open(abs, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return null;
    if (code === 'ELOOP') throw new UnsafeTreeError(`symbolic link not allowed: ${label}`);
    throw e;
  }
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new UnsafeTreeError(`special file not allowed: ${label}`);
    if (info.size > MAX_FILE_BYTES) throw new UnsafeTreeError(`file size above ${MAX_FILE_BYTES} bytes: ${label}`);
    const bytes = new Uint8Array(await handle.readFile());
    if (bytes.length > MAX_FILE_BYTES) throw new UnsafeTreeError(`file size above ${MAX_FILE_BYTES} bytes: ${label}`);
    return bytes;
  } finally {
    await handle.close();
  }
}

/**
 * Reads every file of a tree as bytes. When `expectedReal` is given, the real path of `root` must equal it, so a
 * symlinked parent cannot redirect the read outside the catalog. Size is re-checked on the bytes actually read.
 */
export async function readTree(root: string, expectedReal?: string): Promise<SkillFile[] | null> {
  const entries = await scan(root);
  if (entries === null) return null;
  if (expectedReal !== undefined && (await realpath(root)) !== expectedReal) {
    throw new UnsafeTreeError(`${root} resolves outside ${expectedReal}`);
  }
  const files: SkillFile[] = [];
  for (const e of entries) {
    const bytes = await readFileNoFollow(e.abs, e.rel);
    if (bytes === null) throw new UnsafeTreeError(`file vanished while reading: ${e.rel}`);
    files.push({ path: e.rel, bytes });
  }
  return files;
}
