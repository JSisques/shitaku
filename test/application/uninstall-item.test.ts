import { access, lstat, mkdir, readFile, readdir, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FolderCatalogSource } from '@/adapters/catalog/folder-source.js';
import { claudeCodeTarget } from '@/adapters/claude-code/target.js';
import { NodeFileSystem } from '@/adapters/fs/node-fs.js';
import { initMcps, StaleFileError, type InitDeps } from '@/application/init-mcps.js';
import { loadManifest, manifestPath, stateDir } from '@/application/journal.js';
import { getStatus } from '@/application/status.js';
import { undoInstall, UndoSelectionError } from '@/application/undo-install.js';
import { uninstallItem, UninstallSelectionError, type UninstallRequest } from '@/application/uninstall-item.js';
import { UnsafeTreeError, type FileSystem } from '@/ports/file-system.js';
import { DEMO_V1, faultyFs, skillSource } from '@test/helpers/skills.js';
import { SCRIPT_V1, scriptSource } from '@test/helpers/scripts.js';
import { makeTmpPaths, type TmpPaths } from '@test/helpers/tmp-paths.js';

const CATALOG = join(import.meta.dirname, '..', '..', 'catalog');
const SKILL_MD = '---\nname: demo\n---\none';

/** Runs `mutate` just before the second `method` call on `path`: the gap between planning and applying. */
function racy(
  fs: NodeFileSystem,
  method: 'readText' | 'listFiles',
  path: string,
  mutate: () => Promise<void>,
): FileSystem {
  let seen = 0;
  return Object.assign(Object.create(fs) as FileSystem, {
    [method]: async (p: string) => {
      if (p === path && ++seen === 2) await mutate();
      return fs[method](p);
    },
  });
}

describe('uninstallItem', () => {
  let tmp: TmpPaths;
  let fs: NodeFileSystem;
  let mcpDeps: InitDeps;
  let skillDeps: InitDeps;
  const mcpFile = () => join(tmp.cwd, '.mcp.json');
  const userFile = () => join(tmp.homeDir, '.claude.json');
  const root = () => join(tmp.cwd, '.claude', 'skills', 'demo');
  const read = (path: string) => readFile(path, 'utf8');
  const manifestText = () => read(manifestPath(tmp.homeDir));
  const exists = (path: string) =>
    access(path).then(
      () => true,
      () => false,
    );
  const uninstall = (req: UninstallRequest, over: { fs?: FileSystem; cwd?: string } = {}) =>
    uninstallItem(
      { fs: over.fs ?? fs, target: claudeCodeTarget, paths: { homeDir: tmp.homeDir, cwd: over.cwd ?? tmp.cwd } },
      req,
    );
  const installMcp = (name: string, scope: 'project' | 'user' = 'project') =>
    initMcps(mcpDeps, { mcps: [name], scope });
  const installSkill = (scope: 'project' | 'user' = 'project') =>
    initMcps(skillDeps, { mcps: [], skills: ['demo'], scope });
  const servers = async (path: string) => (JSON.parse(await read(path)) as { mcpServers: object }).mcpServers;

  beforeEach(async () => {
    tmp = await makeTmpPaths();
    fs = new NodeFileSystem();
    const common = { fs, target: claudeCodeTarget, paths: { homeDir: tmp.homeDir, cwd: tmp.cwd }, env: {} };
    mcpDeps = { ...common, source: new FolderCatalogSource(CATALOG, 'bundled') };
    skillDeps = { ...common, source: skillSource([DEMO_V1, { ...DEMO_V1, name: 'github' }]) };
  });
  afterEach(() => tmp.cleanup());

  describe('resolution', () => {
    it('rejects a name shitaku does not own, even with --force, and writes nothing', async () => {
      const unmanaged = JSON.stringify({ mcpServers: { ghost: { type: 'stdio', command: 'x' } } });
      await writeFile(mcpFile(), unmanaged);
      await expect(uninstall({ name: 'ghost', force: true })).rejects.toThrow(UninstallSelectionError);
      expect(await read(mcpFile())).toBe(unmanaged);
      expect(await readdir(tmp.homeDir)).toEqual([]);
    });

    it('rejects a name that was never installed when other items are owned', async () => {
      await installMcp('github');
      await expect(uninstall({ name: 'context7' })).rejects.toThrow(/context7/);
    });

    it('infers the scope when the name is owned in exactly one', async () => {
      await installMcp('context7', 'user');
      const result = await uninstall({ name: 'context7' });
      expect(result).toMatchObject({ status: 'removed', exitCode: 0, item: { kind: 'mcp', scope: 'user' } });
      expect(await servers(userFile())).toEqual({});
    });

    it('lists both candidates when the name is owned in two scopes, and --scope narrows', async () => {
      await installMcp('github', 'project');
      await installMcp('github', 'user');
      const before = await manifestText();
      const error = await uninstall({ name: 'github' }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(UninstallSelectionError);
      expect((error as UninstallSelectionError).candidates.map((c) => c.scope).sort()).toEqual(['project', 'user']);
      expect((error as Error).message).toMatch(/mcp \(project\)/);
      expect(await manifestText()).toBe(before);

      expect((await uninstall({ name: 'github', scope: 'user' })).item.scope).toBe('user');
      expect(await servers(userFile())).toEqual({});
      expect(Object.keys(await servers(mcpFile()))).toEqual(['github']);
    });

    it('requires --kind when the name is both an MCP and a skill, and --kind resolves it', async () => {
      await installMcp('github');
      await initMcps(skillDeps, { mcps: [], skills: ['github'], scope: 'project' });
      const skillRoot = join(tmp.cwd, '.claude', 'skills', 'github');
      const before = await manifestText();
      const error = await uninstall({ name: 'github' }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(UninstallSelectionError);
      expect((error as UninstallSelectionError).candidates.map((c) => c.kind).sort()).toEqual(['mcp', 'skill']);
      expect(await manifestText()).toBe(before);
      expect(await exists(skillRoot)).toBe(true);

      expect(await uninstall({ name: 'github', kind: 'skill' })).toMatchObject({ status: 'removed' });
      expect(await exists(skillRoot)).toBe(false);
      expect(Object.keys(await servers(mcpFile()))).toEqual(['github']);
    });

    it('never matches a project entry recorded under another working directory', async () => {
      await installMcp('github');
      const other = join(tmp.root, 'other');
      await mkdir(other);
      await expect(uninstall({ name: 'github' }, { cwd: other })).rejects.toThrow(UninstallSelectionError);
      expect(Object.keys(await servers(mcpFile()))).toEqual(['github']);
    });
  });

  describe('outcomes', () => {
    it('removes an unmodified MCP entry, keeps siblings and backs up the pre-removal bytes', async () => {
      await writeFile(mcpFile(), JSON.stringify({ mcpServers: { other: { type: 'stdio', command: 'x' } } }, null, 2));
      await installMcp('github');
      const before = await read(mcpFile());
      const result = await uninstall({ name: 'github' });
      expect(result).toMatchObject({ status: 'removed', exitCode: 0, files: [mcpFile()], modified: false });
      expect(Object.keys(await servers(mcpFile()))).toEqual(['other']);
      const last = (await loadManifest(fs, tmp.homeDir)).installs.at(-1)!;
      expect(last.id).toBe(result.installId);
      expect(last.files[0]).toMatchObject({
        path: mcpFile(),
        items: [{ kind: 'mcp', name: 'github', action: 'remove' }],
      });
      expect(await read(join(stateDir(tmp.homeDir), last.files[0]!.backup!))).toBe(before);
    });

    it('removes an unmodified skill directory and backs up every file', async () => {
      await installSkill();
      const result = await uninstall({ name: 'demo' });
      expect(result).toMatchObject({ status: 'removed', exitCode: 0, modified: false });
      expect(result.files.sort()).toEqual(
        ['SKILL.md', 'assets/logo.bin', 'refs/a.md', 'refs/b.md'].map((p) => join(root(), p)),
      );
      expect(await exists(root())).toBe(false);
      const last = (await loadManifest(fs, tmp.homeDir)).installs.at(-1)!;
      expect(last.files).toHaveLength(4);
      for (const file of last.files) {
        expect(file.afterHash).toBeNull();
        expect(await exists(join(stateDir(tmp.homeDir), file.backup!))).toBe(true);
      }
    });

    it('reports already-absent without writing when the MCP entry is gone', async () => {
      await installMcp('github');
      await writeFile(mcpFile(), '{ "mcpServers": {} }');
      const before = await manifestText();
      expect(await uninstall({ name: 'github' })).toMatchObject({ status: 'already-absent', exitCode: 0, files: [] });
      expect(await manifestText()).toBe(before);
      expect(await read(mcpFile())).toBe('{ "mcpServers": {} }');
    });

    it('reports already-absent without writing when the skill directory is gone', async () => {
      await installSkill();
      await rm(root(), { recursive: true });
      const before = await manifestText();
      expect(await uninstall({ name: 'demo' })).toMatchObject({ status: 'already-absent', exitCode: 0 });
      expect(await manifestText()).toBe(before);
    });

    it.each([
      [
        'MCP',
        'github',
        () => mcpFile(),
        () => installMcp('github'),
        (t: string) => t.replace('"type"', '"x": 1, "type"'),
      ],
      ['skill', 'demo', () => join(root(), 'refs', 'a.md'), () => installSkill(), () => 'edited'],
    ])(
      'refuses a modified %s with exit 3 and writes nothing, --force removes it',
      async (_kind, name, file, setup, edit) => {
        await setup();
        await writeFile(file(), edit(await read(file())));
        const edited = await read(file());
        const before = await manifestText();
        expect(await uninstall({ name })).toMatchObject({ status: 'refused', exitCode: 3, modified: true });
        expect(await read(file())).toBe(edited);
        expect(await manifestText()).toBe(before);
        expect(await uninstall({ name, force: true })).toMatchObject({
          status: 'removed',
          exitCode: 0,
          modified: true,
        });
      },
    );

    it('writes nothing on --dry-run for an unmodified item', async () => {
      await installMcp('github');
      const config = await read(mcpFile());
      const before = await manifestText();
      const tree = () => readdir(stateDir(tmp.homeDir), { recursive: true });
      const stateBefore = await tree();
      expect(await uninstall({ name: 'github', dryRun: true })).toMatchObject({
        status: 'dry-run',
        exitCode: 0,
        files: [mcpFile()],
      });
      expect(await read(mcpFile())).toBe(config);
      expect(await manifestText()).toBe(before);
      expect(await tree()).toEqual(stateBefore);
    });

    it('refuses --dry-run on a modified item with exit 3, and plans it with --force', async () => {
      await installSkill();
      await writeFile(join(root(), 'refs', 'a.md'), 'edited');
      const before = await manifestText();
      expect(await uninstall({ name: 'demo', dryRun: true })).toMatchObject({ status: 'refused', exitCode: 3 });
      expect(await uninstall({ name: 'demo', dryRun: true, force: true })).toMatchObject({
        status: 'dry-run',
        exitCode: 0,
      });
      expect(await read(join(root(), 'refs', 'a.md'))).toBe('edited');
      expect(await manifestText()).toBe(before);
    });
  });

  describe('skills', () => {
    it('deletes SKILL.md first so a half-removed skill never loads', async () => {
      await installSkill();
      const spy = faultyFs(fs, { method: 'remove', nth: 999 });
      await uninstall({ name: 'demo' }, { fs: spy });
      const removed = spy.calls.filter((c) => c.startsWith('remove '));
      expect(removed).toHaveLength(4);
      expect(removed[0]).toBe(`remove ${join(root(), 'SKILL.md')}`);
    });

    it('with --force deletes only recorded files and keeps the user file and directory', async () => {
      await installSkill();
      await writeFile(join(root(), 'extra.md'), 'mine');
      expect(await uninstall({ name: 'demo' })).toMatchObject({ status: 'refused', exitCode: 3 });
      expect(await uninstall({ name: 'demo', force: true })).toMatchObject({ status: 'removed', exitCode: 0 });
      expect(await readdir(root())).toEqual(['extra.md']);
      expect(await read(join(root(), 'extra.md'))).toBe('mine');
    });

    it('aborts with StaleFileError and changes nothing when the tree changed after planning', async () => {
      await installSkill();
      const racing = racy(fs, 'listFiles', root(), () => writeFile(join(root(), 'refs', 'a.md'), 'raced'));
      const before = await manifestText();
      await expect(uninstall({ name: 'demo' }, { fs: racing })).rejects.toThrow(StaleFileError);
      expect(await read(join(root(), 'refs', 'a.md'))).toBe('raced');
      expect(await read(join(root(), 'SKILL.md'))).toBe(SKILL_MD);
      expect(await manifestText()).toBe(before);
    });

    it('refuses with UnsafeTreeError and changes nothing when the skill holds a symlink, even with --force', async () => {
      await installSkill();
      const link = join(root(), 'link.md');
      await symlink(join(tmp.cwd, 'nowhere'), link);
      const before = await manifestText();
      const tree = () => readdir(stateDir(tmp.homeDir), { recursive: true });
      const stateBefore = await tree();
      for (const force of [false, true]) {
        await expect(uninstall({ name: 'demo', force })).rejects.toThrow(UnsafeTreeError);
      }
      expect((await lstat(link)).isSymbolicLink()).toBe(true);
      expect(await readlink(link)).toBe(join(tmp.cwd, 'nowhere'));
      expect(await read(join(root(), 'SKILL.md'))).toBe(SKILL_MD);
      expect((await readdir(root())).sort()).toEqual(['SKILL.md', 'assets', 'link.md', 'refs']);
      expect(await manifestText()).toBe(before);
      expect(await tree()).toEqual(stateBefore);
    });

    it('rolls back the deletions when one fails midway', async () => {
      await installSkill();
      const before = await manifestText();
      const failing = faultyFs(fs, { method: 'remove', nth: 1, match: (p) => p.endsWith('refs/a.md') });
      await expect(uninstall({ name: 'demo' }, { fs: failing })).rejects.toThrow('injected remove failure');
      expect(await read(join(root(), 'SKILL.md'))).toBe(SKILL_MD);
      expect((await readdir(root())).sort()).toEqual(['SKILL.md', 'assets', 'refs']);
      expect(await manifestText()).toBe(before);
    });
  });

  describe('MCP transaction', () => {
    it('aborts with StaleFileError and changes nothing when the config changed after planning', async () => {
      await installMcp('github');
      const racing = racy(fs, 'readText', mcpFile(), () => writeFile(mcpFile(), '{ "mcpServers": { "github": {} } }'));
      const before = await manifestText();
      await expect(uninstall({ name: 'github', force: true }, { fs: racing })).rejects.toThrow(StaleFileError);
      expect(await read(mcpFile())).toBe('{ "mcpServers": { "github": {} } }');
      expect(await manifestText()).toBe(before);
    });

    it('restores the config when journaling fails', async () => {
      await installMcp('github');
      const config = await read(mcpFile());
      const before = await manifestText();
      const failing = faultyFs(fs, { method: 'writeAtomic', nth: 1, match: (p) => p === manifestPath(tmp.homeDir) });
      await expect(uninstall({ name: 'github' }, { fs: failing })).rejects.toThrow('injected writeAtomic failure');
      expect(await read(mcpFile())).toBe(config);
      expect(await manifestText()).toBe(before);
    });
  });

  describe('undo and status', () => {
    const undoDeps = () => ({ fs, paths: { homeDir: tmp.homeDir, cwd: tmp.cwd } });
    const statusDeps = () => ({ ...undoDeps(), source: mcpDeps.source, target: claudeCodeTarget });

    it('undo restores the MCP bytes and ownership, and status hides then re-lists the item', async () => {
      const original = JSON.stringify(
        { theme: 'dark', mcpServers: { other: { type: 'stdio', command: 'x' } } },
        null,
        4,
      );
      await writeFile(mcpFile(), original);
      await installMcp('github');
      const installed = await read(mcpFile());
      expect((await getStatus(statusDeps(), {})).items.map((i) => i.name)).toEqual(['github']);

      await uninstall({ name: 'github' });
      expect((await getStatus(statusDeps(), {})).items).toEqual([]);

      expect(await undoInstall(undoDeps(), {})).toMatchObject({ status: 'undone', exitCode: 0 });
      expect(await read(mcpFile())).toBe(installed);
      expect((await getStatus(statusDeps(), {})).items.map((i) => i.name)).toEqual(['github']);
      expect(await uninstall({ name: 'github' })).toMatchObject({ status: 'removed' });
    });

    it('undo restores a removed skill tree byte for byte', async () => {
      await installSkill();
      await uninstall({ name: 'demo' });
      expect(await undoInstall(undoDeps(), {})).toMatchObject({ status: 'undone', exitCode: 0 });
      expect(await read(join(root(), 'SKILL.md'))).toBe(SKILL_MD);
      expect((await readdir(root())).sort()).toEqual(['SKILL.md', 'assets', 'refs']);
      expect((await getStatus({ ...statusDeps(), source: skillDeps.source }, {})).items.map((i) => i.name)).toEqual([
        'demo',
      ]);
    });

    it('undo refuses when the config was edited after an MCP uninstall', async () => {
      await installMcp('github');
      await uninstall({ name: 'github' });
      await writeFile(mcpFile(), '{"edited":true}');
      expect(await undoInstall(undoDeps(), {})).toMatchObject({ status: 'refused', exitCode: 3 });
      expect(await read(mcpFile())).toBe('{"edited":true}');
    });

    it('blocks undoing the original install while the uninstall is newer (LIFO)', async () => {
      await installMcp('github');
      await uninstall({ name: 'github' });
      const [first] = (await loadManifest(fs, tmp.homeDir)).installs;
      await expect(undoInstall(undoDeps(), { id: first!.id })).rejects.toThrow(UndoSelectionError);
    });
  });
});

describe('uninstallItem (scripts)', () => {
  let tmp: TmpPaths;
  let fs: NodeFileSystem;
  let scriptDeps: InitDeps;
  const root = () => join(tmp.cwd, '.shitaku', 'scripts', 'lint');
  const exists = (path: string) =>
    access(path).then(
      () => true,
      () => false,
    );
  const uninstall = (req: UninstallRequest) =>
    uninstallItem({ fs, target: claudeCodeTarget, paths: { homeDir: tmp.homeDir, cwd: tmp.cwd } }, req);

  beforeEach(async () => {
    tmp = await makeTmpPaths();
    fs = new NodeFileSystem();
    scriptDeps = {
      fs,
      target: claudeCodeTarget,
      paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
      env: {},
      source: scriptSource([SCRIPT_V1, { ...SCRIPT_V1, name: 'demo' }]),
    };
  });
  afterEach(() => tmp.cleanup());

  it('removes an unmodified script with --kind script', async () => {
    await initMcps(scriptDeps, { mcps: [], scripts: ['lint'], scope: 'project' });
    expect(await uninstall({ name: 'lint', kind: 'script' })).toMatchObject({
      status: 'removed',
      exitCode: 0,
      item: { kind: 'script', name: 'lint' },
    });
    expect(await exists(root())).toBe(false);
  });

  it('requires --kind when the name is both a skill and a script', async () => {
    const skillDeps: InitDeps = {
      ...scriptDeps,
      source: {
        ref: () => ({ kind: 'bundled', location: '/catalog' }),
        load: () =>
          Promise.resolve({
            mcps: [],
            skills: [DEMO_V1],
            scripts: [{ ...SCRIPT_V1, name: 'demo' }],
            commands: [],
            profiles: [],
            issues: [],
          }),
      },
    };
    await initMcps(skillDeps, { mcps: [], skills: ['demo'], scope: 'project' });
    await initMcps(skillDeps, { mcps: [], scripts: ['demo'], scope: 'project' });
    await expect(uninstall({ name: 'demo' })).rejects.toThrow(UninstallSelectionError);
    expect(await uninstall({ name: 'demo', kind: 'script' })).toMatchObject({ status: 'removed' });
    expect(await exists(join(tmp.cwd, '.shitaku', 'scripts', 'demo'))).toBe(false);
    expect(await exists(join(tmp.cwd, '.claude', 'skills', 'demo'))).toBe(true);
  });

  it('refuses a modified script without --force and keeps extras with --force', async () => {
    await initMcps(scriptDeps, { mcps: [], scripts: ['lint'], scope: 'project' });
    await writeFile(join(root(), 'index.mjs'), 'edited');
    expect(await uninstall({ name: 'lint', kind: 'script' })).toMatchObject({ status: 'refused', exitCode: 3 });
    expect(await exists(join(root(), 'index.mjs'))).toBe(true);

    await writeFile(join(root(), 'extra.md'), 'mine');
    expect(await uninstall({ name: 'lint', kind: 'script', force: true })).toMatchObject({
      status: 'removed',
      exitCode: 0,
    });
    expect(await exists(join(root(), 'extra.md'))).toBe(true);
    expect(await exists(join(root(), 'index.mjs'))).toBe(false);
  });

  it('removes a runtime script-root node_modules tree on uninstall without treating it as a modification', async () => {
    await initMcps(scriptDeps, { mcps: [], scripts: ['lint'], scope: 'project' });
    const nmFile = join(root(), 'node_modules', 'eslint', 'bin', 'eslint.js');
    await mkdir(join(root(), 'node_modules', 'eslint', 'bin'), { recursive: true });
    await writeFile(nmFile, 'runtime');
    expect(await uninstall({ name: 'lint', kind: 'script' })).toMatchObject({
      status: 'removed',
      exitCode: 0,
      modified: false,
    });
    expect(await exists(root())).toBe(false);
    expect(await exists(join(root(), 'node_modules'))).toBe(false);
  });

  it('removes script-root node_modules even when --force keeps an unrecorded sibling file', async () => {
    await initMcps(scriptDeps, { mcps: [], scripts: ['lint'], scope: 'project' });
    await writeFile(join(root(), 'extra.md'), 'mine');
    await mkdir(join(root(), 'node_modules', 'pkg'), { recursive: true });
    await writeFile(join(root(), 'node_modules', 'pkg', 'index.js'), 'dep');
    expect(await uninstall({ name: 'lint', kind: 'script', force: true })).toMatchObject({
      status: 'removed',
      exitCode: 0,
      modified: true,
    });
    expect(await exists(join(root(), 'extra.md'))).toBe(true);
    expect(await exists(join(root(), 'node_modules'))).toBe(false);
    expect(await exists(join(root(), 'index.mjs'))).toBe(false);
  });

  it('removes script-root node_modules when undoing the original script install', async () => {
    await initMcps(scriptDeps, { mcps: [], scripts: ['lint'], scope: 'project' });
    await mkdir(join(root(), 'node_modules', 'pkg'), { recursive: true });
    await writeFile(join(root(), 'node_modules', 'pkg', 'index.js'), 'dep');
    const undoDeps = { fs, paths: { homeDir: tmp.homeDir, cwd: tmp.cwd } };
    expect(await undoInstall(undoDeps, {})).toMatchObject({ status: 'undone', exitCode: 0 });
    expect(await exists(root())).toBe(false);
    expect(await exists(join(root(), 'node_modules'))).toBe(false);
  });
});
