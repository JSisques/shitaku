import { mkdir, realpath, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertSafeRelPath, listTree, readFileNoFollow, readTree } from '@/adapters/fs/walk.js';
import { MAX_DEPTH, MAX_FILE_BYTES, MAX_SKILL_BYTES, MAX_SKILL_FILES } from '@/domain/catalog/limits.js';
import { UnsafeTreeError } from '@/ports/file-system.js';
import { makeTmpPaths, type TmpPaths } from '@test/helpers/tmp-paths.js';

let tmp: TmpPaths;
let root: string;

async function put(rel: string, data: string | Uint8Array = 'x'): Promise<void> {
  const file = join(root, rel);
  await mkdir(join(file, '..'), { recursive: true });
  await writeFile(file, data);
}

beforeEach(async () => {
  tmp = await makeTmpPaths();
  root = join(tmp.root, 'skill');
  await mkdir(root);
});
afterEach(() => tmp.cleanup());

describe('listTree', () => {
  it('returns sorted POSIX relative paths of regular files', async () => {
    await put('SKILL.md');
    await put('b/two.txt');
    await put('a/one.txt');
    expect(await listTree(root)).toEqual(['SKILL.md', 'a/one.txt', 'b/two.txt']);
  });

  it('returns null for a missing directory', async () => {
    expect(await listTree(join(tmp.root, 'nope'))).toBeNull();
  });

  it('rejects a symlinked file', async () => {
    await put('SKILL.md');
    await symlink(join(root, 'SKILL.md'), join(root, 'link.md'));
    await expect(listTree(root)).rejects.toThrow(UnsafeTreeError);
    await expect(listTree(root)).rejects.toThrow(/link\.md/);
  });

  it('rejects a symlinked directory inside the tree', async () => {
    await mkdir(join(tmp.root, 'outside'));
    await symlink(join(tmp.root, 'outside'), join(root, 'dir'));
    await expect(listTree(root)).rejects.toThrow(UnsafeTreeError);
  });

  it('rejects a symlinked root', async () => {
    await put('SKILL.md');
    const link = join(tmp.root, 'link-root');
    await symlink(root, link);
    await expect(listTree(link)).rejects.toThrow(/symbolic link/);
  });

  it('rejects a file name containing a backslash', async () => {
    await put('evil\\name.md');
    await expect(listTree(root)).rejects.toThrow(/unsafe path/);
  });

  it('rejects a file larger than the per-file limit, accepts one at the limit', async () => {
    await put('ok.bin', new Uint8Array(MAX_FILE_BYTES));
    expect(await listTree(root)).toEqual(['ok.bin']);
    await put('big.bin', new Uint8Array(MAX_FILE_BYTES + 1));
    await expect(listTree(root)).rejects.toThrow(/file size/);
  });

  it('rejects more files than the limit', async () => {
    for (let i = 0; i < MAX_SKILL_FILES + 1; i++) await put(`f${i}.txt`);
    await expect(listTree(root)).rejects.toThrow(/file count/);
  });

  it('rejects a tree deeper than the limit, accepts one at the limit', async () => {
    const nested = (levels: number): string => `${Array.from({ length: levels }, (_, i) => `d${i}`).join('/')}/f.txt`;
    await put(nested(MAX_DEPTH));
    expect(await listTree(root)).toHaveLength(1);
    await put(nested(MAX_DEPTH + 1));
    await expect(listTree(root)).rejects.toThrow(/depth/);
  });

  it('rejects a total size above the limit', async () => {
    const chunks = Math.floor(MAX_SKILL_BYTES / MAX_FILE_BYTES) + 1;
    for (let i = 0; i < chunks; i++) await put(`c${i}.bin`, new Uint8Array(MAX_FILE_BYTES));
    await expect(listTree(root)).rejects.toThrow(/total size/);
  });

  it('skips a top-level node_modules directory and still lists sibling files', async () => {
    await put('index.mjs', 'export {};\n');
    await put('script.json', '{"name":"x"}');
    await put('node_modules/eslint/bin/eslint.js', 'ignored');
    await put('node_modules/.bin/eslint', 'ignored');
    expect(await listTree(root)).toEqual(['index.mjs', 'script.json']);
  });

  it('still walks nested node_modules paths that are not at the tree root', async () => {
    await put('vendor/node_modules/pkg/index.js', 'nested');
    expect(await listTree(root)).toEqual(['vendor/node_modules/pkg/index.js']);
  });
});

describe('readTree', () => {
  it('reads bytes, including binary content', async () => {
    await put('SKILL.md', 'hi');
    await put('assets/a.bin', new Uint8Array([0, 255, 7]));
    const files = await readTree(root);
    expect(files?.map((f) => f.path)).toEqual(['SKILL.md', 'assets/a.bin']);
    expect(Array.from(files?.[1]?.bytes ?? [])).toEqual([0, 255, 7]);
  });

  it('rejects a root whose real path is not the expected one', async () => {
    await put('SKILL.md');
    await expect(readTree(root, join(tmp.root, 'elsewhere'))).rejects.toThrow(/outside/);
    expect(await readTree(root, await realpath(root))).toHaveLength(1);
  });
});

describe('assertSafeRelPath', () => {
  it('accepts plain relative paths', () => {
    expect(() => assertSafeRelPath('a/b/c.md')).not.toThrow();
  });

  it.each(['../x', 'a/../b', 'a\\b', 'a\0b', '/abs', ''])('rejects %j', (bad) => {
    expect(() => assertSafeRelPath(bad)).toThrow(UnsafeTreeError);
  });
});

describe('readFileNoFollow', () => {
  it('reads a regular file and resolves to null when it is missing', async () => {
    await put('a.md', 'hi');
    expect(Array.from((await readFileNoFollow(join(root, 'a.md'), 'a.md')) ?? [])).toEqual([104, 105]);
    expect(await readFileNoFollow(join(root, 'gone.md'), 'gone.md')).toBeNull();
  });

  it('refuses a file swapped for a symlink, naming the file', async () => {
    await put('a.md', 'hi');
    await symlink(join(root, 'a.md'), join(root, 'link.md'));
    await expect(readFileNoFollow(join(root, 'link.md'), 'link.md')).rejects.toThrow(
      /symbolic link not allowed: link.md/,
    );
  });

  it('refuses a directory and an oversized file', async () => {
    await mkdir(join(root, 'd'));
    await expect(readFileNoFollow(join(root, 'd'), 'd')).rejects.toThrow(UnsafeTreeError);
    await put('big.bin', new Uint8Array(MAX_FILE_BYTES + 1));
    await expect(readFileNoFollow(join(root, 'big.bin'), 'big.bin')).rejects.toThrow(UnsafeTreeError);
  });
});
