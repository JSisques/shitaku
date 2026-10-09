import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { claudeCodeTarget } from '@/adapters/claude-code/target.js';
import { NodeFileSystem } from '@/adapters/fs/node-fs.js';
import { initMcps, type InitDeps } from '@/application/init-mcps.js';
import { desiredFor, observeInstalled } from '@/application/installed-state.js';
import { getStatus } from '@/application/status.js';
import type { McpItem } from '@/domain/catalog/schema.js';
import { hashEntry, sha256, treeHash } from '@/domain/hash.js';
import { deriveOwnedItems, type OwnedItem } from '@/domain/manifest.js';
import { hookEntryHash } from '@/domain/plan/hook-plan.js';
import { loadManifest } from '@/application/journal.js';
import type { LoadedCatalog } from '@/ports/catalog-source.js';
import type { FileSystem } from '@/ports/file-system.js';
import { commandSource, REVIEW_V1, REVIEW_V2 } from '@test/helpers/commands.js';
import { FMT_V1, FMT_V2, GUARD, hookSource } from '@test/helpers/hooks.js';
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

describe('hooks', () => {
  let tmp: TmpPaths;
  let deps: InitDeps;
  const settings = (scope: 'project' | 'user' = 'project') =>
    join(scope === 'project' ? tmp.cwd : tmp.homeDir, '.claude', 'settings.json');
  const entry = (hook: typeof FMT_V1) =>
    hookEntryHash({ event: hook.event, matcher: hook.matcher ?? null, handler: claudeCodeTarget.toHookHandler(hook) });
  const status = (source = deps.source) => getStatus({ ...deps, source }, {});
  const states = async (source = deps.source) => (await status(source)).items.map((i) => [i.name, i.state]);
  const install = (scope: 'project' | 'user' = 'project', hooks = ['fmt', 'guard']) =>
    initMcps(deps, { mcps: [], hooks, scope });
  const observe = async (name = 'fmt', scope: 'project' | 'user' = 'project', fs: FileSystem = deps.fs) => {
    const item = deriveOwnedItems(await loadManifest(deps.fs, tmp.homeDir)).find(
      (i) => i.name === name && i.scope === scope,
    )!;
    return observeInstalled({ fs, target: claudeCodeTarget })(item);
  };
  const edit = async (change: (doc: { hooks: Record<string, { hooks: object[] }[]> }) => void) => {
    const doc = JSON.parse(await readFile(settings(), 'utf8')) as { hooks: Record<string, { hooks: object[] }[]> };
    change(doc);
    await writeFile(settings(), JSON.stringify(doc, null, 2));
  };

  beforeEach(async () => {
    tmp = await makeTmpPaths();
    deps = {
      source: hookSource([FMT_V1, GUARD]),
      fs: new NodeFileSystem(),
      target: claudeCodeTarget,
      paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
      env: {},
    };
  });
  afterEach(() => tmp.cleanup());

  describe('observeInstalled', () => {
    it('hashes an intact handler as its recorded entry and offers no entry, so no env is ever required', async () => {
      await install();
      expect(await observe()).toEqual({
        config: 'present',
        current: { kind: 'hash', hash: entry(FMT_V1) },
      });
    });

    it('reports an edited handler and a deleted handler as absent', async () => {
      await install();
      await edit((doc) => {
        doc.hooks.PostToolUse![0]!.hooks = [{ type: 'command', command: 'prettier -w src' }];
        delete doc.hooks.Stop;
      });
      expect(await observe('fmt')).toEqual({ config: 'present', current: { kind: 'absent' } });
      expect(await observe('guard')).toEqual({ config: 'present', current: { kind: 'absent' } });
    });

    it('reports a settings file that does not exist as missing', async () => {
      await install();
      await rm(settings());
      expect(await observe()).toEqual({ config: 'missing', current: { kind: 'absent' } });
    });

    it('reports a settings file that is not valid JSON, or has the wrong shape, as unreadable', async () => {
      await install();
      await writeFile(settings(), '{ "hooks": ');
      expect(await observe()).toEqual({ config: 'unreadable', current: { kind: 'unreadable' } });
      await writeFile(settings(), JSON.stringify({ hooks: { PostToolUse: 'nope' } }));
      expect(await observe()).toEqual({ config: 'unreadable', current: { kind: 'unreadable' } });
    });

    it('reads each settings file once for many hooks', async () => {
      await install('project', ['fmt', 'guard']);
      const reads: string[] = [];
      const counting: FileSystem = new Proxy(deps.fs, {
        get: (target, prop, receiver) => {
          if (prop !== 'readText') return Reflect.get(target, prop, receiver) as unknown;
          return (path: string) => {
            reads.push(path);
            return target.readText(path);
          };
        },
      });
      const items = deriveOwnedItems(await loadManifest(deps.fs, tmp.homeDir));
      const observeAll = observeInstalled({ fs: counting, target: claudeCodeTarget });
      await Promise.all(items.map((i) => observeAll(i)));
      expect(items).toHaveLength(2);
      expect(reads).toEqual([settings()]);
    });
  });

  describe('desiredFor', () => {
    const item = (name: string) => ({ ...owned('hook', name, settings()) });
    const entry = (hook: typeof FMT_V1) =>
      hashEntry({ event: hook.event, matcher: hook.matcher ?? null, handler: claudeCodeTarget.toHookHandler(hook) });

    it('hashes the catalog hook as event, matcher and handler, and is absent when it is no longer offered', () => {
      const withHooks = { ...catalog, hooks: [FMT_V1, GUARD] };
      expect(desiredFor(withHooks, claudeCodeTarget, item('fmt'))).toEqual({ kind: 'hash', hash: entry(FMT_V1) });
      expect(desiredFor(withHooks, claudeCodeTarget, item('guard'))).toEqual({ kind: 'hash', hash: entry(GUARD) });
      expect(desiredFor(withHooks, claudeCodeTarget, item('gone'))).toEqual({ kind: 'absent' });
    });

    it('differs when only the matcher or the event changed in the catalog', () => {
      const moved = { ...catalog, hooks: [{ ...FMT_V1, matcher: 'Bash' }] };
      const renamed = { ...catalog, hooks: [{ ...FMT_V1, event: 'PreToolUse' }] };
      expect(desiredFor(moved, claudeCodeTarget, item('fmt'))).not.toEqual({ kind: 'hash', hash: entry(FMT_V1) });
      expect(desiredFor(renamed, claudeCodeTarget, item('fmt'))).not.toEqual({ kind: 'hash', hash: entry(FMT_V1) });
    });
  });

  describe('getStatus', () => {
    it('lists installed hooks with kind hook and the settings file as path', async () => {
      await install();
      expect((await status()).items).toMatchObject([
        { kind: 'hook', name: 'fmt', state: 'installed', scope: 'project', path: settings() },
        { kind: 'hook', name: 'guard', state: 'installed', scope: 'project', path: settings() },
      ]);
    });

    it('reports an edited or deleted handler as missing, never installed', async () => {
      await install();
      await edit((doc) => {
        doc.hooks.PostToolUse![0]!.hooks = [{ type: 'command', command: 'prettier -w src' }];
      });
      expect(await states()).toEqual([
        ['fmt', 'missing'],
        ['guard', 'installed'],
      ]);
      await edit((doc) => {
        delete doc.hooks.Stop;
      });
      expect(await states()).toEqual([
        ['fmt', 'missing'],
        ['guard', 'missing'],
      ]);
    });

    it('reports out-of-date and missing-from-catalog', async () => {
      await install();
      expect(await states(hookSource([FMT_V2]))).toEqual([
        ['fmt', 'out-of-date'],
        ['guard', 'missing-from-catalog'],
      ]);
    });

    it('reports every hook of an unparseable settings file as modified and still classifies the other scope', async () => {
      await install('project');
      await install('user');
      await writeFile(settings(), '{ "hooks": ');
      const items = (await status()).items.map((i) => [i.scope, i.name, i.state]);
      expect(items).toEqual([
        ['project', 'fmt', 'modified'],
        ['project', 'guard', 'modified'],
        ['user', 'fmt', 'installed'],
        ['user', 'guard', 'installed'],
      ]);
    });

    it('ignores unrelated settings changes and user hooks, keeps scopes distinct, and writes nothing', async () => {
      await install('project');
      await install('user');
      await edit((doc) => {
        Object.assign(doc, { model: 'opus' });
        doc.hooks.PostToolUse![0]!.hooks.unshift({ type: 'command', command: 'echo mine' });
        doc.hooks.PreToolUse = [{ hooks: [{ type: 'command', command: 'echo user' }] }];
      });
      const before = await readFile(settings(), 'utf8');
      const items = (await status()).items;
      expect(items.map((i) => [i.scope, i.name, i.state])).toEqual([
        ['project', 'fmt', 'installed'],
        ['project', 'guard', 'installed'],
        ['user', 'fmt', 'installed'],
        ['user', 'guard', 'installed'],
      ]);
      expect(await readFile(settings(), 'utf8')).toBe(before);
    });
  });
});
