import { NodeFileSystem } from '@/adapters/fs/node-fs.js';
import type { SkillItem } from '@/domain/catalog/skill.js';
import type { CatalogSource } from '@/ports/catalog-source.js';
import type { FileSystem } from '@/ports/file-system.js';

export const enc = (text: string): Uint8Array => new TextEncoder().encode(text);

/** A catalog source that serves the given skills and no MCPs. */
export const skillSource = (skills: SkillItem[]): CatalogSource => ({
  ref: () => ({ kind: 'bundled', location: '/catalog' }),
  load: () => Promise.resolve({ mcps: [], skills, scripts: [], commands: [], hooks: [], profiles: [], issues: [] }),
});

/** Four files, one of them binary and two in subdirectories. SKILL.md sorts after assets/ and refs/ only by the apply order. */
export const DEMO_V1: SkillItem = {
  name: 'demo',
  description: 'd',
  files: [
    { path: 'SKILL.md', bytes: enc('---\nname: demo\n---\none') },
    { path: 'assets/logo.bin', bytes: Uint8Array.from([0xff, 0x00, 0x89, 0x50]) },
    { path: 'refs/a.md', bytes: enc('a1') },
    { path: 'refs/b.md', bytes: enc('b1') },
  ],
};

/** A newer version that drops refs/b.md and changes SKILL.md. */
export const DEMO_V2: SkillItem = {
  ...DEMO_V1,
  files: [
    { path: 'SKILL.md', bytes: enc('---\nname: demo\n---\ntwo') },
    { path: 'assets/logo.bin', bytes: Uint8Array.from([0xff, 0x00, 0x89, 0x50]) },
    { path: 'refs/a.md', bytes: enc('a2') },
  ],
};

export interface Fault {
  method: 'writeBytes' | 'writeAtomic' | 'remove';
  /** 1-based index among the calls whose path satisfies `match`. */
  nth: number;
  /** Fail every matching call from the nth on, not only the nth. */
  sticky?: boolean;
  match?: (path: string) => boolean;
}

/** Wraps a real file system and throws on the nth matching call; `calls` records every write/remove, in order. */
export function faultyFs(fs: NodeFileSystem, fault: Fault): FileSystem & { calls: string[] } {
  const calls: string[] = [];
  let seen = 0;
  const guard = async <A extends unknown[]>(
    method: Fault['method'],
    path: string,
    run: (...a: A) => Promise<void>,
    ...args: A
  ): Promise<void> => {
    calls.push(`${method} ${path}`);
    if (method === fault.method && (fault.match?.(path) ?? true)) {
      seen += 1;
      if (seen === fault.nth || (fault.sticky === true && seen > fault.nth))
        throw new Error(`injected ${method} failure`);
    }
    await run(...args);
  };
  return Object.assign(Object.create(fs) as FileSystem, {
    calls,
    writeBytes: (path: string, data: Uint8Array) =>
      guard('writeBytes', path, (d: Uint8Array) => fs.writeBytes(path, d), data),
    writeAtomic: (path: string, data: string) =>
      guard('writeAtomic', path, (d: string) => fs.writeAtomic(path, d), data),
    remove: (path: string) => guard('remove', path, () => fs.remove(path)),
  });
}
