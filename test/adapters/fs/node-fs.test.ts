import { execFileSync } from 'node:child_process';
import { chmod, mkdir, readdir, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NodeFileSystem } from '@/adapters/fs/node-fs.js';
import { MAX_FILE_BYTES } from '@/domain/catalog/limits.js';
import { UnsafeTreeError } from '@/ports/file-system.js';
import { makeTmpPaths, type TmpPaths } from '@test/helpers/tmp-paths.js';

describe('NodeFileSystem', () => {
  let tmp: TmpPaths;
  const fs = new NodeFileSystem();
  beforeEach(async () => {
    tmp = await makeTmpPaths();
  });
  afterEach(() => tmp.cleanup());

  it('returns null for a missing file', async () => {
    expect(await fs.readText(join(tmp.cwd, 'nope.json'))).toBeNull();
  });

  it('creates parent directories and leaves no temp files', async () => {
    const file = join(tmp.cwd, 'a', 'b', 'x.json');
    await fs.writeAtomic(file, '{}\n');
    expect(await fs.readText(file)).toBe('{}\n');
    expect(await readdir(join(tmp.cwd, 'a', 'b'))).toEqual(['x.json']);
  });

  it('keeps the mode of an existing file', async () => {
    const file = join(tmp.cwd, 'x.json');
    await writeFile(file, 'old');
    await chmod(file, 0o600);
    await fs.writeAtomic(file, 'new');
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(await readFile(file, 'utf8')).toBe('new');
  });

  it('reports a failed rename, keeps the target intact and removes the temp file', async () => {
    const target = join(tmp.cwd, 'dir-target');
    await mkdir(target);
    await writeFile(join(target, 'keep'), 'data');
    await expect(fs.writeAtomic(target, 'x')).rejects.toThrow();
    expect(await readFile(join(target, 'keep'), 'utf8')).toBe('data');
    expect(await readdir(tmp.cwd)).toEqual(['dir-target']);
  });

  it('removes files and tolerates missing ones', async () => {
    const file = join(tmp.cwd, 'x.json');
    await writeFile(file, 'x');
    await fs.remove(file);
    await fs.remove(file);
    expect(await fs.readText(file)).toBeNull();
  });

  it('reads bytes and returns null for a missing file', async () => {
    const file = join(tmp.cwd, 'a.bin');
    await writeFile(file, new Uint8Array([0, 200, 1]));
    expect(Array.from((await fs.readBytes(file)) ?? [])).toEqual([0, 200, 1]);
    expect(await fs.readBytes(join(tmp.cwd, 'nope.bin'))).toBeNull();
  });

  it('refuses to read through a symlink and rejects a special file or oversized file', async () => {
    await writeFile(join(tmp.cwd, 'real.md'), 'x');
    await symlink(join(tmp.cwd, 'real.md'), join(tmp.cwd, 'link.md'));
    await expect(fs.readBytes(join(tmp.cwd, 'link.md'))).rejects.toThrow(UnsafeTreeError);
    await mkdir(join(tmp.cwd, 'dir'));
    await expect(fs.readBytes(join(tmp.cwd, 'dir'))).rejects.toThrow(UnsafeTreeError);
    await writeFile(join(tmp.cwd, 'big.bin'), new Uint8Array(MAX_FILE_BYTES + 1));
    await expect(fs.readBytes(join(tmp.cwd, 'big.bin'))).rejects.toThrow(UnsafeTreeError);
  });

  it.skipIf(process.platform === 'win32')('rejects a named pipe without blocking on it', async () => {
    const pipe = join(tmp.cwd, 'pipe.md');
    execFileSync('mkfifo', [pipe]);
    const timeout = new Promise((resolve) => {
      setTimeout(() => resolve('blocked'), 1000).unref();
    });
    const outcome = await Promise.race([fs.readBytes(pipe).then(String, (e: unknown) => e), timeout]);
    expect(outcome).toBeInstanceOf(UnsafeTreeError);
  });

  it('lists regular files as sorted relative paths and null for a missing dir', async () => {
    await mkdir(join(tmp.cwd, 'd', 'sub'), { recursive: true });
    await writeFile(join(tmp.cwd, 'd', 'z.md'), 'z');
    await writeFile(join(tmp.cwd, 'd', 'sub', 'a.md'), 'a');
    expect(await fs.listFiles(join(tmp.cwd, 'd'))).toEqual(['sub/a.md', 'z.md']);
    expect(await fs.listFiles(join(tmp.cwd, 'missing'))).toBeNull();
  });

  it('refuses to list a tree that contains a symlink', async () => {
    await mkdir(join(tmp.cwd, 'd'));
    await writeFile(join(tmp.cwd, 'real.md'), 'r');
    await symlink(join(tmp.cwd, 'real.md'), join(tmp.cwd, 'd', 'link.md'));
    await expect(fs.listFiles(join(tmp.cwd, 'd'))).rejects.toThrow(UnsafeTreeError);
  });

  it('writes bytes via a temp file with mode 0644, creating parents and leaving no temp files', async () => {
    const file = join(tmp.cwd, 'a', 'b', 'x.bin');
    await fs.writeBytes(file, new Uint8Array([0, 255, 7]));
    expect(Array.from((await fs.readBytes(file)) ?? [])).toEqual([0, 255, 7]);
    expect((await stat(file)).mode & 0o777).toBe(0o644);
    expect(await readdir(join(tmp.cwd, 'a', 'b'))).toEqual(['x.bin']);
  });

  it('replaces existing bytes on write and cleans up the temp file when the rename fails', async () => {
    const file = join(tmp.cwd, 'x.bin');
    await fs.writeBytes(file, new Uint8Array([1]));
    await fs.writeBytes(file, new Uint8Array([2, 3]));
    expect(Array.from((await fs.readBytes(file)) ?? [])).toEqual([2, 3]);
    const dirTarget = join(tmp.cwd, 'dir-target');
    await mkdir(dirTarget);
    await writeFile(join(dirTarget, 'keep'), 'data');
    await expect(fs.writeBytes(dirTarget, new Uint8Array([1]))).rejects.toThrow();
    expect((await readdir(tmp.cwd)).sort()).toEqual(['dir-target', 'x.bin']);
  });

  it('reports whether a path exists', async () => {
    await writeFile(join(tmp.cwd, 'f'), 'x');
    await mkdir(join(tmp.cwd, 'd'));
    expect(await fs.exists(join(tmp.cwd, 'f'))).toBe(true);
    expect(await fs.exists(join(tmp.cwd, 'd'))).toBe(true);
    expect(await fs.exists(join(tmp.cwd, 'nope'))).toBe(false);
  });

  it('removes an empty directory and returns true', async () => {
    await mkdir(join(tmp.cwd, 'd'));
    expect(await fs.removeDir(join(tmp.cwd, 'd'))).toBe(true);
    expect(await fs.exists(join(tmp.cwd, 'd'))).toBe(false);
  });

  it('never removes user files: a non-empty directory returns false and stays intact', async () => {
    await mkdir(join(tmp.cwd, 'd'));
    await writeFile(join(tmp.cwd, 'd', 'user.md'), 'mine');
    expect(await fs.removeDir(join(tmp.cwd, 'd'))).toBe(false);
    expect(await fs.readText(join(tmp.cwd, 'd', 'user.md'))).toBe('mine');
  });

  it('returns false when the directory is missing', async () => {
    expect(await fs.removeDir(join(tmp.cwd, 'nope'))).toBe(false);
  });
});
