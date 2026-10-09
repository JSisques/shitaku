import { randomBytes } from 'node:crypto';
import { mkdir, open, readFile, realpath, rename, rm, rmdir, stat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { listTree, readFileNoFollow } from '@/adapters/fs/walk.js';
import type { FileSystem } from '@/ports/file-system.js';

const isMissing = (e: unknown): boolean => (e as NodeJS.ErrnoException).code === 'ENOENT';

export class NodeFileSystem implements FileSystem {
  async readText(path: string): Promise<string | null> {
    try {
      return await readFile(path, 'utf8');
    } catch (e) {
      if (isMissing(e)) return null;
      throw e;
    }
  }

  async readBytes(path: string): Promise<Uint8Array | null> {
    return readFileNoFollow(path, path);
  }

  listFiles(dir: string): Promise<string[] | null> {
    return listTree(dir);
  }

  /**
   * A symlinked target is resolved first, so the link itself is kept and the file it points to is
   * rewritten. A missing path and a dangling or looping link are written as a regular file at `path`.
   */
  async writeAtomic(path: string, data: string): Promise<void> {
    const target = await realpath(path).catch(() => path);
    const mode = await stat(target).then(
      (s) => s.mode & 0o777,
      () => 0o644,
    );
    await this.writeViaTemp(target, data, mode);
  }

  /** Same temp-file-and-rename as writeAtomic, with a fixed mode of 0644. */
  async writeBytes(path: string, data: Uint8Array): Promise<void> {
    await this.writeViaTemp(path, data, 0o644);
  }

  private async writeViaTemp(path: string, data: string | Uint8Array, mode: number): Promise<void> {
    const dir = dirname(path);
    await this.mkdirp(dir);
    const tmp = join(dir, `.${basename(path)}.shitaku-${randomBytes(4).toString('hex')}.tmp`);
    try {
      const handle = await open(tmp, 'w', mode);
      try {
        await handle.writeFile(data);
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(tmp, path);
    } catch (e) {
      await rm(tmp, { force: true });
      throw e;
    }
  }

  async exists(path: string): Promise<boolean> {
    return stat(path).then(
      () => true,
      (e: unknown) => {
        if (isMissing(e)) return false;
        throw e;
      },
    );
  }

  /** Non-recursive on purpose: user files inside the directory are never deleted. */
  async removeDir(path: string): Promise<boolean> {
    try {
      await rmdir(path);
      return true;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTEMPTY' || code === 'EEXIST') return false;
      throw e;
    }
  }

  async remove(path: string): Promise<void> {
    await rm(path, { force: true, recursive: true });
  }

  async mkdirp(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }
}
