import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { claudeCodeTarget } from '@/adapters/claude-code/target.js';
import { NodeFileSystem } from '@/adapters/fs/node-fs.js';
import { desiredFor, observeInstalled } from '@/application/installed-state.js';
import type { McpItem } from '@/domain/catalog/schema.js';
import { hashEntry, treeHash } from '@/domain/hash.js';
import type { OwnedItem } from '@/domain/manifest.js';
import type { LoadedCatalog } from '@/ports/catalog-source.js';
import type { FileSystem } from '@/ports/file-system.js';
import { DEMO_V1 } from '@test/helpers/skills.js';
import { makeTmpPaths, type TmpPaths } from '@test/helpers/tmp-paths.js';

const GITHUB: McpItem = {
  name: 'github',
  description: 'github',
  server: { type: 'http', url: 'https://example.com/github' },
  env: [],
};

const catalog: LoadedCatalog = {
  mcps: [GITHUB],
  skills: [DEMO_V1],
  scripts: [],
  commands: [],
  profiles: [],
  issues: [],
};

const owned = (kind: 'mcp' | 'skill', name: string, path: string): OwnedItem => ({
  scope: 'project',
  kind,
  name,
  path,
  hash: 'h',
  installId: 'i1',
});

describe('observeInstalled', () => {
  let tmp: TmpPaths;
  let fs: FileSystem;
  const config = () => join(tmp.cwd, '.mcp.json');

  beforeEach(async () => {
    tmp = await makeTmpPaths();
    fs = new NodeFileSystem();
  });
  afterEach(() => tmp.cleanup());

  it('reports a present MCP entry with its hash and the entry itself', async () => {
    const entry = { type: 'http', url: 'https://example.com/github' };
    await writeFile(config(), JSON.stringify({ mcpServers: { github: entry } }));
    const observe = observeInstalled({ fs, target: claudeCodeTarget });
    expect(await observe(owned('mcp', 'github', config()))).toEqual({
      config: 'present',
      current: { kind: 'hash', hash: hashEntry(entry) },
      entry,
    });
  });

  it('reports a present config without the entry as absent', async () => {
    await writeFile(config(), JSON.stringify({ mcpServers: {} }));
    const observe = observeInstalled({ fs, target: claudeCodeTarget });
    expect(await observe(owned('mcp', 'github', config()))).toEqual({ config: 'present', current: { kind: 'absent' } });
  });

  it('reports a config file that does not exist as missing', async () => {
    const observe = observeInstalled({ fs, target: claudeCodeTarget });
    expect(await observe(owned('mcp', 'github', config()))).toEqual({ config: 'missing', current: { kind: 'absent' } });
  });

  it('reports a config file that is not valid JSON as unreadable', async () => {
    await writeFile(config(), '{ not json');
    const observe = observeInstalled({ fs, target: claudeCodeTarget });
    expect(await observe(owned('mcp', 'github', config()))).toEqual({
      config: 'unreadable',
      current: { kind: 'unreadable' },
    });
  });

  it('reads each config file once for many items', async () => {
    await writeFile(config(), JSON.stringify({ mcpServers: {} }));
    const reads: string[] = [];
    const counting: FileSystem = new Proxy(fs, {
      get: (target, prop, receiver) => {
        if (prop !== 'readText') return Reflect.get(target, prop, receiver) as unknown;
        return (path: string) => {
          reads.push(path);
          return target.readText(path);
        };
      },
    });
    const observe = observeInstalled({ fs: counting, target: claudeCodeTarget });
    await observe(owned('mcp', 'github', config()));
    await observe(owned('mcp', 'other', config()));
    expect(reads).toEqual([config()]);
  });

  it('hashes an installed skill tree and reports a missing one as absent', async () => {
    const dir = join(tmp.cwd, '.claude', 'skills', 'demo');
    await mkdir(dir, { recursive: true });
    for (const file of DEMO_V1.files) {
      await mkdir(dirname(join(dir, file.path)), { recursive: true });
      await writeFile(join(dir, file.path), file.bytes);
    }
    const observe = observeInstalled({ fs, target: claudeCodeTarget });
    expect(await observe(owned('skill', 'demo', dir))).toEqual({
      config: 'present',
      current: { kind: 'hash', hash: treeHash(DEMO_V1.files) },
    });
    expect(await observe(owned('skill', 'demo', join(tmp.cwd, 'nope')))).toEqual({
      config: 'present',
      current: { kind: 'absent' },
    });
  });
});

describe('desiredFor', () => {
  it('is unavailable when the catalog failed to load', () => {
    expect(desiredFor(null, claudeCodeTarget, owned('mcp', 'github', '/x'))).toEqual({ kind: 'unavailable' });
  });

  it('hashes the catalog entry for an offered MCP and a skill, and is absent when no longer offered', () => {
    expect(desiredFor(catalog, claudeCodeTarget, owned('mcp', 'github', '/x'))).toEqual({
      kind: 'hash',
      hash: hashEntry(claudeCodeTarget.toEntry(GITHUB)),
    });
    expect(desiredFor(catalog, claudeCodeTarget, owned('mcp', 'gone', '/x'))).toEqual({ kind: 'absent' });
    expect(desiredFor(catalog, claudeCodeTarget, owned('skill', 'demo', '/x'))).toEqual({
      kind: 'hash',
      hash: treeHash(DEMO_V1.files),
    });
    expect(desiredFor(catalog, claudeCodeTarget, owned('skill', 'gone', '/x'))).toEqual({ kind: 'absent' });
  });
});
