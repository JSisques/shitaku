import { execFileSync } from 'node:child_process';
import { mkdir, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { claudeCodeTarget } from '@/adapters/claude-code/target.js';
import { NodeFileSystem } from '@/adapters/fs/node-fs.js';
import { initMcps, type InitDeps } from '@/application/init-mcps.js';
import { desiredFor, observeInstalled } from '@/application/installed-state.js';
import { getStatus } from '@/application/status.js';
import type { McpItem } from '@/domain/catalog/schema.js';
import { hashEntry, sha256, treeHash } from '@/domain/hash.js';
import type { OwnedItem } from '@/domain/manifest.js';
import type { LoadedCatalog } from '@/ports/catalog-source.js';
import type { FileSystem } from '@/ports/file-system.js';
import { commandSource, REVIEW_V1, REVIEW_V2 } from '@test/helpers/commands.js';
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
  hooks: [],
  profiles: [],
  issues: [],
};

const owned = (kind: OwnedItem['kind'], name: string, path: string): OwnedItem => ({
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

describe('observeInstalled (commands)', () => {
  let tmp: TmpPaths;
  let fs: FileSystem;
  const file = () => join(tmp.cwd, '.claude', 'commands', 'review.md');
  const observe = (path = file()) =>
    observeInstalled({ fs, target: claudeCodeTarget })(owned('command', 'review', path));

  beforeEach(async () => {
    tmp = await makeTmpPaths();
    fs = new NodeFileSystem();
    await mkdir(join(tmp.cwd, '.claude', 'commands'), { recursive: true });
  });
  afterEach(() => tmp.cleanup());

  it('hashes the file bytes and reports a missing file as absent', async () => {
    await writeFile(file(), REVIEW_V1.bytes);
    expect(await observe()).toEqual({ config: 'present', current: { kind: 'hash', hash: sha256(REVIEW_V1.bytes) } });
    expect(await observe(join(tmp.cwd, '.claude', 'commands', 'gone.md'))).toEqual({
      config: 'present',
      current: { kind: 'absent' },
    });
  });

  it('reports a directory or a symlink at the path as unreadable', async () => {
    await mkdir(file());
    expect(await observe()).toEqual({ config: 'present', current: { kind: 'unreadable' } });
    await rm(file(), { recursive: true });
    await writeFile(join(tmp.cwd, 'target.md'), 'x');
    await symlink(join(tmp.cwd, 'target.md'), file());
    expect(await observe()).toEqual({ config: 'present', current: { kind: 'unreadable' } });
  });

  it('never lists the path as a tree', async () => {
    await writeFile(file(), REVIEW_V1.bytes);
    const listed: string[] = [];
    const spying: FileSystem = Object.assign(Object.create(fs) as FileSystem, {
      listFiles: (p: string) => {
        listed.push(p);
        return fs.listFiles(p);
      },
    });
    await observeInstalled({ fs: spying, target: claudeCodeTarget })(owned('command', 'review', file()));
    expect(listed).toEqual([]);
  });
});

describe('getStatus (commands)', () => {
  let tmp: TmpPaths;
  let deps: InitDeps;
  const dir = (scope: 'project' | 'user' = 'project') =>
    join(scope === 'project' ? tmp.cwd : tmp.homeDir, '.claude', 'commands');
  const status = (source = deps.source) => getStatus({ ...deps, source }, {});
  const install = (scope: 'project' | 'user' = 'project') =>
    initMcps(deps, { mcps: [], commands: ['review', 'other'], scope });

  beforeEach(async () => {
    tmp = await makeTmpPaths();
    deps = {
      source: commandSource([REVIEW_V1, { ...REVIEW_V1, name: 'other' }]),
      fs: new NodeFileSystem(),
      target: claudeCodeTarget,
      paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
      env: {},
    };
  });
  afterEach(() => tmp.cleanup());

  it('classifies installed, modified, missing, out-of-date and missing-from-catalog', async () => {
    await install();
    await writeFile(join(dir(), 'other.md'), 'edited');
    expect((await status()).items.map((i) => [i.name, i.state])).toEqual([
      ['other', 'modified'],
      ['review', 'installed'],
    ]);
    await rm(join(dir(), 'other.md'));
    expect((await status()).items.map((i) => [i.name, i.state])).toEqual([
      ['other', 'missing'],
      ['review', 'installed'],
    ]);
    const next = commandSource([REVIEW_V2]);
    expect((await status(next)).items.map((i) => [i.name, i.state])).toEqual([
      ['other', 'missing'],
      ['review', 'out-of-date'],
    ]);
    await writeFile(join(dir(), 'other.md'), REVIEW_V1.bytes);
    expect((await status(next)).items.map((i) => [i.name, i.state])).toEqual([
      ['other', 'missing-from-catalog'],
      ['review', 'out-of-date'],
    ]);
  });

  it('reports a directory or a symlink at the path as modified and still classifies the other items', async () => {
    await install();
    await rm(join(dir(), 'review.md'));
    await mkdir(join(dir(), 'review.md'));
    expect((await status()).items.map((i) => [i.name, i.state])).toEqual([
      ['other', 'installed'],
      ['review', 'modified'],
    ]);
    await rm(join(dir(), 'review.md'), { recursive: true });
    await writeFile(join(tmp.cwd, 'target.md'), 'x');
    await symlink(join(tmp.cwd, 'target.md'), join(dir(), 'review.md'));
    expect((await status()).items.map((i) => [i.name, i.state])).toEqual([
      ['other', 'installed'],
      ['review', 'modified'],
    ]);
  });

  it.skipIf(process.platform === 'win32')(
    'reports a named pipe at the path as modified without blocking on it',
    async () => {
      await install();
      await rm(join(dir(), 'review.md'));
      execFileSync('mkfifo', [join(dir(), 'review.md')]);
      const timeout = new Promise<string>((resolve) => {
        setTimeout(() => resolve('blocked'), 1000).unref();
      });
      const outcome = await Promise.race([status().then((s) => s.items.map((i) => [i.name, i.state])), timeout]);
      expect(outcome).toEqual([
        ['other', 'installed'],
        ['review', 'modified'],
      ]);
    },
  );

  it('ignores an unlisted user command, keeps scopes distinct and writes nothing', async () => {
    await install('project');
    await install('user');
    await writeFile(join(dir(), 'mine.md'), 'mine');
    const before = [await readdir(dir()), await readdir(dir('user'))];
    const items = (await status()).items.filter((i) => i.name === 'review');
    expect(items.map((i) => [i.scope, i.path])).toEqual([
      ['project', join(dir(), 'review.md')],
      ['user', join(dir('user'), 'review.md')],
    ]);
    expect((await status()).items.map((i) => i.name)).not.toContain('mine');
    expect([await readdir(dir()), await readdir(dir('user'))]).toEqual(before);
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

  it('hashes the catalog command bytes, and is absent when the command is no longer offered', () => {
    const withCommand = { ...catalog, commands: [REVIEW_V1] };
    expect(desiredFor(withCommand, claudeCodeTarget, owned('command', 'review', '/x'))).toEqual({
      kind: 'hash',
      hash: sha256(REVIEW_V1.bytes),
    });
    expect(desiredFor(withCommand, claudeCodeTarget, owned('command', 'gone', '/x'))).toEqual({ kind: 'absent' });
    expect(desiredFor(catalog, claudeCodeTarget, owned('command', 'review', '/x'))).toEqual({ kind: 'absent' });
  });
});
