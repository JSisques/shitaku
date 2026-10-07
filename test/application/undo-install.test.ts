import { mkdir, readFile, readdir, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FolderCatalogSource } from '@/adapters/catalog/folder-source.js';
import { claudeCodeTarget } from '@/adapters/claude-code/target.js';
import { NodeFileSystem } from '@/adapters/fs/node-fs.js';
import { initMcps, type InitDeps } from '@/application/init-mcps.js';
import { ConfigError } from '@/domain/json-merge.js';
import { appendInstall, loadManifest, manifestPath, stateDir } from '@/application/journal.js';
import { sha256 } from '@/domain/hash.js';
import { UndoSelectionError, UndoVerifyError, undoInstall } from '@/application/undo-install.js';
import { DEMO_V1, DEMO_V2, skillSource } from '@test/helpers/skills.js';
import { SCRIPT_V1, scriptSource } from '@test/helpers/scripts.js';
import { commandSource, REVIEW_V1 } from '@test/helpers/commands.js';
import { FMT_V1, FMT_V2, GUARD, hookSource } from '@test/helpers/hooks.js';
import { makeTmpPaths, type TmpPaths } from '@test/helpers/tmp-paths.js';

const CATALOG = join(import.meta.dirname, '..', '..', 'catalog');

describe('undoInstall', () => {
  let tmp: TmpPaths;
  let deps: InitDeps;
  const mcpFile = () => join(tmp.cwd, '.mcp.json');
  const userFile = () => join(tmp.homeDir, '.claude.json');
  const read = (path: string) => readFile(path, 'utf8');
  const undoDeps = () => ({ fs: deps.fs, paths: deps.paths });
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

  it('restores the original bytes of a project file and marks the install undone', async () => {
    const original = `{\n    "theme": "dark",\n    "mcpServers": {}\n}\n`;
    await writeFile(mcpFile(), original);
    await initMcps(deps, { mcps: ['github'], scope: 'project' });
    const result = await undoInstall(undoDeps(), {});
    expect(result).toMatchObject({ status: 'undone', exitCode: 0 });
    expect(await read(mcpFile())).toBe(original);
    const manifest = await loadManifest(deps.fs, tmp.homeDir);
    expect(manifest.installs[0]?.undoneAt).not.toBeNull();
  });

  it('removes a file the install created', async () => {
    await initMcps(deps, { mcps: ['github'], scope: 'project' });
    await undoInstall(undoDeps(), {});
    expect(await readdir(tmp.cwd)).toEqual([]);
  });

  it('round-trips user scope back to the original bytes', async () => {
    const original = JSON.stringify(
      { numStartups: 7, mcpServers: { other: { type: 'stdio', command: 'x' } } },
      null,
      2,
    );
    await writeFile(userFile(), original);
    await initMcps(deps, { mcps: ['context7'], scope: 'user' });
    expect(await read(userFile())).not.toBe(original);
    await undoInstall(undoDeps(), {});
    expect(await read(userFile())).toBe(original);
  });

  it('refuses with exit code 3 when the file changed since install, unless forced', async () => {
    await initMcps(deps, { mcps: ['github'], scope: 'project' });
    const edited = (await read(mcpFile())).replace('github', 'github2');
    await writeFile(mcpFile(), edited);
    const refused = await undoInstall(undoDeps(), {});
    expect(refused).toMatchObject({ status: 'refused', exitCode: 3 });
    expect(refused.changed).toEqual([mcpFile()]);
    expect(await read(mcpFile())).toBe(edited);
    expect((await loadManifest(deps.fs, tmp.homeDir)).installs[0]?.undoneAt).toBeNull();

    const forced = await undoInstall(undoDeps(), { force: true });
    expect(forced).toMatchObject({ status: 'undone', exitCode: 0 });
    expect(await readdir(tmp.cwd)).toEqual([]);
  });

  it('reports nothing to undo without a manifest and changes nothing', async () => {
    const result = await undoInstall(undoDeps(), {});
    expect(result).toMatchObject({ status: 'nothing', exitCode: 0 });
    expect(await readdir(tmp.homeDir)).toEqual([]);
  });

  it('only lets the newest install of a file be undone (LIFO)', async () => {
    await initMcps(deps, { mcps: ['github'], scope: 'project' });
    await initMcps(deps, { mcps: ['context7'], scope: 'project' });
    const [first, second] = (await loadManifest(deps.fs, tmp.homeDir)).installs;
    const afterBoth = await read(mcpFile());
    await expect(undoInstall(undoDeps(), { id: first!.id })).rejects.toThrow(UndoSelectionError);
    expect(await read(mcpFile())).toBe(afterBoth);

    expect((await undoInstall(undoDeps(), {})).installId).toBe(second!.id);
    expect((await undoInstall(undoDeps(), { id: first!.id })).status).toBe('undone');
    expect(await readdir(tmp.cwd)).toEqual([]);
  });

  it('writes nothing on dry run', async () => {
    await initMcps(deps, { mcps: ['github'], scope: 'project' });
    const file = await read(mcpFile());
    const manifest = await read(manifestPath(tmp.homeDir));
    const result = await undoInstall(undoDeps(), { dryRun: true });
    expect(result).toMatchObject({ status: 'dry-run', exitCode: 0, files: [mcpFile()] });
    expect(await read(mcpFile())).toBe(file);
    expect(await read(manifestPath(tmp.homeDir))).toBe(manifest);
  });

  it('treats a repeated undo as a no-op and rejects unknown ids', async () => {
    await initMcps(deps, { mcps: ['github'], scope: 'project' });
    const { installId } = await undoInstall(undoDeps(), {});
    expect(await undoInstall(undoDeps(), {})).toMatchObject({ status: 'nothing' });
    expect(await undoInstall(undoDeps(), { id: installId })).toMatchObject({ status: 'already-undone', exitCode: 0 });
    await expect(undoInstall(undoDeps(), { id: 'nope' })).rejects.toThrow(UndoSelectionError);
  });

  describe('with a null afterHash (a file the install deleted)', () => {
    const seed = async (path: string, backup: string, original: string) => {
      await deps.fs.writeAtomic(`${stateDir(tmp.homeDir)}/${backup}`, original);
      await appendInstall(deps.fs, tmp.homeDir, {
        id: 'seed',
        createdAt: '2026-10-02T00:00:00.000Z',
        undoneAt: null,
        source: { kind: 'bundled', location: CATALOG, catalogVersion: 1 },
        files: [{ path, scope: 'project', backup, beforeHash: sha256(original), afterHash: null, items: [] }],
        createdDirs: [],
      });
    };

    it('treats an absent file as unchanged and restores it from its backup', async () => {
      const path = join(tmp.cwd, 'removed.md');
      await seed(path, 'backups/seed/0-removed.md', 'original\n');
      expect(await undoInstall(undoDeps(), { dryRun: true })).toMatchObject({ status: 'dry-run', changed: [] });
      expect(await undoInstall(undoDeps(), {})).toMatchObject({ status: 'undone', exitCode: 0 });
      expect(await read(path)).toBe('original\n');
    });

    it('refuses with exit 3 when the file reappeared since the install', async () => {
      const path = join(tmp.cwd, 'removed.md');
      await seed(path, 'backups/seed/0-removed.md', 'original\n');
      await writeFile(path, 'user wrote this');
      expect(await undoInstall(undoDeps(), {})).toMatchObject({ status: 'refused', exitCode: 3, changed: [path] });
    });
  });
});

describe('undoInstall (skills)', () => {
  let tmp: TmpPaths;
  let deps: InitDeps;
  const skillsDir = (scope: 'project' | 'user') => join(scope === 'user' ? tmp.homeDir : tmp.cwd, '.claude', 'skills');
  const root = (scope: 'project' | 'user' = 'project') => join(skillsDir(scope), 'demo');
  const undoDeps = () => ({ fs: deps.fs, paths: deps.paths });
  const install = (scope: 'project' | 'user' = 'project', force = false) =>
    initMcps(deps, { mcps: [], skills: ['demo'], scope, force });
  const hex = async (path: string) => Buffer.from(await readFile(path)).toString('hex');
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

  it('removes a created skill and every directory it created, leaving the project as it was', async () => {
    await install();
    expect(await undoInstall(undoDeps(), {})).toMatchObject({ status: 'undone', exitCode: 0 });
    expect(await readdir(tmp.cwd)).toEqual([]);
    expect((await loadManifest(deps.fs, tmp.homeDir)).installs[0]?.undoneAt).not.toBeNull();
  });

  it('keeps a skills directory that existed before the install', async () => {
    await mkdir(skillsDir('user'), { recursive: true });
    await install('user');
    await undoInstall(undoDeps(), {});
    expect(await readdir(skillsDir('user'))).toEqual([]);
  });

  it('refuses with exit 3 and touches nothing when the user added a file to the skill', async () => {
    await install();
    await writeFile(join(root(), 'extra.md'), 'mine');
    const refused = await undoInstall(undoDeps(), {});
    expect(refused).toMatchObject({ status: 'refused', exitCode: 3, changed: [join(root(), 'extra.md')] });
    expect((await readdir(root())).sort()).toEqual(['SKILL.md', 'assets', 'extra.md', 'refs']);
    expect((await loadManifest(deps.fs, tmp.homeDir)).installs[0]?.undoneAt).toBeNull();
  });

  it('refuses when a recorded file was modified or deleted', async () => {
    await install();
    await writeFile(join(root(), 'refs', 'a.md'), 'edited');
    expect(await undoInstall(undoDeps(), {})).toMatchObject({
      status: 'refused',
      exitCode: 3,
      changed: [join(root(), 'refs', 'a.md')],
    });
    expect(await readFile(join(root(), 'refs', 'a.md'), 'utf8')).toBe('edited');
  });

  it('with --force removes the recorded files but leaves the unknown file and its directory in place', async () => {
    await install();
    await writeFile(join(root(), 'extra.md'), 'mine');
    await writeFile(join(root(), 'refs', 'a.md'), 'edited');
    expect(await undoInstall(undoDeps(), { force: true })).toMatchObject({ status: 'undone', exitCode: 0 });
    expect(await readdir(root())).toEqual(['extra.md']);
    expect(await readFile(join(root(), 'extra.md'), 'utf8')).toBe('mine');
  });

  it('skips a created directory that is not empty because of an unrelated user file', async () => {
    await install();
    await mkdir(join(skillsDir('project'), 'other'));
    expect(await undoInstall(undoDeps(), {})).toMatchObject({ status: 'undone', exitCode: 0 });
    expect(await readdir(skillsDir('project'))).toEqual(['other']);
  });

  it('restores the original directory, binary file included, when a forced replace is undone', async () => {
    await mkdir(join(root(), 'sub'), { recursive: true });
    await writeFile(join(root(), 'SKILL.md'), 'mine');
    await writeFile(join(root(), 'notes.txt'), 'keep me');
    await writeFile(join(root(), 'sub', 'x.bin'), Buffer.from([0xff, 0xfe, 0x00]));
    const before = { skill: await hex(join(root(), 'SKILL.md')), bin: await hex(join(root(), 'sub', 'x.bin')) };
    await install('project', true);
    expect(await undoInstall(undoDeps(), {})).toMatchObject({ status: 'undone', exitCode: 0 });
    expect((await readdir(root())).sort()).toEqual(['SKILL.md', 'notes.txt', 'sub']);
    expect(await hex(join(root(), 'SKILL.md'))).toBe(before.skill);
    expect(await hex(join(root(), 'sub', 'x.bin'))).toBe(before.bin);
    expect(await readFile(join(root(), 'notes.txt'), 'utf8')).toBe('keep me');
    expect(await readdir(root())).not.toContain('assets');
  });

  it('undoes an update back to the previous version, dropped file included, and keeps the older install', async () => {
    await install();
    deps = { ...deps, source: skillSource([DEMO_V2]) };
    await install();
    expect(await readdir(join(root(), 'refs'))).toEqual(['a.md']);
    await undoInstall(undoDeps(), {});
    expect(await readFile(join(root(), 'refs', 'b.md'), 'utf8')).toBe('b1');
    expect(await readFile(join(root(), 'refs', 'a.md'), 'utf8')).toBe('a1');
    expect(await readFile(join(root(), 'SKILL.md'), 'utf8')).toContain('one');
    expect(await undoInstall(undoDeps(), {})).toMatchObject({ status: 'undone' });
    expect(await readdir(tmp.cwd)).toEqual([]);
  });

  it('blocks undoing an older install while a newer one owns the same skill root', async () => {
    const seed = (id: string, file: string) =>
      appendInstall(deps.fs, tmp.homeDir, {
        id,
        createdAt: '2026-10-02T00:00:00.000Z',
        undoneAt: null,
        source: { kind: 'bundled', location: CATALOG, catalogVersion: 1 },
        files: [
          {
            path: join(root(), file),
            scope: 'project',
            backup: null,
            beforeHash: null,
            afterHash: null,
            items: [{ kind: 'skill', name: 'demo', action: 'create', entryHash: 'h', root: root() }],
          },
        ],
        createdDirs: [],
      });
    await seed('first', 'a.md');
    await seed('second', 'b.md');
    await expect(undoInstall(undoDeps(), { id: 'first' })).rejects.toThrow(UndoSelectionError);
  });

  it('reports an unknown file on dry run and writes nothing', async () => {
    await install();
    await writeFile(join(root(), 'extra.md'), 'mine');
    const manifest = await readFile(manifestPath(tmp.homeDir), 'utf8');
    expect(await undoInstall(undoDeps(), { dryRun: true, force: true })).toMatchObject({
      status: 'dry-run',
      changed: [join(root(), 'extra.md')],
    });
    expect(await readFile(manifestPath(tmp.homeDir), 'utf8')).toBe(manifest);
    expect((await readdir(root())).sort()).toEqual(['SKILL.md', 'assets', 'extra.md', 'refs']);
  });

  it('refuses with exit 3, not a crash, when a recorded file was replaced by a symlink', async () => {
    await install();
    const target = join(tmp.cwd, 'outside.txt');
    await writeFile(target, 'secret');
    await rm(join(root(), 'refs', 'a.md'));
    await symlink(target, join(root(), 'refs', 'a.md'));
    const refused = await undoInstall(undoDeps(), {});
    expect(refused).toMatchObject({ status: 'refused', exitCode: 3 });
    expect(refused.changed).toContain(join(root(), 'refs', 'a.md'));
    expect(await readFile(target, 'utf8')).toBe('secret');
    expect((await loadManifest(deps.fs, tmp.homeDir)).installs[0]?.undoneAt).toBeNull();
  });

  it('refuses with exit 3 when the user added a symlink under the skill root', async () => {
    await install();
    await symlink(join(tmp.cwd, 'nowhere'), join(root(), 'link.md'));
    const refused = await undoInstall(undoDeps(), {});
    expect(refused).toMatchObject({ status: 'refused', exitCode: 3 });
    expect(refused.changed.length).toBeGreaterThan(0);
    expect((await readdir(root())).sort()).toEqual(['SKILL.md', 'assets', 'link.md', 'refs']);
  });

  it('refuses before touching anything when a needed backup is missing, and again on rerun', async () => {
    await mkdir(join(root(), 'sub'), { recursive: true });
    await writeFile(join(root(), 'SKILL.md'), 'mine');
    await writeFile(join(root(), 'notes.txt'), 'keep me');
    await install('project', true);
    const manifest = await loadManifest(deps.fs, tmp.homeDir);
    const withBackup = manifest.installs[0]!.files.filter((f) => f.backup !== null);
    expect(withBackup.length).toBeGreaterThan(1);
    // Drop the backup of the file that is restored last, so a late failure would have mutated the others.
    await rm(`${stateDir(tmp.homeDir)}/${withBackup[withBackup.length - 1]!.backup}`);
    const manifestBefore = await readFile(manifestPath(tmp.homeDir), 'utf8');
    const snapshot = async () => ({
      skill: await readFile(join(root(), 'SKILL.md'), 'utf8'),
      files: (await readdir(root())).sort(),
    });
    const before = await snapshot();
    await expect(undoInstall(undoDeps(), {})).rejects.toThrow(UndoVerifyError);
    await expect(undoInstall(undoDeps(), {})).rejects.toThrow(/missing/);
    expect(await snapshot()).toEqual(before);
    expect(await readFile(manifestPath(tmp.homeDir), 'utf8')).toBe(manifestBefore);
  });

  it('ignores a tampered createdDirs entry that lies outside the install scope', async () => {
    await install();
    const outside = join(tmp.homeDir, 'precious');
    await mkdir(outside);
    const manifest = await loadManifest(deps.fs, tmp.homeDir);
    const tampered = {
      ...manifest,
      installs: manifest.installs.map((i) => ({ ...i, createdDirs: [...i.createdDirs, outside, tmp.homeDir, '/'] })),
    };
    await writeFile(manifestPath(tmp.homeDir), JSON.stringify(tampered));
    expect(await undoInstall(undoDeps(), {})).toMatchObject({ status: 'undone', exitCode: 0 });
    expect(await readdir(tmp.homeDir)).toContain('precious');
    expect(await readdir(tmp.cwd)).toEqual([]);
  });

  it('skips a created directory holding only foreign files and still undoes', async () => {
    await install();
    await writeFile(join(skillsDir('project'), 'foreign.md'), 'mine');
    // The foreign file is outside the skill root, so it is not drift; .claude/skills is kept, demo/ is removed.
    expect(await undoInstall(undoDeps(), {})).toMatchObject({ status: 'undone', exitCode: 0 });
    expect(await readdir(skillsDir('project'))).toEqual(['foreign.md']);
  });

  it('undoes an install that wrote both an MCP config and a skill, restoring the config bytes', async () => {
    deps = {
      ...deps,
      source: {
        ...skillSource([DEMO_V1]),
        load: async () => ({ ...(await new FolderCatalogSource(CATALOG, 'bundled').load()), skills: [DEMO_V1] }),
      },
    };
    const original = `{\n    "mcpServers": {}\n}\n`;
    await writeFile(join(tmp.cwd, '.mcp.json'), original);
    await initMcps(deps, { mcps: ['github'], skills: ['demo'], scope: 'project' });
    expect(await undoInstall(undoDeps(), {})).toMatchObject({ status: 'undone', exitCode: 0 });
    expect(await readFile(join(tmp.cwd, '.mcp.json'), 'utf8')).toBe(original);
    expect(await readdir(tmp.cwd)).toEqual(['.mcp.json']);
  });
});

describe('undoInstall (scripts)', () => {
  let tmp: TmpPaths;
  let deps: InitDeps;
  const root = () => join(tmp.cwd, '.shitaku', 'scripts', 'lint');
  const undoDeps = () => ({ fs: deps.fs, paths: deps.paths });
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

  it('removes an unchanged script tree and refuses when the user added a file', async () => {
    await initMcps(deps, { mcps: [], scripts: ['lint'], scope: 'project' });
    expect(await undoInstall(undoDeps(), {})).toMatchObject({ status: 'undone', exitCode: 0 });
    expect(await readdir(tmp.cwd)).toEqual([]);

    await initMcps(deps, { mcps: [], scripts: ['lint'], scope: 'project' });
    await writeFile(join(root(), 'extra.md'), 'mine');
    const refused = await undoInstall(undoDeps(), {});
    expect(refused).toMatchObject({ status: 'refused', exitCode: 3, changed: [join(root(), 'extra.md')] });
    const active = (await loadManifest(deps.fs, tmp.homeDir)).installs.filter((i) => i.undoneAt === null);
    expect(active).toHaveLength(1);
    expect(active[0]?.undoneAt).toBeNull();
  });
});

describe('undoInstall (commands)', () => {
  let tmp: TmpPaths;
  let deps: InitDeps;
  const dir = () => join(tmp.cwd, '.claude', 'commands');
  const file = () => join(dir(), 'review.md');
  const undoDeps = () => ({ fs: deps.fs, paths: deps.paths });
  const install = (extra: { force?: boolean } = {}) =>
    initMcps(deps, { mcps: [], commands: ['review'], scope: 'project', ...extra });
  beforeEach(async () => {
    tmp = await makeTmpPaths();
    deps = {
      source: commandSource([REVIEW_V1]),
      fs: new NodeFileSystem(),
      target: claudeCodeTarget,
      paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
      env: {},
    };
  });
  afterEach(() => tmp.cleanup());

  it('removes the file and the directories the install created, without treating the file as a tree', async () => {
    await install();
    expect(await undoInstall(undoDeps(), {})).toMatchObject({ status: 'undone', exitCode: 0, changed: [] });
    expect(await readdir(tmp.cwd)).toEqual([]);
  });

  it('keeps a commands directory that existed before the install', async () => {
    await mkdir(dir(), { recursive: true });
    await install();
    expect((await undoInstall(undoDeps(), {})).status).toBe('undone');
    expect(await readdir(dir())).toEqual([]);
  });

  it('keeps the directory and the neighbor when the user added a command next to it', async () => {
    await install();
    await writeFile(join(dir(), 'mine.md'), 'mine');
    expect((await undoInstall(undoDeps(), {})).status).toBe('undone');
    expect(await readdir(dir())).toEqual(['mine.md']);
    expect(await readFile(join(dir(), 'mine.md'), 'utf8')).toBe('mine');
  });

  it('refuses with exit 3 when the file was edited, unless forced', async () => {
    await install();
    await writeFile(file(), 'edited');
    expect(await undoInstall(undoDeps(), {})).toMatchObject({ status: 'refused', exitCode: 3, changed: [file()] });
    expect(await readFile(file(), 'utf8')).toBe('edited');
    expect((await undoInstall(undoDeps(), { force: true })).status).toBe('undone');
    expect(await readdir(tmp.cwd)).toEqual([]);
  });

  it('restores the original bytes, even when they are not valid UTF-8, when a forced replace is undone', async () => {
    const original = Buffer.from([0xff, 0xfe, 0x00, 0x80]);
    await mkdir(dir(), { recursive: true });
    await writeFile(file(), original);
    await install({ force: true });
    expect((await undoInstall(undoDeps(), {})).status).toBe('undone');
    expect(await readFile(file())).toEqual(original);
    expect(await readdir(dir())).toEqual(['review.md']);
  });

  it('refuses before touching anything when the backup is missing, and again on rerun', async () => {
    await mkdir(dir(), { recursive: true });
    await writeFile(file(), 'mine');
    await install({ force: true });
    const [entry] = (await loadManifest(deps.fs, tmp.homeDir)).installs[0]!.files;
    await rm(`${stateDir(tmp.homeDir)}/${entry!.backup}`);
    const manifestBefore = await readFile(manifestPath(tmp.homeDir), 'utf8');
    await expect(undoInstall(undoDeps(), {})).rejects.toThrow(UndoVerifyError);
    await expect(undoInstall(undoDeps(), {})).rejects.toThrow(/missing/);
    expect(new Uint8Array(await readFile(file()))).toEqual(REVIEW_V1.bytes);
    expect(await readFile(manifestPath(tmp.homeDir), 'utf8')).toBe(manifestBefore);
  });
});

describe('undoInstall (hooks)', () => {
  let tmp: TmpPaths;
  let deps: InitDeps;
  const settings = () => join(tmp.cwd, '.claude', 'settings.json');
  const read = (path: string) => readFile(path, 'utf8');
  const undoDeps = () => ({ fs: deps.fs, paths: deps.paths });
  const install = (hooks: string[] = ['fmt']) => initMcps(deps, { mcps: [], hooks, scope: 'project' });
  const fmtHandler = { type: 'command', command: 'prettier -w .' };
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

  it('restores the original bytes of a settings file nothing else touched', async () => {
    const original = `{\n\t"model": "opus"\n}`;
    await mkdir(join(tmp.cwd, '.claude'));
    await writeFile(settings(), original);
    await install();
    expect(await read(settings())).not.toBe(original);
    expect(await undoInstall(undoDeps(), {})).toMatchObject({ status: 'undone', exitCode: 0, changed: [] });
    expect(await read(settings())).toBe(original);
    expect((await loadManifest(deps.fs, tmp.homeDir)).installs[0]?.undoneAt).not.toBeNull();
  });

  it('removes a settings file the install created, and the .claude directory with it', async () => {
    await install();
    expect((await undoInstall(undoDeps(), {})).status).toBe('undone');
    expect(await readdir(tmp.cwd)).toEqual([]);
  });

  it('keeps the .claude directory when the user put another file in it', async () => {
    await install();
    await writeFile(join(tmp.cwd, '.claude', 'notes.md'), 'mine');
    // The new file is not part of the install; the settings file itself is unchanged.
    expect((await undoInstall(undoDeps(), {})).status).toBe('undone');
    expect(await readdir(join(tmp.cwd, '.claude'))).toEqual(['notes.md']);
  });

  it('keeps a .claude directory that existed before the install', async () => {
    await mkdir(join(tmp.cwd, '.claude'));
    await install();
    expect((await undoInstall(undoDeps(), {})).status).toBe('undone');
    expect(await readdir(join(tmp.cwd, '.claude'))).toEqual([]);
  });

  it('reads the settings file as text, so a symlink to identical content is not drift', async () => {
    await install();
    const content = await read(settings());
    await writeFile(join(tmp.root, 'dotfiles-settings.json'), content);
    await unlink(settings());
    await symlink(join(tmp.root, 'dotfiles-settings.json'), settings());
    expect((await undoInstall(undoDeps(), {})).status).toBe('undone');
    expect(await readdir(tmp.cwd)).toEqual([]);
  });

  it('refuses with exit 3 when the settings file changed, and touches nothing', async () => {
    await install();
    const edited = (await read(settings())).replace('"hooks"', '"model": "opus", "hooks"');
    await writeFile(settings(), edited);
    expect(await undoInstall(undoDeps(), {})).toMatchObject({ status: 'refused', exitCode: 3, changed: [settings()] });
    expect(await read(settings())).toBe(edited);
    expect((await loadManifest(deps.fs, tmp.homeDir)).installs[0]?.undoneAt).toBeNull();
  });

  it('with force removes only its own handler, so later edits survive', async () => {
    await install();
    const doc = JSON.parse(await read(settings())) as { hooks: Record<string, unknown[]> };
    doc.hooks.PreToolUse = [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo user' }] }];
    await writeFile(settings(), JSON.stringify({ model: 'opus', ...doc }, null, 2));
    expect(await undoInstall(undoDeps(), { force: true })).toMatchObject({ status: 'undone', exitCode: 0 });
    expect(JSON.parse(await read(settings()))).toEqual({
      model: 'opus',
      hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo user' }] }] },
    });
    expect((await loadManifest(deps.fs, tmp.homeDir)).installs[0]?.undoneAt).not.toBeNull();
  });

  it('with force keeps a group it did not create, in its original order', async () => {
    const user = { type: 'command', command: 'echo user' };
    const original = { hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [user] }] } };
    await mkdir(join(tmp.cwd, '.claude'));
    await writeFile(settings(), JSON.stringify(original, null, 2));
    await install();
    const after = JSON.parse(await read(settings())) as typeof original;
    expect(after.hooks.PostToolUse[0]?.hooks).toEqual([user, fmtHandler]);
    await writeFile(settings(), JSON.stringify({ ...after, model: 'opus' }, null, 2));
    expect((await undoInstall(undoDeps(), { force: true })).status).toBe('undone');
    expect(JSON.parse(await read(settings()))).toEqual({ ...original, model: 'opus' });
  });

  it('with force puts back the previous handler of an update', async () => {
    await install();
    deps.source = hookSource([FMT_V2, GUARD]);
    await install();
    const doc = JSON.parse(await read(settings())) as Record<string, unknown>;
    await writeFile(settings(), JSON.stringify({ ...doc, model: 'opus' }, null, 2));
    expect((await undoInstall(undoDeps(), { force: true })).status).toBe('undone');
    expect(JSON.parse(await read(settings()))).toEqual({
      model: 'opus',
      hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [fmtHandler] }] },
    });
  });

  it('with force re-adds a handler an install removed', async () => {
    await mkdir(join(tmp.cwd, '.claude'));
    await writeFile(settings(), JSON.stringify({ hooks: { PostToolUse: [] } }));
    await appendInstall(deps.fs, tmp.homeDir, {
      id: 'x',
      createdAt: '2026-01-01T00:00:00.000Z',
      undoneAt: null,
      source: { kind: 'bundled', location: '/catalog', catalogVersion: 1 },
      createdDirs: [],
      files: [
        {
          path: settings(),
          scope: 'project',
          backup: null,
          beforeHash: null,
          afterHash: sha256('something else'),
          items: [
            {
              kind: 'hook',
              name: 'fmt',
              action: 'remove',
              entryHash: 'h',
              event: 'PostToolUse',
              matcher: 'Edit|Write',
              handler: fmtHandler,
              createdEvent: false,
              createdGroup: false,
            },
          ],
        },
      ],
    });
    expect((await undoInstall(undoDeps(), { force: true })).status).toBe('undone');
    expect(JSON.parse(await read(settings()))).toEqual({
      hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [fmtHandler] }] },
    });
  });

  it('leaves a settings file the user deleted alone when forced', async () => {
    await install();
    await rm(settings());
    expect((await undoInstall(undoDeps(), { force: true })).status).toBe('undone');
    expect(await readdir(tmp.cwd)).toEqual([]);
  });

  it('computes the reverse before the first write: a corrupt settings file fails with nothing half-done', async () => {
    const real = new FolderCatalogSource(CATALOG, 'bundled');
    deps.source = {
      ref: () => real.ref(),
      load: async () => ({ ...(await real.load()), hooks: [FMT_V1] }),
    };
    await initMcps(deps, { mcps: ['github'], hooks: ['fmt'], scope: 'project' });
    const mcpAfter = await read(join(tmp.cwd, '.mcp.json'));
    await writeFile(settings(), '{ not json');
    await expect(undoInstall(undoDeps(), { force: true })).rejects.toThrow(ConfigError);
    await expect(undoInstall(undoDeps(), { force: true })).rejects.toThrow(/settings\.json/);
    expect(await read(join(tmp.cwd, '.mcp.json'))).toBe(mcpAfter);
    expect(await read(settings())).toBe('{ not json');
    expect((await loadManifest(deps.fs, tmp.homeDir)).installs[0]?.undoneAt).toBeNull();
  });
});
