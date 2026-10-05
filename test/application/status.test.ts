import { mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { claudeCodeTarget } from '@/adapters/claude-code/target.js';
import { NodeFileSystem } from '@/adapters/fs/node-fs.js';
import { initMcps, type InitDeps } from '@/application/init-mcps.js';
import { loadManifest, manifestPath, saveManifest } from '@/application/journal.js';
import { getStatus } from '@/application/status.js';
import type { McpItem } from '@/domain/catalog/schema.js';
import type { SkillItem } from '@/domain/catalog/skill.js';
import { ManifestError } from '@/domain/manifest.js';
import type { LoadedCatalog } from '@/ports/catalog-source.js';
import type { FileSystem } from '@/ports/file-system.js';
import { DEMO_V1, DEMO_V2 } from '@test/helpers/skills.js';
import { makeTmpPaths, type TmpPaths } from '@test/helpers/tmp-paths.js';

const mcp = (name: string, url: string, extra: Partial<McpItem> = {}): McpItem => ({
  name,
  description: name,
  server: { type: 'http', url },
  env: [],
  ...extra,
});

const GITHUB = mcp('github', 'https://example.com/github');
const CONTEXT7 = mcp('context7', 'https://example.com/context7');

describe('getStatus', () => {
  let tmp: TmpPaths;
  let catalog: LoadedCatalog | Error;
  let fs: FileSystem;
  const source = {
    ref: () => ({ kind: 'folder' as const, location: '/catalog' }),
    load: () => (catalog instanceof Error ? Promise.reject(catalog) : Promise.resolve(catalog)),
  };
  const setCatalog = (mcps: McpItem[], skills: SkillItem[] = []): void => {
    catalog = { mcps, skills, scripts: [], profiles: [], issues: [] };
  };
  const deps = (): InitDeps => ({
    source,
    fs,
    target: claudeCodeTarget,
    paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
    env: {},
  });
  const projectFile = () => join(tmp.cwd, '.mcp.json');
  const userFile = () => join(tmp.homeDir, '.claude.json');
  const projectSkill = () => join(tmp.cwd, '.claude', 'skills', 'demo');
  const statesOf = async (req: { scope?: 'project' | 'user' } = {}) =>
    Object.fromEntries((await getStatus(deps(), req)).items.map((i) => [`${i.scope}/${i.kind}/${i.name}`, i.state]));

  beforeEach(async () => {
    tmp = await makeTmpPaths();
    fs = new NodeFileSystem();
    setCatalog([GITHUB, CONTEXT7], [DEMO_V1]);
  });
  afterEach(() => tmp.cleanup());

  async function installAll(): Promise<void> {
    await initMcps(deps(), { mcps: ['github'], skills: ['demo'], scope: 'project' });
  }

  it('reports installed items with their path, install id and the target', async () => {
    await installAll();
    const report = await getStatus(deps(), {});
    expect(report).toMatchObject({ target: 'claude-code', catalog: 'available', issues: [] });
    expect(report.items).toEqual([
      expect.objectContaining({
        scope: 'project',
        kind: 'mcp',
        name: 'github',
        state: 'installed',
        path: projectFile(),
      }),
      expect.objectContaining({
        scope: 'project',
        kind: 'skill',
        name: 'demo',
        state: 'installed',
        path: projectSkill(),
      }),
    ]);
    expect(report.items[0]?.installId).toMatch(/^\d{8}T\d{6}Z-[0-9a-f]{4}$/);
  });

  it('reports modified when an MCP entry or a skill file was edited', async () => {
    await installAll();
    await writeFile(projectFile(), (await readFile(projectFile(), 'utf8')).replace('/github', '/mine'));
    await writeFile(join(projectSkill(), 'refs/a.md'), 'edited');
    expect(await statesOf()).toEqual({ 'project/mcp/github': 'modified', 'project/skill/demo': 'modified' });
  });

  it('reports out-of-date when the catalog moved on and the disk still matches the install', async () => {
    await installAll();
    setCatalog([mcp('github', 'https://example.com/v2')], [DEMO_V2]);
    expect(await statesOf()).toEqual({ 'project/mcp/github': 'out-of-date', 'project/skill/demo': 'out-of-date' });
  });

  it('reports missing when the entry or the skill directory is gone', async () => {
    await installAll();
    await writeFile(projectFile(), '{"mcpServers":{}}');
    await rm(projectSkill(), { recursive: true });
    expect(await statesOf()).toEqual({ 'project/mcp/github': 'missing', 'project/skill/demo': 'missing' });
  });

  it('reports missing-from-catalog when the catalog dropped the item or the target cannot take it', async () => {
    await installAll();
    setCatalog([], []);
    expect(await statesOf()).toEqual({
      'project/mcp/github': 'missing-from-catalog',
      'project/skill/demo': 'missing-from-catalog',
    });
    setCatalog([mcp('github', 'https://example.com/github', { targets: ['other-agent'] })], [DEMO_V1]);
    expect((await statesOf())['project/mcp/github']).toBe('missing-from-catalog');
  });

  it('reports unknown when the catalog fails to load, keeping missing and modified', async () => {
    await initMcps(deps(), { mcps: ['github', 'context7'], skills: ['demo'], scope: 'project' });
    await writeFile(join(projectSkill(), 'refs/a.md'), 'edited');
    await writeFile(projectFile(), (await readFile(projectFile(), 'utf8')).replace('context7', 'other'));
    catalog = new Error('catalog.json is missing');
    const report = await getStatus(deps(), {});
    expect(report.catalog).toBe('unavailable');
    expect(await statesOf()).toEqual({
      'project/mcp/context7': 'missing',
      'project/mcp/github': 'unknown',
      'project/skill/demo': 'modified',
    });
  });

  it('carries the catalog issues of a partially valid catalog', async () => {
    await installAll();
    catalog = {
      mcps: [GITHUB],
      skills: [DEMO_V1],
      scripts: [],
      profiles: [],
      issues: [{ file: 'mcps/bad.json', reason: 'invalid' }],
    };
    expect((await getStatus(deps(), {})).issues).toEqual([{ file: 'mcps/bad.json', reason: 'invalid' }]);
  });

  describe('scope and ownership', () => {
    it('lists both scopes by default and only the requested one with a filter', async () => {
      await initMcps(deps(), { mcps: ['github'], scope: 'project' });
      await initMcps(deps(), { mcps: ['github'], scope: 'user' });
      expect(await statesOf()).toEqual({ 'project/mcp/github': 'installed', 'user/mcp/github': 'installed' });
      expect(await statesOf({ scope: 'user' })).toEqual({ 'user/mcp/github': 'installed' });
    });

    it('never reads the other scope when filtered', async () => {
      await initMcps(deps(), { mcps: ['github'], scope: 'project' });
      await initMcps(deps(), { mcps: ['context7'], scope: 'user' });
      const reads: string[] = [];
      fs = Object.assign(Object.create(fs) as FileSystem, {
        readText: (path: string) => (reads.push(path), new NodeFileSystem().readText(path)),
      });
      await getStatus(deps(), { scope: 'project' });
      expect(reads).toContain(projectFile());
      expect(reads).not.toContain(userFile());
    });

    it('ignores config entries that shitaku does not own', async () => {
      await writeFile(projectFile(), JSON.stringify({ mcpServers: { handmade: { type: 'stdio', command: 'x' } } }));
      await initMcps(deps(), { mcps: ['github'], scope: 'project' });
      expect(await statesOf()).toEqual({ 'project/mcp/github': 'installed' });
    });

    it('returns no items for an empty manifest', async () => {
      const report = await getStatus(deps(), {});
      expect(report).toEqual({ target: 'claude-code', catalog: 'available', items: [], issues: [] });
    });

    it('sorts items by scope, kind, name and path', async () => {
      setCatalog([GITHUB, CONTEXT7], [DEMO_V1]);
      await initMcps(deps(), { mcps: ['github', 'context7'], skills: ['demo'], scope: 'user' });
      await initMcps(deps(), { mcps: ['github'], scope: 'project' });
      const keys = (await getStatus(deps(), {})).items.map((i) => `${i.scope}/${i.kind}/${i.name}`);
      expect(keys).toEqual(['project/mcp/github', 'user/mcp/context7', 'user/mcp/github', 'user/skill/demo']);
    });

    it('rejects with ManifestError when the manifest is corrupt', async () => {
      await mkdir(join(tmp.homeDir, '.claude', '.shitaku'), { recursive: true });
      await writeFile(manifestPath(tmp.homeDir), '{not json');
      await expect(getStatus(deps(), {})).rejects.toThrow(ManifestError);
    });
  });

  describe('unreadable disk state', () => {
    it('reports a symlinked skill directory as modified', async () => {
      await installAll();
      await rm(projectSkill(), { recursive: true });
      await mkdir(join(tmp.root, 'elsewhere'));
      await symlink(join(tmp.root, 'elsewhere'), projectSkill());
      expect(await statesOf()).toEqual({ 'project/mcp/github': 'installed', 'project/skill/demo': 'modified' });
    });

    it('marks every item of a corrupt config file modified while other files classify normally', async () => {
      await initMcps(deps(), { mcps: ['github'], scope: 'project' });
      await initMcps(deps(), { mcps: ['github'], scope: 'user' });
      await writeFile(projectFile(), '{broken');
      expect(await statesOf()).toEqual({ 'project/mcp/github': 'modified', 'user/mcp/github': 'installed' });
    });

    it.each(['EACCES', 'EPERM', 'ENOTDIR', 'EISDIR', 'ELOOP'])(
      'maps %s on a config read or a skill tree read to modified per item',
      async (code) => {
        await installAll();
        const fail = () => Promise.reject(Object.assign(new Error(code), { code }));
        const real = fs;
        fs = Object.assign(Object.create(real) as FileSystem, {
          readText: (path: string) => (path === projectFile() ? fail() : real.readText(path)),
          listFiles: fail,
        });
        expect(await statesOf()).toEqual({ 'project/mcp/github': 'modified', 'project/skill/demo': 'modified' });
      },
    );

    it('reports items under a parent that is a regular file as modified (ENOTDIR)', async () => {
      await installAll();
      await rm(tmp.cwd, { recursive: true });
      await writeFile(tmp.cwd, 'not a directory');
      expect(await statesOf()).toEqual({ 'project/mcp/github': 'modified', 'project/skill/demo': 'modified' });
    });

    it('reports an empty skill directory as missing', async () => {
      await installAll();
      await rm(projectSkill(), { recursive: true });
      await mkdir(projectSkill());
      expect((await statesOf())['project/skill/demo']).toBe('missing');
    });

    it('ignores undone installs', async () => {
      await installAll();
      const manifest = await loadManifest(fs, tmp.homeDir);
      await saveManifest(fs, tmp.homeDir, {
        ...manifest,
        installs: manifest.installs.map((i) => ({ ...i, undoneAt: '2026-01-01T00:00:00Z' })),
      });
      expect(await statesOf()).toEqual({});
    });

    it('reports unchanged items as unknown when the catalog fails to load', async () => {
      await installAll();
      catalog = new Error('catalog.json is missing');
      expect(await statesOf()).toEqual({ 'project/mcp/github': 'unknown', 'project/skill/demo': 'unknown' });
    });

    it('lets unexpected errors propagate', async () => {
      await installAll();
      fs = Object.assign(Object.create(fs) as FileSystem, {
        readText: () => Promise.reject(new Error('disk on fire')),
      });
      await expect(getStatus(deps(), {})).rejects.toThrow('disk on fire');
    });
  });

  it('never writes: every write method of the file system rejects', async () => {
    await installAll();
    const attempts: string[] = [];
    const reject = (method: string) => () => {
      attempts.push(method);
      return Promise.reject(new Error(`unexpected ${method}`));
    };
    fs = Object.assign(Object.create(fs) as FileSystem, {
      writeAtomic: reject('writeAtomic'),
      writeBytes: reject('writeBytes'),
      remove: reject('remove'),
      mkdirp: reject('mkdirp'),
      removeDir: reject('removeDir'),
    });
    const report = await getStatus(deps(), {});
    expect(report.items.map((i) => i.state)).toEqual(['installed', 'installed']);
    expect(attempts).toEqual([]);
  });
});
