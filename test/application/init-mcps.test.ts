import { mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { claudeCodeTarget } from '@/adapters/claude-code/target.js';
import { FolderCatalogSource } from '@/adapters/catalog/folder-source.js';
import { NodeFileSystem } from '@/adapters/fs/node-fs.js';
import { ConfigError } from '@/domain/json-merge.js';
import {
  applyPlan,
  initMcps,
  LeakError,
  planInit,
  StaleFileError,
  UnknownCommandError,
  UnknownMcpError,
  UnknownScriptError,
  UnknownSkillError,
  type InitDeps,
} from '@/application/init-mcps.js';
import { appendInstall, manifestPath, stateDir } from '@/application/journal.js';
import type { SkillItem } from '@/domain/catalog/skill.js';
import { hashEntry, sha256, treeHash } from '@/domain/hash.js';
import type { CatalogSource } from '@/ports/catalog-source.js';
import { UnsafeTreeError } from '@/ports/file-system.js';
import { parseManifest, type Manifest } from '@/domain/manifest.js';
import { DEMO_V1, DEMO_V2, faultyFs, skillSource } from '@test/helpers/skills.js';
import { SCRIPT_V1, SCRIPT_V2, scriptSource } from '@test/helpers/scripts.js';
import { commandSource, REVIEW_V1, REVIEW_V2 } from '@test/helpers/commands.js';
import type { Scope } from '@/ports/agent-target.js';
import { parseDoc } from '@test/helpers/parse-doc.js';
import { makeTmpPaths, type TmpPaths } from '@test/helpers/tmp-paths.js';

const CATALOG = join(import.meta.dirname, '..', '..', 'catalog');

describe('initMcps (project scope)', () => {
  let tmp: TmpPaths;
  let deps: InitDeps;
  const mcpFile = () => join(tmp.cwd, '.mcp.json');
  beforeEach(async () => {
    tmp = await makeTmpPaths();
    deps = {
      source: new FolderCatalogSource(CATALOG, 'bundled'),
      fs: new NodeFileSystem(),
      target: claudeCodeTarget,
      paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
      env: { GITHUB_TOKEN: 'abc123' },
    };
  });
  afterEach(() => tmp.cleanup());

  it('creates ./.mcp.json with the entry and no env value', async () => {
    const { applied } = await initMcps(deps, { mcps: ['github'], scope: 'project' });
    expect(applied).toBe(true);
    const text = await readFile(mcpFile(), 'utf8');
    expect(parseDoc(text).mcpServers.github?.headers?.Authorization).toBe('Bearer ${GITHUB_TOKEN}');
    expect(text).not.toContain('abc123');
    expect(await readdir(tmp.homeDir)).toEqual(['.claude']);
  });

  it('merges into an existing file keeping unknown keys', async () => {
    await writeFile(
      mcpFile(),
      JSON.stringify({ theme: 'dark', mcpServers: { other: { type: 'stdio', command: 'x' } } }),
    );
    await initMcps(deps, { mcps: ['context7'], scope: 'project' });
    const doc = parseDoc(await readFile(mcpFile(), 'utf8'));
    expect(doc.theme).toBe('dark');
    expect(Object.keys(doc.mcpServers)).toEqual(['other', 'context7']);
  });

  it('writes nothing on dry run', async () => {
    const { plan, applied } = await initMcps(deps, { mcps: ['github'], scope: 'project', dryRun: true });
    expect(applied).toBe(false);
    expect(plan.files[0]?.items[0]?.action).toBe('create');
    expect(await readdir(tmp.cwd)).toEqual([]);
  });

  it('does not write when everything is identical', async () => {
    await initMcps(deps, { mcps: ['github'], scope: 'project' });
    const before = await readFile(mcpFile(), 'utf8');
    const { applied } = await initMcps(deps, { mcps: ['github'], scope: 'project' });
    expect(applied).toBe(false);
    expect(await readFile(mcpFile(), 'utf8')).toBe(before);
  });

  it('leaves a conflicting entry untouched unless forced', async () => {
    const original = JSON.stringify({ mcpServers: { github: { type: 'stdio', command: 'x' } } });
    await writeFile(mcpFile(), original);
    const first = await initMcps(deps, { mcps: ['github'], scope: 'project' });
    expect(first.applied).toBe(false);
    expect(first.plan.files[0]?.items[0]?.action).toBe('conflict');
    expect(await readFile(mcpFile(), 'utf8')).toBe(original);
    const forced = await initMcps(deps, { mcps: ['github'], scope: 'project', force: true });
    expect(forced.applied).toBe(true);
    expect(parseDoc(await readFile(mcpFile(), 'utf8')).mcpServers.github?.type).toBe('http');
  });

  it('rejects an unknown MCP naming it, writing nothing', async () => {
    await expect(initMcps(deps, { mcps: ['github', 'ghost'], scope: 'project' })).rejects.toThrow(UnknownMcpError);
    await expect(initMcps(deps, { mcps: ['ghost'], scope: 'project' })).rejects.toThrow(/ghost/);
    expect(await readdir(tmp.cwd)).toEqual([]);
  });

  it('aborts on a corrupt file leaving it byte-identical', async () => {
    await writeFile(mcpFile(), '{ nope');
    await expect(initMcps(deps, { mcps: ['github'], scope: 'project' })).rejects.toThrow(ConfigError);
    expect(await readFile(mcpFile(), 'utf8')).toBe('{ nope');
  });
});

describe('initMcps safety (backup, re-read, leak scan, manifest)', () => {
  let tmp: TmpPaths;
  let deps: InitDeps;
  const mcpFile = () => join(tmp.cwd, '.mcp.json');
  const manifest = async (): Promise<Manifest> => parseManifest(await readFile(manifestPath(tmp.homeDir), 'utf8'));
  beforeEach(async () => {
    tmp = await makeTmpPaths();
    deps = {
      source: new FolderCatalogSource(CATALOG, 'bundled'),
      fs: new NodeFileSystem(),
      target: claudeCodeTarget,
      paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
      env: { GITHUB_TOKEN: 'abc123' },
    };
  });
  afterEach(() => tmp.cleanup());

  it('backs up the original bytes before changing the file and records the manifest', async () => {
    const original = JSON.stringify({ theme: 'dark' }, null, 4);
    await writeFile(mcpFile(), original);
    await initMcps(deps, { mcps: ['github'], scope: 'project' });
    const file = (await manifest()).installs[0]!.files[0]!;
    expect(await readFile(join(stateDir(tmp.homeDir), file.backup!), 'utf8')).toBe(original);
    expect(file).toMatchObject({
      path: mcpFile(),
      scope: 'project',
      beforeHash: sha256(original),
      afterHash: sha256(await readFile(mcpFile(), 'utf8')),
    });
    expect(file.items).toEqual([
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest asymmetric matchers are typed any
      { kind: 'mcp', name: 'github', action: 'create', entryHash: expect.stringMatching(/^[0-9a-f]{64}$/) },
    ]);
  });

  it('records no backup when the file did not exist', async () => {
    await initMcps(deps, { mcps: ['context7'], scope: 'project' });
    expect((await manifest()).installs[0]!.files[0]).toMatchObject({ backup: null, beforeHash: null });
  });

  it('keeps a key written by another process between plan and apply', async () => {
    await writeFile(mcpFile(), JSON.stringify({ theme: 'dark' }));
    const plan = await planInit(deps, { mcps: ['github'], scope: 'project' });
    await writeFile(mcpFile(), JSON.stringify({ theme: 'dark', fresh: 1 }));
    await applyPlan(deps, plan);
    const doc = parseDoc(await readFile(mcpFile(), 'utf8'));
    expect(doc).toMatchObject({ theme: 'dark', fresh: 1, mcpServers: { github: { type: 'http' } } });
  });

  it('aborts when the re-read changes what the plan would do', async () => {
    const plan = await planInit(deps, { mcps: ['github'], scope: 'project' });
    const other = JSON.stringify({ mcpServers: { github: { type: 'stdio', command: 'x' } } });
    await writeFile(mcpFile(), other);
    await expect(applyPlan(deps, plan)).rejects.toThrow(StaleFileError);
    expect(await readFile(mcpFile(), 'utf8')).toBe(other);
    expect(await readdir(tmp.homeDir)).toEqual([]);
  });

  it('writes placeholders only: no env value reaches any file under the temp root', async () => {
    await initMcps(deps, { mcps: ['github'], scope: 'project' });
    for (const path of [mcpFile(), manifestPath(tmp.homeDir)])
      expect(await readFile(path, 'utf8')).not.toContain('abc123');
  });

  it('aborts before writing when an env value appears in the output', async () => {
    const leaky = { ...deps, env: { GITHUB_TOKEN: 'https://api.githubcopilot.com' } };
    await expect(initMcps(leaky, { mcps: ['github'], scope: 'project' })).rejects.toThrow(LeakError);
    expect(await readdir(tmp.cwd)).toEqual([]);
    expect(await readdir(tmp.homeDir)).toEqual([]);
  });

  it('updates an entry shitaku owns but protects an unmanaged one', async () => {
    const stale = { type: 'stdio', command: 'old' };
    await writeFile(mcpFile(), JSON.stringify({ mcpServers: { github: stale } }));
    const unmanaged = await planInit(deps, { mcps: ['github'], scope: 'project' });
    expect(unmanaged.files[0]?.items[0]?.action).toBe('conflict');
    await appendInstall(deps.fs, tmp.homeDir, {
      id: 'seed',
      createdAt: '2026-10-02T00:00:00.000Z',
      undoneAt: null,
      source: { kind: 'bundled', location: CATALOG, catalogVersion: 1 },
      files: [
        {
          path: mcpFile(),
          scope: 'project',
          backup: null,
          beforeHash: null,
          afterHash: 'x',
          items: [{ kind: 'mcp', name: 'github', action: 'create', entryHash: hashEntry(stale) }],
        },
      ],
      createdDirs: [],
    });
    const owned = await planInit(deps, { mcps: ['github'], scope: 'project' });
    expect(owned.files[0]?.items[0]?.action).toBe('update');
  });
});

describe('initMcps (user scope)', () => {
  let tmp: TmpPaths;
  let deps: InitDeps;
  const userFile = () => join(tmp.homeDir, '.claude.json');
  beforeEach(async () => {
    tmp = await makeTmpPaths();
    deps = {
      source: new FolderCatalogSource(CATALOG, 'bundled'),
      fs: new NodeFileSystem(),
      target: claudeCodeTarget,
      paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
      env: { GITHUB_TOKEN: 'abc123' },
    };
  });
  afterEach(() => tmp.cleanup());

  it('adds the entry to ~/.claude.json keeping every other key, with a byte-identical backup', async () => {
    const original = JSON.stringify(
      { projects: { a: 1 }, theme: 'dark', mcpServers: { other: { type: 'stdio', command: 'x' } } },
      null,
      2,
    );
    await writeFile(userFile(), original);
    await initMcps(deps, { mcps: ['github'], scope: 'user' });
    const doc = parseDoc(await readFile(userFile(), 'utf8'));
    expect(doc).toMatchObject({
      projects: { a: 1 },
      theme: 'dark',
      mcpServers: { other: { command: 'x' }, github: { type: 'http' } },
    });
    const manifest = parseManifest(await readFile(manifestPath(tmp.homeDir), 'utf8'));
    const file = manifest.installs[0]!.files[0]!;
    expect(file.scope).toBe('user');
    expect(await readFile(join(stateDir(tmp.homeDir), file.backup!), 'utf8')).toBe(original);
  });

  it('creates a missing ~/.claude.json containing only mcpServers', async () => {
    await initMcps(deps, { mcps: ['context7'], scope: 'user' });
    expect(Object.keys(parseDoc(await readFile(userFile(), 'utf8')))).toEqual(['mcpServers']);
  });

  it('aborts on a corrupt ~/.claude.json leaving it byte-identical and the manifest absent', async () => {
    await writeFile(userFile(), '{ nope');
    await expect(initMcps(deps, { mcps: ['github'], scope: 'user' })).rejects.toThrow(ConfigError);
    expect(await readFile(userFile(), 'utf8')).toBe('{ nope');
    expect(await readdir(tmp.homeDir)).toEqual(['.claude.json']);
  });
});

describe('planInit (skills)', () => {
  const enc = (text: string) => new TextEncoder().encode(text);
  const v1: SkillItem = {
    name: 'demo',
    description: 'd',
    files: [
      { path: 'SKILL.md', bytes: enc('one') },
      { path: 'notes.md', bytes: enc('n') },
    ],
  };
  const v2: SkillItem = { ...v1, files: [{ path: 'SKILL.md', bytes: enc('two') }] };
  const source = (skills: SkillItem[]): CatalogSource => ({
    ref: () => ({ kind: 'bundled', location: '/catalog' }),
    load: () => Promise.resolve({ mcps: [], skills, scripts: [], commands: [], profiles: [], issues: [] }),
  });

  let tmp: TmpPaths;
  let deps: InitDeps;
  const userRoot = () => join(tmp.homeDir, '.claude', 'skills', 'demo');
  const projectRoot = () => join(tmp.cwd, '.claude', 'skills', 'demo');
  const put = async (root: string, files: Record<string, string>) => {
    for (const [path, text] of Object.entries(files)) {
      await mkdir(join(root, path, '..'), { recursive: true });
      await writeFile(join(root, path), text);
    }
  };
  const seedOwnership = (root: string, item: SkillItem) =>
    appendInstall(deps.fs, tmp.homeDir, {
      id: 'seed',
      createdAt: '2026-10-02T00:00:00.000Z',
      undoneAt: null,
      source: { kind: 'bundled', location: '/catalog', catalogVersion: 1 },
      files: item.files.map((f) => ({
        path: join(root, f.path),
        scope: 'user' as const,
        backup: null,
        beforeHash: null,
        afterHash: sha256(f.bytes),
        items: [
          {
            kind: 'skill' as const,
            name: item.name,
            action: 'create' as const,
            entryHash: treeHash(item.files) ?? '',
            root,
          },
        ],
      })),
      createdDirs: [],
    });
  beforeEach(async () => {
    tmp = await makeTmpPaths();
    deps = {
      source: source([v2]),
      fs: new NodeFileSystem(),
      target: claudeCodeTarget,
      paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
      env: {},
    };
  });
  afterEach(() => tmp.cleanup());

  it('plans a create under ~/.claude/skills for user scope and plans no MCP file', async () => {
    const plan = await planInit(deps, { mcps: [], skills: ['demo'], scope: 'user' });
    expect(plan.files).toEqual([]);
    expect(plan.skills).toHaveLength(1);
    expect(plan.skills[0]).toMatchObject({ name: 'demo', root: userRoot(), action: 'create', presentHash: null });
  });

  it('plans under ./.claude/skills for project scope', async () => {
    const plan = await planInit(deps, { mcps: [], skills: ['demo'], scope: 'project' });
    expect(plan.skills[0]?.root).toBe(projectRoot());
  });

  it('plans MCPs and skills together, leaving the skills empty when none are requested', async () => {
    deps = { ...deps, source: new FolderCatalogSource(CATALOG, 'bundled') };
    const both = await planInit(deps, { mcps: ['github'], skills: ['example-skill'], scope: 'project' });
    expect(both.files).toHaveLength(1);
    expect(both.skills.map((s) => s.name)).toEqual(['example-skill']);
    expect((await planInit(deps, { mcps: ['github'], scope: 'project' })).skills).toEqual([]);
  });

  it('skips an identical tree on disk', async () => {
    await put(projectRoot(), { 'SKILL.md': 'two' });
    const plan = await planInit(deps, { mcps: [], skills: ['demo'], scope: 'project' });
    expect(plan.skills[0]).toMatchObject({ action: 'skip', reason: 'already installed' });
  });

  it('plans an update of an owned tree and lists the dropped file', async () => {
    await put(userRoot(), { 'SKILL.md': 'one', 'notes.md': 'n' });
    await seedOwnership(userRoot(), v1);
    const plan = await planInit(deps, { mcps: [], skills: ['demo'], scope: 'user' });
    expect(plan.skills[0]).toMatchObject({ action: 'update', removed: ['notes.md'] });
    expect(plan.skills[0]?.present.map((f) => f.path)).toEqual(['SKILL.md', 'notes.md']);
  });

  it('plans a conflict for an owned tree modified since the install', async () => {
    await put(userRoot(), { 'SKILL.md': 'one', 'notes.md': 'edited' });
    await seedOwnership(userRoot(), v1);
    const plan = await planInit(deps, { mcps: [], skills: ['demo'], scope: 'user' });
    expect(plan.skills[0]?.action).toBe('conflict');
  });

  it('plans a conflict for an unowned tree and a forced update with --force', async () => {
    await put(projectRoot(), { 'SKILL.md': 'mine' });
    expect((await planInit(deps, { mcps: [], skills: ['demo'], scope: 'project' })).skills[0]?.action).toBe('conflict');
    const forced = await planInit(deps, { mcps: [], skills: ['demo'], scope: 'project', force: true });
    expect(forced.skills[0]).toMatchObject({ action: 'update', reason: 'replaced by --force' });
  });

  it('rejects an unknown skill name', async () => {
    await expect(planInit(deps, { mcps: [], skills: ['demo', 'nope'], scope: 'user' })).rejects.toThrow(
      UnknownSkillError,
    );
    await expect(planInit(deps, { mcps: [], skills: ['nope'], scope: 'user' })).rejects.toThrow('unknown skill: nope');
  });

  it('fails planning when the skill directory is a symlink, even with --force', async () => {
    await mkdir(join(projectRoot(), '..'), { recursive: true });
    await mkdir(join(tmp.root, 'elsewhere'));
    await symlink(join(tmp.root, 'elsewhere'), projectRoot());
    for (const force of [false, true]) {
      await expect(planInit(deps, { mcps: [], skills: ['demo'], scope: 'project', force })).rejects.toThrow(
        UnsafeTreeError,
      );
    }
  });

  it('fails planning when the target holds a symlink inside the skill', async () => {
    await put(projectRoot(), { 'SKILL.md': 'x' });
    await symlink(join(tmp.root, 'nowhere'), join(projectRoot(), 'link.md'));
    await expect(planInit(deps, { mcps: [], skills: ['demo'], scope: 'project', force: true })).rejects.toThrow(
      UnsafeTreeError,
    );
  });

  it('plans each skill once when the request repeats a name, keeping first-occurrence order', async () => {
    const other: SkillItem = { ...v1, name: 'other' };
    deps = { ...deps, source: source([v2, other]) };
    const plan = await planInit(deps, { mcps: [], skills: ['demo', 'other', 'demo'], scope: 'user' });
    expect(plan.skills.map((s) => s.root)).toEqual([userRoot(), join(tmp.homeDir, '.claude', 'skills', 'other')]);
  });

  it('fails planning when a listed file vanishes before it is read', async () => {
    await put(projectRoot(), { 'SKILL.md': 'x' });
    const fs = new NodeFileSystem();
    deps = {
      ...deps,
      fs: Object.assign(Object.create(fs) as NodeFileSystem, {
        listFiles: async (dir: string) => [...((await fs.listFiles(dir)) ?? []), 'gone.md'],
      }),
    };
    await expect(planInit(deps, { mcps: [], skills: ['demo'], scope: 'project' })).rejects.toThrow(UnsafeTreeError);
  });

  it('fails planning when a listed file is swapped for a symlink before it is read', async () => {
    await put(projectRoot(), { 'SKILL.md': 'x' });
    await writeFile(join(tmp.root, 'secret'), 'secret');
    const fs = new NodeFileSystem();
    deps = {
      ...deps,
      fs: Object.assign(Object.create(fs) as NodeFileSystem, {
        listFiles: async (dir: string) => {
          const listed = await fs.listFiles(dir);
          await rm(join(projectRoot(), 'SKILL.md'));
          await symlink(join(tmp.root, 'secret'), join(projectRoot(), 'SKILL.md'));
          return listed;
        },
      }),
    };
    await expect(planInit(deps, { mcps: [], skills: ['demo'], scope: 'project' })).rejects.toThrow(UnsafeTreeError);
  });
});

describe('applyPlan (skills)', () => {
  let tmp: TmpPaths;
  let deps: InitDeps;
  const skillsDir = () => join(tmp.cwd, '.claude', 'skills');
  const root = () => join(skillsDir(), 'demo');
  const manifest = async (): Promise<Manifest> => parseManifest(await readFile(manifestPath(tmp.homeDir), 'utf8'));
  const readBytes = async (path: string) => new Uint8Array(await readFile(path));
  const put = async (files: Record<string, string>) => {
    for (const [path, text] of Object.entries(files)) {
      await mkdir(join(root(), path, '..'), { recursive: true });
      await writeFile(join(root(), path), text);
    }
  };
  const install = (skills: string[], extra: { force?: boolean; dryRun?: boolean } = {}) =>
    initMcps(deps, { mcps: [], skills, scope: 'project', ...extra });
  beforeEach(async () => {
    tmp = await makeTmpPaths();
    deps = {
      source: skillSource([DEMO_V1]),
      fs: new NodeFileSystem(),
      target: claudeCodeTarget,
      paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
      env: {},
    };
  });
  afterEach(() => tmp.cleanup());

  it('creates a skill byte-identical, binary file included, in one install record', async () => {
    expect((await install(['demo'])).applied).toBe(true);
    for (const f of DEMO_V1.files) expect(await readBytes(join(root(), f.path))).toEqual(f.bytes);
    const { installs } = await manifest();
    expect(installs).toHaveLength(1);
    const files = installs[0]!.files;
    expect(files.map((f) => f.path).sort()).toEqual(DEMO_V1.files.map((f) => join(root(), f.path)).sort());
    for (const f of files) {
      expect(f).toMatchObject({ scope: 'project', backup: null, beforeHash: null });
      expect(f.afterHash).toBe(sha256(DEMO_V1.files.find((s) => join(root(), s.path) === f.path)!.bytes));
      expect(f.items).toEqual([
        { kind: 'skill', name: 'demo', action: 'create', entryHash: treeHash(DEMO_V1.files), root: root() },
      ]);
    }
  });

  it('records the directories it created, parents first, and none that already existed', async () => {
    await install(['demo']);
    expect((await manifest()).installs[0]?.createdDirs).toEqual([
      join(tmp.cwd, '.claude'),
      skillsDir(),
      root(),
      join(root(), 'assets'),
      join(root(), 'refs'),
    ]);
    await mkdir(join(tmp.cwd, '.claude', 'skills', 'other'), { recursive: true });
    deps = { ...deps, source: skillSource([{ ...DEMO_V1, name: 'second' }]) };
    await install(['second']);
    const dirs = (await manifest()).installs[1]?.createdDirs ?? [];
    expect(dirs[0]).toBe(join(skillsDir(), 'second'));
    expect(dirs).not.toContain(skillsDir());
  });

  it('writes SKILL.md last within a skill', async () => {
    const fs = faultyFs(new NodeFileSystem(), { method: 'remove', nth: 999 });
    deps = { ...deps, fs };
    await install(['demo']);
    const writes = fs.calls.filter((c) => c.startsWith('writeBytes') && c.includes(root()));
    expect(writes).toHaveLength(4);
    expect(writes.at(-1)).toBe(`writeBytes ${join(root(), 'SKILL.md')}`);
  });

  it('updates an owned skill: backs up old bytes first and records the dropped file with a null afterHash', async () => {
    await install(['demo']);
    deps = { ...deps, source: skillSource([DEMO_V2]) };
    expect((await install(['demo'])).applied).toBe(true);
    expect(await readFile(join(root(), 'SKILL.md'), 'utf8')).toContain('two');
    expect(await readdir(join(root(), 'refs'))).toEqual(['a.md']);
    const second = (await manifest()).installs[1]!;
    expect(second.createdDirs).toEqual([]);
    const dropped = second.files.find((f) => f.path === join(root(), 'refs', 'b.md'))!;
    expect(dropped).toMatchObject({ afterHash: null, beforeHash: sha256('b1') });
    expect(await readFile(join(stateDir(tmp.homeDir), dropped.backup!), 'utf8')).toBe('b1');
    const logo = second.files.find((f) => f.path === join(root(), 'assets', 'logo.bin'))!;
    expect(await readBytes(join(stateDir(tmp.homeDir), logo.backup!))).toEqual(DEMO_V1.files[1]!.bytes);
  });

  it('replaces a foreign directory with --force, backing every old file up', async () => {
    await put({ 'SKILL.md': 'mine', 'notes.txt': 'keep me' });
    const { applied } = await install(['demo'], { force: true });
    expect(applied).toBe(true);
    expect((await readdir(root())).sort()).toEqual(['SKILL.md', 'assets', 'refs']);
    const files = (await manifest()).installs[0]!.files;
    const notes = files.find((f) => f.path === join(root(), 'notes.txt'))!;
    expect(notes).toMatchObject({ afterHash: null, beforeHash: sha256('keep me') });
    expect(await readFile(join(stateDir(tmp.homeDir), notes.backup!), 'utf8')).toBe('keep me');
  });

  it('writes nothing for a skip, a conflict, or a dry run', async () => {
    await put({ 'SKILL.md': 'mine' });
    expect((await install(['demo'])).applied).toBe(false);
    expect(await readFile(join(root(), 'SKILL.md'), 'utf8')).toBe('mine');
    expect((await install(['demo'], { force: true, dryRun: true })).applied).toBe(false);
    expect(await readFile(join(root(), 'SKILL.md'), 'utf8')).toBe('mine');
    expect(await readdir(tmp.homeDir)).toEqual([]);
    await rm(root(), { recursive: true });
    await install(['demo']);
    const before = await readFile(manifestPath(tmp.homeDir), 'utf8');
    expect((await install(['demo'])).applied).toBe(false);
    expect(await readFile(manifestPath(tmp.homeDir), 'utf8')).toBe(before);
  });

  it('records MCPs and skills in a single install', async () => {
    deps = { ...deps, source: new FolderCatalogSource(CATALOG, 'bundled'), env: { GITHUB_TOKEN: 'abc123' } };
    await initMcps(deps, { mcps: ['github'], skills: ['example-skill'], scope: 'project' });
    const { installs } = await manifest();
    expect(installs).toHaveLength(1);
    const kinds = installs[0]!.files.map((f) => f.items[0]?.kind);
    expect(kinds[0]).toBe('mcp');
    expect(kinds.slice(1).every((k) => k === 'skill')).toBe(true);
    expect(kinds.length).toBeGreaterThan(1);
    expect(installs[0]?.createdDirs).toContain(join(tmp.cwd, '.claude', 'skills', 'example-skill'));
  });

  it('aborts with StaleFileError when the skill directory changed since planning', async () => {
    const plan = await planInit(deps, { mcps: [], skills: ['demo'], scope: 'project' });
    await put({ 'SKILL.md': 'appeared meanwhile' });
    await expect(applyPlan(deps, plan)).rejects.toThrow(StaleFileError);
    expect(await readdir(root())).toEqual(['SKILL.md']);
    expect(await readFile(join(root(), 'SKILL.md'), 'utf8')).toBe('appeared meanwhile');
    expect(await readdir(tmp.homeDir)).toEqual([]);
  });
});

describe('applyPlan rollback (skills)', () => {
  let tmp: TmpPaths;
  let deps: InitDeps;
  const real = new NodeFileSystem();
  const root = () => join(tmp.cwd, '.claude', 'skills', 'demo');
  const inRoot = (path: string) => path.startsWith(root());
  const inState = (path: string) => path.startsWith(stateDir(tmp.homeDir));
  const withFault = (fault: Parameters<typeof faultyFs>[1]) => {
    const fs = faultyFs(real, fault);
    deps = { ...deps, fs };
    return fs;
  };
  const install = (extra: { force?: boolean; mcps?: string[] } = {}) =>
    initMcps(deps, { mcps: extra.mcps ?? [], skills: ['demo'], scope: 'project', force: extra.force });
  const tree = async (dir: string): Promise<Record<string, string>> => {
    const out: Record<string, string> = {};
    for (const rel of (await real.listFiles(dir)) ?? [])
      out[rel] = Buffer.from((await real.readBytes(join(dir, rel)))!).toString('hex');
    return out;
  };
  beforeEach(async () => {
    tmp = await makeTmpPaths();
    deps = {
      source: skillSource([DEMO_V1]),
      fs: real,
      target: claudeCodeTarget,
      paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
      env: { GITHUB_TOKEN: 'abc123' },
    };
  });
  afterEach(() => tmp.cleanup());

  it('removes what it wrote, in reverse order, when the third of four writes fails', async () => {
    const fs = withFault({ method: 'writeBytes', nth: 3, match: inRoot });
    await expect(install()).rejects.toThrow('injected writeBytes failure');
    const writes = fs.calls.filter((c) => c.startsWith('writeBytes') && c.includes(root()));
    expect(writes).toHaveLength(3);
    expect(fs.calls.filter((c) => c.startsWith('remove'))).toEqual([
      `remove ${join(root(), 'refs', 'a.md')}`,
      `remove ${join(root(), 'assets', 'logo.bin')}`,
    ]);
    expect(await readdir(tmp.cwd)).toEqual([]);
    expect(await readdir(tmp.homeDir)).toEqual([]);
  });

  it('restores a forced replace byte-identical when the last write fails, keeping the backups', async () => {
    await mkdir(join(root(), 'sub'), { recursive: true });
    await writeFile(join(root(), 'SKILL.md'), 'mine');
    await writeFile(join(root(), 'notes.txt'), 'keep me');
    await writeFile(join(root(), 'sub', 'x.bin'), Buffer.from([0xff, 0xfe, 0x00]));
    const original = await tree(root());
    withFault({ method: 'writeBytes', nth: 4, match: inRoot });
    await expect(install({ force: true })).rejects.toThrow('injected writeBytes failure');
    expect(await tree(root())).toEqual(original);
    expect((await readdir(root())).sort()).toEqual(['SKILL.md', 'notes.txt', 'sub']);
    const [id] = await readdir(join(stateDir(tmp.homeDir), 'backups'));
    expect((await readdir(join(stateDir(tmp.homeDir), 'backups', id!))).length).toBe(3);
    await expect(readFile(manifestPath(tmp.homeDir))).rejects.toThrow();
  });

  it('touches nothing in the target when a backup write fails', async () => {
    await mkdir(root(), { recursive: true });
    await writeFile(join(root(), 'SKILL.md'), 'mine');
    withFault({ method: 'writeBytes', nth: 1, match: inState });
    await expect(install({ force: true })).rejects.toThrow('injected writeBytes failure');
    expect(await readdir(root())).toEqual(['SKILL.md']);
    expect(await readFile(join(root(), 'SKILL.md'), 'utf8')).toBe('mine');
    await expect(readFile(manifestPath(tmp.homeDir))).rejects.toThrow();
  });

  it('puts an MCP config written earlier in the same install back when a skill write fails', async () => {
    deps = {
      ...deps,
      source: {
        ...skillSource([DEMO_V1]),
        load: async () => ({ ...(await new FolderCatalogSource(CATALOG, 'bundled').load()), skills: [DEMO_V1] }),
      },
    };
    const original = JSON.stringify({ theme: 'dark', mcpServers: {} });
    await writeFile(join(tmp.cwd, '.mcp.json'), original);
    withFault({ method: 'writeBytes', nth: 2, match: inRoot });
    await expect(install({ mcps: ['github'] })).rejects.toThrow('injected writeBytes failure');
    expect(await readFile(join(tmp.cwd, '.mcp.json'), 'utf8')).toBe(original);
    expect(await readdir(tmp.cwd)).toEqual(['.mcp.json']);
    await expect(readFile(manifestPath(tmp.homeDir))).rejects.toThrow();
  });

  it('reports an incomplete rollback and leaves an orphan directory that the next plan flags as a conflict', async () => {
    withFault({ method: 'writeBytes', nth: 3, match: inRoot });
    const rollbackFs = faultyFs(real, { method: 'remove', nth: 1, sticky: true });
    deps = {
      ...deps,
      fs: Object.assign(Object.create(deps.fs) as typeof deps.fs, {
        remove: (path: string) => rollbackFs.remove(path),
      }),
    };
    await expect(install()).rejects.toThrow(/injected writeBytes failure.*rollback incomplete/);
    expect(((await real.listFiles(root())) ?? []).length).toBe(2);
    const plan = await planInit({ ...deps, fs: real }, { mcps: [], skills: ['demo'], scope: 'project' });
    expect(plan.skills[0]).toMatchObject({ action: 'conflict' });
  });

  it('keeps rolling back the skill and reports it when restoring the MCP config also fails', async () => {
    deps = {
      ...deps,
      source: {
        ...skillSource([DEMO_V1]),
        load: async () => ({ ...(await new FolderCatalogSource(CATALOG, 'bundled').load()), skills: [DEMO_V1] }),
      },
    };
    await writeFile(join(tmp.cwd, '.mcp.json'), JSON.stringify({ mcpServers: {} }));
    const mcpFile = join(tmp.cwd, '.mcp.json');
    // writeAtomic 1 is the install of the config, writeAtomic 2 (sticky) its rollback restore.
    const skillFault = faultyFs(real, { method: 'writeBytes', nth: 2, match: inRoot });
    const mcpFault = faultyFs(real, { method: 'writeAtomic', nth: 2, sticky: true, match: (p) => p === mcpFile });
    deps = {
      ...deps,
      fs: Object.assign(Object.create(real) as typeof real, {
        writeBytes: (path: string, data: Uint8Array) => skillFault.writeBytes(path, data),
        writeAtomic: (path: string, data: string) => mcpFault.writeAtomic(path, data),
      }),
    };
    await expect(install({ mcps: ['github'] })).rejects.toThrow(/injected writeBytes failure.*rollback incomplete/);
    expect(await readdir(join(tmp.cwd, '.claude', 'skills')).catch(() => [])).toEqual([]);
    await expect(readFile(manifestPath(tmp.homeDir))).rejects.toThrow();
  });
});

describe('planInit (scripts)', () => {
  let tmp: TmpPaths;
  let deps: InitDeps;
  const projectRoot = () => join(tmp.cwd, '.shitaku', 'scripts', 'lint');
  const userRoot = () => join(tmp.homeDir, '.claude', '.shitaku', 'scripts', 'lint');
  beforeEach(async () => {
    tmp = await makeTmpPaths();
    deps = {
      source: scriptSource([SCRIPT_V1]),
      fs: new NodeFileSystem(),
      target: claudeCodeTarget,
      paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
      env: {},
    };
  });
  afterEach(() => tmp.cleanup());

  it('plans a create under ./.shitaku/scripts for project scope and never under agent skill dirs', async () => {
    const plan = await planInit(deps, { mcps: [], scripts: ['lint'], scope: 'project' });
    expect(plan.scripts).toHaveLength(1);
    expect(plan.scripts[0]).toMatchObject({ name: 'lint', root: projectRoot(), action: 'create', presentHash: null });
    expect(plan.scripts[0]?.root).not.toContain('.claude/skills');
    expect(plan.skills).toEqual([]);
  });

  it('plans under stateDir/scripts for user scope', async () => {
    const plan = await planInit(deps, { mcps: [], scripts: ['lint'], scope: 'user' });
    expect(plan.scripts[0]?.root).toBe(userRoot());
  });

  it('rejects an unknown script name and writes nothing', async () => {
    await expect(planInit(deps, { mcps: [], scripts: ['lint', 'ghost'], scope: 'project' })).rejects.toThrow(
      UnknownScriptError,
    );
    await expect(planInit(deps, { mcps: [], scripts: ['ghost'], scope: 'project' })).rejects.toThrow(
      'unknown script: ghost',
    );
    expect(await readdir(tmp.cwd)).toEqual([]);
  });

  it('plans a conflict for an unowned tree and a forced update', async () => {
    await mkdir(projectRoot(), { recursive: true });
    await writeFile(join(projectRoot(), 'index.mjs'), 'mine');
    expect((await planInit(deps, { mcps: [], scripts: ['lint'], scope: 'project' })).scripts[0]?.action).toBe(
      'conflict',
    );
    const forced = await planInit(deps, { mcps: [], scripts: ['lint'], scope: 'project', force: true });
    expect(forced.scripts[0]).toMatchObject({ action: 'update', reason: 'replaced by --force' });
  });
});

describe('applyPlan (scripts)', () => {
  let tmp: TmpPaths;
  let deps: InitDeps;
  const root = () => join(tmp.cwd, '.shitaku', 'scripts', 'lint');
  const manifest = async (): Promise<Manifest> => parseManifest(await readFile(manifestPath(tmp.homeDir), 'utf8'));
  const install = (scripts: string[], extra: { force?: boolean; dryRun?: boolean } = {}) =>
    initMcps(deps, { mcps: [], scripts, scope: 'project', ...extra });
  const put = async (files: Record<string, string>) => {
    for (const [rel, text] of Object.entries(files)) {
      await mkdir(join(root(), dirname(rel)), { recursive: true });
      await writeFile(join(root(), rel), text);
    }
  };
  beforeEach(async () => {
    tmp = await makeTmpPaths();
    deps = {
      source: scriptSource([SCRIPT_V1]),
      fs: new NodeFileSystem(),
      target: claudeCodeTarget,
      paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
      env: {},
    };
  });
  afterEach(() => tmp.cleanup());

  it('creates a script byte-identical under .shitaku/scripts with kind script in the manifest', async () => {
    expect((await install(['lint'])).applied).toBe(true);
    expect(await readFile(join(root(), 'index.mjs'), 'utf8')).toBe('export default 1;\n');
    const file = (await manifest()).installs[0]!.files.find((f) => f.path.endsWith('index.mjs'))!;
    expect(file.items[0]).toMatchObject({
      kind: 'script',
      name: 'lint',
      action: 'create',
      entryHash: treeHash(SCRIPT_V1.files),
      root: root(),
    });
  });

  it('writes nothing on dry-run conflict or skip', async () => {
    await put({ 'index.mjs': 'mine' });
    expect((await install(['lint'])).applied).toBe(false);
    expect(await readFile(join(root(), 'index.mjs'), 'utf8')).toBe('mine');
    expect((await install(['lint'], { force: true, dryRun: true })).applied).toBe(false);
    expect(await readFile(join(root(), 'index.mjs'), 'utf8')).toBe('mine');
    expect(await readdir(tmp.homeDir)).toEqual([]);
  });

  it('writes index.mjs last within a script', async () => {
    const fs = faultyFs(new NodeFileSystem(), { method: 'remove', nth: 999 });
    deps = { ...deps, fs };
    await install(['lint']);
    const writes = fs.calls.filter((c) => c.startsWith('writeBytes') && c.includes(root()));
    expect(writes).toHaveLength(4);
    expect(writes.at(-1)).toBe(`writeBytes ${join(root(), 'index.mjs')}`);
  });

  it('updates an owned script and records dropped files with null afterHash', async () => {
    await install(['lint']);
    deps = { ...deps, source: scriptSource([SCRIPT_V2]) };
    expect((await install(['lint'])).applied).toBe(true);
    expect(await readFile(join(root(), 'index.mjs'), 'utf8')).toBe('export default 2;\n');
    const second = (await manifest()).installs[1]!;
    const dropped = second.files.find((f) => f.path === join(root(), 'refs', 'a.md'))!;
    expect(dropped).toMatchObject({ afterHash: null, beforeHash: sha256('a1') });
  });
});

describe('applyPlan rollback (scripts)', () => {
  let tmp: TmpPaths;
  let deps: InitDeps;
  const real = new NodeFileSystem();
  const root = () => join(tmp.cwd, '.shitaku', 'scripts', 'lint');
  const inRoot = (path: string) => path.startsWith(root());
  const withFault = (fault: Parameters<typeof faultyFs>[1]) => {
    const fs = faultyFs(real, fault);
    deps = { ...deps, fs };
    return fs;
  };
  const install = (extra: { force?: boolean } = {}) =>
    initMcps(deps, { mcps: [], scripts: ['lint'], scope: 'project', force: extra.force });
  const tree = async (dir: string): Promise<Record<string, string>> => {
    const out: Record<string, string> = {};
    for (const rel of (await real.listFiles(dir)) ?? [])
      out[rel] = Buffer.from((await real.readBytes(join(dir, rel)))!).toString('hex');
    return out;
  };
  beforeEach(async () => {
    tmp = await makeTmpPaths();
    deps = {
      source: scriptSource([SCRIPT_V1]),
      fs: real,
      target: claudeCodeTarget,
      paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
      env: {},
    };
  });
  afterEach(() => tmp.cleanup());

  it('removes what it wrote when a mid-script write fails, leaving no manifest row', async () => {
    const fs = withFault({ method: 'writeBytes', nth: 3, match: inRoot });
    await expect(install()).rejects.toThrow('injected writeBytes failure');
    expect(fs.calls.filter((c) => c.startsWith('writeBytes') && c.includes(root())).length).toBe(3);
    expect(await readdir(tmp.cwd)).toEqual([]);
    expect(await readdir(tmp.homeDir)).toEqual([]);
    await expect(readFile(manifestPath(tmp.homeDir))).rejects.toThrow();
  });

  it('restores a forced replace byte-identical when a later write fails', async () => {
    await mkdir(join(root(), 'sub'), { recursive: true });
    await writeFile(join(root(), 'index.mjs'), 'mine');
    await writeFile(join(root(), 'notes.txt'), 'keep me');
    await writeFile(join(root(), 'sub', 'x.bin'), Buffer.from([0xff, 0xfe, 0x00]));
    const original = await tree(root());
    withFault({ method: 'writeBytes', nth: 4, match: inRoot });
    await expect(install({ force: true })).rejects.toThrow('injected writeBytes failure');
    expect(await tree(root())).toEqual(original);
    await expect(readFile(manifestPath(tmp.homeDir))).rejects.toThrow();
  });
});

describe('initMcps (bundled complexity script)', () => {
  let tmp: TmpPaths;
  let deps: InitDeps;
  const root = () => join(tmp.cwd, '.shitaku', 'scripts', 'complexity');

  beforeEach(async () => {
    tmp = await makeTmpPaths();
    deps = {
      source: new FolderCatalogSource(CATALOG, 'bundled'),
      fs: new NodeFileSystem(),
      target: claudeCodeTarget,
      paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
      env: {},
    };
  });
  afterEach(() => tmp.cleanup());

  it('installs complexity under ./.shitaku/scripts with index.mjs and shipped eslint config', async () => {
    const { applied } = await initMcps(deps, { mcps: [], scripts: ['complexity'], scope: 'project' });
    expect(applied).toBe(true);
    expect(await readdir(root())).toEqual(
      expect.arrayContaining([
        'index.mjs',
        'script.json',
        'complexity.eslint.config.mjs',
        'eslint.rules.mjs',
        'package.json',
        'package-lock.json',
      ]),
    );
    expect(await readFile(join(root(), 'index.mjs'), 'utf8')).toContain('complexity');
    expect(await readFile(join(root(), 'complexity.eslint.config.mjs'), 'utf8')).toMatch(/includeIgnoreFile|eslint/);
    expect(await readdir(join(tmp.cwd, '.claude', 'skills')).catch(() => [])).toEqual([]);
  });
});

describe('initMcps (bundled dead-code script)', () => {
  let tmp: TmpPaths;
  let deps: InitDeps;
  const root = () => join(tmp.cwd, '.shitaku', 'scripts', 'dead-code');

  beforeEach(async () => {
    tmp = await makeTmpPaths();
    deps = {
      source: new FolderCatalogSource(CATALOG, 'bundled'),
      fs: new NodeFileSystem(),
      target: claudeCodeTarget,
      paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
      env: {},
    };
  });
  afterEach(() => tmp.cleanup());

  it('installs dead-code under ./.shitaku/scripts with index.mjs and no script-root npm bootstrap', async () => {
    const { applied } = await initMcps(deps, { mcps: [], scripts: ['dead-code'], scope: 'project' });
    expect(applied).toBe(true);
    const entries = (await readdir(root())).sort();
    expect(entries).toEqual(['index.mjs', 'script.json']);
    expect(entries).not.toContain('package.json');
    expect(entries).not.toContain('package-lock.json');
    expect(entries).not.toContain('node_modules');
    expect(await readFile(join(root(), 'index.mjs'), 'utf8')).toContain('dead-code');
    expect(await readFile(join(root(), 'script.json'), 'utf8')).toMatch(/knip/);
    expect(await readdir(join(tmp.cwd, '.claude', 'skills')).catch(() => [])).toEqual([]);
  });
});

describe('initMcps (bundled duplication script)', () => {
  let tmp: TmpPaths;
  let deps: InitDeps;
  const root = () => join(tmp.cwd, '.shitaku', 'scripts', 'duplication');

  beforeEach(async () => {
    tmp = await makeTmpPaths();
    deps = {
      source: new FolderCatalogSource(CATALOG, 'bundled'),
      fs: new NodeFileSystem(),
      target: claudeCodeTarget,
      paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
      env: {},
    };
  });
  afterEach(() => tmp.cleanup());

  it('installs duplication under ./.shitaku/scripts with index.mjs and no script-root npm bootstrap', async () => {
    const { applied } = await initMcps(deps, { mcps: [], scripts: ['duplication'], scope: 'project' });
    expect(applied).toBe(true);
    const entries = (await readdir(root())).sort();
    expect(entries).toEqual(['index.mjs', 'script.json']);
    expect(entries).not.toContain('package.json');
    expect(entries).not.toContain('package-lock.json');
    expect(entries).not.toContain('node_modules');
    expect(await readFile(join(root(), 'index.mjs'), 'utf8')).toContain('duplication');
    expect(await readFile(join(root(), 'script.json'), 'utf8')).toMatch(/jscpd/);
    expect(await readdir(join(tmp.cwd, '.claude', 'skills')).catch(() => [])).toEqual([]);
  });
});

describe('initMcps (commands)', () => {
  let tmp: TmpPaths;
  let deps: InitDeps;
  const real = new NodeFileSystem();
  const dir = (scope: Scope = 'project') => join(scope === 'user' ? tmp.homeDir : tmp.cwd, '.claude', 'commands');
  const file = (scope: Scope = 'project') => join(dir(scope), 'review.md');
  const manifest = async (): Promise<Manifest> => parseManifest(await readFile(manifestPath(tmp.homeDir), 'utf8'));
  const install = (extra: { force?: boolean; dryRun?: boolean; scope?: Scope; commands?: string[] } = {}) =>
    initMcps(deps, { mcps: [], commands: extra.commands ?? ['review'], scope: extra.scope ?? 'project', ...extra });
  const mine = async () => {
    await mkdir(dir(), { recursive: true });
    await writeFile(file(), 'mine');
  };
  const withFault = (fault: Parameters<typeof faultyFs>[1]) => {
    const fs = faultyFs(real, fault);
    deps = { ...deps, fs };
    return fs;
  };
  const isManifest = (path: string) => path === manifestPath(tmp.homeDir);
  beforeEach(async () => {
    tmp = await makeTmpPaths();
    deps = {
      source: commandSource([REVIEW_V1]),
      fs: real,
      target: claudeCodeTarget,
      paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
      env: {},
    };
  });
  afterEach(() => tmp.cleanup());

  it.each<Scope>(['user', 'project'])('writes catalog-identical bytes at the %s root', async (scope) => {
    expect((await install({ scope })).applied).toBe(true);
    expect(new Uint8Array(await readFile(file(scope)))).toEqual(REVIEW_V1.bytes);
  });

  it('records one command file entry rooted at its path, with the directories it created', async () => {
    await install();
    const [record] = (await manifest()).installs;
    expect(record!.createdDirs).toEqual([join(tmp.cwd, '.claude'), dir()]);
    expect(record!.files).toEqual([
      {
        path: file(),
        scope: 'project',
        backup: null,
        beforeHash: null,
        afterHash: sha256(REVIEW_V1.bytes),
        items: [
          { kind: 'command', name: 'review', action: 'create', entryHash: sha256(REVIEW_V1.bytes), root: file() },
        ],
      },
    ]);
  });

  it('writes through writeBytes (temp then rename) and leaves a neighbor command untouched', async () => {
    await mkdir(dir(), { recursive: true });
    await writeFile(join(dir(), 'mine.md'), 'mine');
    const fs = withFault({ method: 'remove', nth: 99 });
    await install();
    expect(fs.calls).toContain(`writeBytes ${file()}`);
    expect(await readFile(join(dir(), 'mine.md'), 'utf8')).toBe('mine');
  });

  it('skips a file that already equals the catalog without writing', async () => {
    await mkdir(dir(), { recursive: true });
    await writeFile(file(), REVIEW_V1.bytes);
    expect((await install()).applied).toBe(false);
    await expect(readFile(manifestPath(tmp.homeDir))).rejects.toThrow();
  });

  it('plans a conflict for an unmanaged file and writes nothing without --force', async () => {
    await mine();
    const { plan, applied } = await install();
    expect(plan.commands[0]).toMatchObject({ name: 'review', action: 'conflict' });
    expect(applied).toBe(false);
    expect(await readFile(file(), 'utf8')).toBe('mine');
    await expect(readFile(manifestPath(tmp.homeDir))).rejects.toThrow();
    await expect(readdir(join(stateDir(tmp.homeDir), 'backups'))).rejects.toThrow();
  });

  it('replaces an unmanaged file with --force after a byte-identical backup', async () => {
    await mine();
    expect((await install({ force: true })).applied).toBe(true);
    expect(new Uint8Array(await readFile(file()))).toEqual(REVIEW_V1.bytes);
    const [entry] = (await manifest()).installs[0]!.files;
    expect(entry!.beforeHash).toBe(sha256('mine'));
    expect(entry!.backup).toMatch(/-review\.md$/);
    expect(await readFile(join(stateDir(tmp.homeDir), entry!.backup!), 'utf8')).toBe('mine');
  });

  it('updates an owned command that is unmodified on disk', async () => {
    await install();
    deps = { ...deps, source: commandSource([REVIEW_V2]) };
    expect((await install()).plan.commands[0]).toMatchObject({ action: 'update' });
    expect(new Uint8Array(await readFile(file()))).toEqual(REVIEW_V2.bytes);
  });

  it('writes nothing on dry run', async () => {
    const { plan, applied } = await install({ dryRun: true });
    expect(plan.commands[0]).toMatchObject({ action: 'create' });
    expect(applied).toBe(false);
    expect(await readdir(tmp.cwd)).toEqual([]);
    expect(await readdir(tmp.homeDir)).toEqual([]);
  });

  it('rejects an unknown command naming it, writing nothing', async () => {
    await expect(install({ commands: ['review', 'ghost'] })).rejects.toThrow(UnknownCommandError);
    await expect(install({ commands: ['ghost'] })).rejects.toThrow('ghost');
    expect(await readdir(tmp.cwd)).toEqual([]);
    expect(await readdir(tmp.homeDir)).toEqual([]);
  });

  it('removes the file and the directories it created, with no manifest entry, when the write fails', async () => {
    withFault({ method: 'writeBytes', nth: 1, match: (p) => p === file() });
    await expect(install()).rejects.toThrow('injected writeBytes failure');
    expect(await readdir(tmp.cwd)).toEqual([]);
    await expect(readFile(manifestPath(tmp.homeDir))).rejects.toThrow();
  });

  it('removes the file and the created directories when recording the manifest fails', async () => {
    withFault({ method: 'writeAtomic', nth: 1, match: isManifest });
    await expect(install()).rejects.toThrow('injected writeAtomic failure');
    expect(await readdir(tmp.cwd)).toEqual([]);
    await expect(readFile(manifestPath(tmp.homeDir))).rejects.toThrow();
  });

  it('restores a forced replace byte-identical when the apply fails after the backup, keeping the backup', async () => {
    await mine();
    withFault({ method: 'writeAtomic', nth: 1, match: isManifest });
    await expect(install({ force: true })).rejects.toThrow('injected writeAtomic failure');
    expect(await readFile(file(), 'utf8')).toBe('mine');
    const [id] = await readdir(join(stateDir(tmp.homeDir), 'backups'));
    expect(await readdir(join(stateDir(tmp.homeDir), 'backups', id!))).toHaveLength(1);
    await expect(readFile(manifestPath(tmp.homeDir))).rejects.toThrow();
  });

  it('aborts with StaleFileError when the file changed between planning and applying', async () => {
    const plan = await planInit(deps, { mcps: [], commands: ['review'], scope: 'project' });
    await mine();
    await expect(applyPlan(deps, plan)).rejects.toThrow(StaleFileError);
    expect(await readFile(file(), 'utf8')).toBe('mine');
  });
});
