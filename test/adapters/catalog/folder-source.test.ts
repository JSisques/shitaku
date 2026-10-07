import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FolderCatalogSource } from '@/adapters/catalog/folder-source.js';
import { MAX_DEPTH, MAX_FILE_BYTES, MAX_SKILL_FILES } from '@/domain/catalog/limits.js';
import { makeTmpPaths, type TmpPaths } from '@test/helpers/tmp-paths.js';

const mcp = (name: string): object => ({
  name,
  description: `${name} mcp`,
  server: { type: 'stdio', command: 'npx', env: { KEY: '${KEY}' } },
  env: [{ name: 'KEY' }],
});

const skillMd = (name: string): string => `---\nname: ${name}\ndescription: ${name} skill\n---\n# ${name}\n`;

const commandMd = (description = 'Review a diff'): string =>
  `---\ndescription: ${description}\nargument-hint: [path]\n---\n\nReview $ARGUMENTS\n`;

const hookJson = (name: string, extra: Record<string, unknown> = {}): string =>
  JSON.stringify({ name, description: `${name} hook`, event: 'PostToolUse', command: `run-${name}`, ...extra });

const scriptMeta = (name: string, extra: Record<string, unknown> = {}): string =>
  JSON.stringify({ name, description: `${name} script`, tools: [], ...extra });
const scriptEntry = (): string => 'export default {};\n';

let tmp: TmpPaths;
let dir: string;

async function put(rel: string, data: unknown): Promise<void> {
  const file = join(dir, rel);
  await mkdir(join(file, '..'), { recursive: true });
  await writeFile(file, typeof data === 'string' || data instanceof Uint8Array ? data : JSON.stringify(data));
}

beforeEach(async () => {
  tmp = await makeTmpPaths();
  dir = join(tmp.root, 'catalog');
});
afterEach(() => tmp.cleanup());

describe('FolderCatalogSource', () => {
  it('loads a custom folder and ignores reserved folders', async () => {
    await put('catalog.json', { version: 1, items: { mcps: ['github'], profiles: ['base'], skills: ['x'] } });
    await put('mcps/github.json', mcp('github'));
    await put('profiles/base.json', { name: 'base', mcps: ['github'] });
    await put('skills/x/SKILL.md', skillMd('x'));
    await put('hooks/pre.sh', 'echo hi');

    const source = new FolderCatalogSource(dir, 'folder');
    const catalog = await source.load();
    expect(source.ref()).toEqual({ kind: 'folder', location: dir });
    expect(catalog.mcps.map((m) => m.name)).toEqual(['github']);
    expect(catalog.profiles.map((p) => p.name)).toEqual(['base']);
    expect(catalog.skills.map((sk) => sk.name)).toEqual(['x']);
    expect(catalog.commands).toEqual([]);
    expect(catalog.issues).toEqual([]);
  });

  it('fails clearly when the source is missing', async () => {
    await expect(new FolderCatalogSource(join(tmp.root, 'nope'), 'folder').load()).rejects.toThrow(/catalog\.json/);
  });

  it('skips an invalid item and reports its file and reason', async () => {
    await put('catalog.json', { version: 1, items: { mcps: ['good', 'bad'] } });
    await put('mcps/good.json', mcp('good'));
    await put('mcps/bad.json', { name: 'bad', description: 'no server' });

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.mcps.map((m) => m.name)).toEqual(['good']);
    expect(catalog.issues).toHaveLength(1);
    expect(catalog.issues[0]?.file).toBe('mcps/bad.json');
    expect(catalog.issues[0]?.reason).toContain('server');
  });

  it('reports unparseable JSON and name mismatches', async () => {
    await put('catalog.json', { version: 1, items: { mcps: ['broken', 'other'] } });
    await put('mcps/broken.json', '{ nope');
    await put('mcps/other.json', mcp('different'));

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.mcps).toEqual([]);
    expect(catalog.issues.map((i) => i.file)).toEqual(['mcps/broken.json', 'mcps/other.json']);
  });

  it('drops profiles that reference unknown mcps', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], profiles: ['web'] } });
    await put('profiles/web.json', { name: 'web', mcps: ['ghost'] });

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.profiles).toEqual([]);
    expect(catalog.issues[0]?.reason).toContain('ghost');
  });

  it('loads a skill with a binary file as bytes', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], skills: ['demo'] } });
    await put('skills/demo/SKILL.md', skillMd('demo'));
    await put('skills/demo/assets/logo.bin', new Uint8Array([0, 255, 9]));

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.issues).toEqual([]);
    expect(catalog.skills).toHaveLength(1);
    const files = catalog.skills[0]?.files ?? [];
    expect(files.map((f) => f.path)).toEqual(['SKILL.md', 'assets/logo.bin']);
    expect(Array.from(files[1]?.bytes ?? [])).toEqual([0, 255, 9]);
  });

  it('skips an invalid skill, reports it, and keeps the valid ones', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], skills: ['good', 'bad', 'mismatch'] } });
    await put('skills/good/SKILL.md', skillMd('good'));
    await put('skills/bad/SKILL.md', '# no frontmatter');
    await put('skills/mismatch/SKILL.md', skillMd('other'));

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.skills.map((sk) => sk.name)).toEqual(['good']);
    expect(catalog.issues.map((i) => i.file)).toEqual(['skills/bad/SKILL.md', 'skills/mismatch']);
    expect(catalog.issues[1]?.reason).toContain("'other'");
  });

  it('skips a skill that contains a symlink', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], skills: ['linked'] } });
    await put('skills/linked/SKILL.md', skillMd('linked'));
    await put('secret.txt', 'secret');
    await symlink(join(dir, 'secret.txt'), join(dir, 'skills', 'linked', 'leak.txt'));

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.skills).toEqual([]);
    expect(catalog.issues[0]?.file).toBe('skills/linked');
    expect(catalog.issues[0]?.reason).toContain('leak.txt');
  });

  it('skips a skill whose directory is a symlink', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], skills: ['jump'] } });
    await put('elsewhere/SKILL.md', skillMd('jump'));
    await mkdir(join(dir, 'skills'), { recursive: true });
    await symlink(join(dir, 'elsewhere'), join(dir, 'skills', 'jump'));

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.skills).toEqual([]);
    expect(catalog.issues[0]?.reason).toContain('symbolic link');
  });

  it('flags a listed skill with no directory', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], skills: ['ghost'] } });

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.skills).toEqual([]);
    expect(catalog.issues).toHaveLength(1);
    expect(catalog.issues[0]?.file).toBe('skills/ghost');
    expect(catalog.issues[0]?.reason).toContain('missing');
  });

  it('flags a skill directory that is not listed in catalog.json', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], skills: ['listed'] } });
    await put('skills/listed/SKILL.md', skillMd('listed'));
    await put('skills/stray/SKILL.md', skillMd('stray'));

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.skills.map((sk) => sk.name)).toEqual(['listed']);
    expect(catalog.issues).toHaveLength(1);
    expect(catalog.issues[0]?.file).toBe('skills/stray');
    expect(catalog.issues[0]?.reason).toContain('not listed');
  });

  it('fails the catalog naming a skill entry that could traverse paths', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], skills: ['../evil'] } });
    await expect(new FolderCatalogSource(dir, 'folder').load()).rejects.toThrow(/\.\.\/evil/);
  });

  it('reports a missing description against skills/<name>/SKILL.md', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], skills: ['demo'] } });
    await put('skills/demo/SKILL.md', '---\nname: demo\n---\n# demo\n');

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.skills).toEqual([]);
    expect(catalog.issues).toHaveLength(1);
    expect(catalog.issues[0]?.file).toBe('skills/demo/SKILL.md');
    expect(catalog.issues[0]?.reason).toContain('description');
  });

  it.each([
    [
      'a file above the size limit',
      async () => put('skills/demo/big.bin', new Uint8Array(MAX_FILE_BYTES + 1)),
      'file size',
    ],
    [
      'more files than the file-count limit',
      async () => {
        for (let i = 0; i <= MAX_SKILL_FILES; i++) await put(`skills/demo/f${i}.txt`, 'x');
      },
      'file count',
    ],
    [
      'a tree deeper than the depth limit',
      async () => put(`skills/demo/${Array.from({ length: MAX_DEPTH + 1 }, () => 'd').join('/')}/f.txt`, 'x'),
      'depth',
    ],
    [
      'a skill above the total size limit',
      async () => {
        for (let i = 0; i < 6; i++) await put(`skills/demo/p${i}.bin`, new Uint8Array(MAX_FILE_BYTES));
      },
      'total size',
    ],
  ])('rejects a skill with %s, naming the limit', async (_title, build, reason) => {
    await put('catalog.json', { version: 1, items: { mcps: [], skills: ['demo', 'ok'] } });
    await put('skills/demo/SKILL.md', skillMd('demo'));
    await put('skills/ok/SKILL.md', skillMd('ok'));
    await build();

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.skills.map((sk) => sk.name)).toEqual(['ok']);
    expect(catalog.issues).toHaveLength(1);
    expect(catalog.issues[0]?.file).toBe('skills/demo');
    expect(catalog.issues[0]?.reason).toContain(reason);
  });

  it('ignores non-directory entries in skills/ but flags unlisted directories', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], skills: ['listed'] } });
    await put('skills/listed/SKILL.md', skillMd('listed'));
    await put('skills/.DS_Store', 'junk');
    await put('skills/README.md', '# skills');
    await put('skills/stray/SKILL.md', skillMd('stray'));

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.issues.map((i) => i.file)).toEqual(['skills/stray']);
  });

  it('resolves profile skills and drops profiles that reference unknown ones', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], skills: ['demo'], profiles: ['ok', 'broken'] } });
    await put('skills/demo/SKILL.md', skillMd('demo'));
    await put('profiles/ok.json', { name: 'ok', skills: ['demo'] });
    await put('profiles/broken.json', { name: 'broken', skills: ['ghost'] });

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.profiles.map((p) => p.name)).toEqual(['ok']);
    expect(catalog.issues[0]?.reason).toContain('ghost');
  });

  it('loads an empty scripts list when items.scripts is absent', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [] } });
    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.scripts).toEqual([]);
    expect(catalog.issues).toEqual([]);
  });

  it('loads a valid script with index.mjs and script.json', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], scripts: ['demo'] } });
    await put('scripts/demo/script.json', scriptMeta('demo', { tools: ['eslint'] }));
    await put('scripts/demo/index.mjs', scriptEntry());
    await put('scripts/demo/lib/helper.mjs', 'export const x = 1;\n');

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.issues).toEqual([]);
    expect(catalog.scripts).toHaveLength(1);
    expect(catalog.scripts[0]).toMatchObject({ name: 'demo', description: 'demo script', tools: ['eslint'] });
    expect(catalog.scripts[0]?.files.map((f) => f.path)).toEqual(['index.mjs', 'lib/helper.mjs', 'script.json']);
  });

  it('skips an invalid script, reports it, and keeps the valid ones', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], scripts: ['good', 'bad', 'mismatch'] } });
    await put('scripts/good/script.json', scriptMeta('good'));
    await put('scripts/good/index.mjs', scriptEntry());
    await put('scripts/bad/script.json', JSON.stringify({ name: 'bad' }));
    await put('scripts/bad/index.mjs', scriptEntry());
    await put('scripts/mismatch/script.json', scriptMeta('other'));
    await put('scripts/mismatch/index.mjs', scriptEntry());

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.scripts.map((s) => s.name)).toEqual(['good']);
    expect(catalog.issues.map((i) => i.file)).toEqual(['scripts/bad/script.json', 'scripts/mismatch']);
    expect(catalog.issues[1]?.reason).toContain("'other'");
  });

  it('flags a listed script with no directory', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], scripts: ['ghost'] } });
    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.scripts).toEqual([]);
    expect(catalog.issues[0]?.file).toBe('scripts/ghost');
    expect(catalog.issues[0]?.reason).toContain('missing');
  });

  it('flags a script directory that is not listed in catalog.json', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], scripts: ['listed'] } });
    await put('scripts/listed/script.json', scriptMeta('listed'));
    await put('scripts/listed/index.mjs', scriptEntry());
    await put('scripts/stray/script.json', scriptMeta('stray'));
    await put('scripts/stray/index.mjs', scriptEntry());

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.scripts.map((s) => s.name)).toEqual(['listed']);
    expect(catalog.issues[0]?.file).toBe('scripts/stray');
    expect(catalog.issues[0]?.reason).toContain('not listed');
  });

  it('skips a script that contains a symlink', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], scripts: ['linked'] } });
    await put('scripts/linked/script.json', scriptMeta('linked'));
    await put('scripts/linked/index.mjs', scriptEntry());
    await put('secret.txt', 'secret');
    await symlink(join(dir, 'secret.txt'), join(dir, 'scripts', 'linked', 'leak.txt'));

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.scripts).toEqual([]);
    expect(catalog.issues[0]?.file).toBe('scripts/linked');
    expect(catalog.issues[0]?.reason).toContain('leak.txt');
  });

  it('resolves profile scripts and drops profiles that reference unknown ones', async () => {
    await put('catalog.json', {
      version: 1,
      items: { mcps: [], scripts: ['demo'], profiles: ['ok', 'broken'] },
    });
    await put('scripts/demo/script.json', scriptMeta('demo'));
    await put('scripts/demo/index.mjs', scriptEntry());
    await put('profiles/ok.json', { name: 'ok', scripts: ['demo'] });
    await put('profiles/broken.json', { name: 'broken', scripts: ['ghost'] });

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.profiles.map((p) => p.name)).toEqual(['ok']);
    expect(catalog.issues[0]?.reason).toContain('ghost');
  });

  it('loads an empty commands list when items.commands is absent', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [] } });
    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.commands).toEqual([]);
    expect(catalog.issues).toEqual([]);
  });

  it('loads a valid command with its exact bytes', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], commands: ['review'] } });
    await put('commands/review.md', commandMd());

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.issues).toEqual([]);
    expect(catalog.commands).toHaveLength(1);
    expect(catalog.commands[0]).toMatchObject({ name: 'review', description: 'Review a diff' });
    expect(new TextDecoder().decode(catalog.commands[0]?.bytes)).toBe(commandMd());
  });

  it('skips an invalid command, reports its path, and keeps the valid ones', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], commands: ['good', 'nodesc', 'nofront', 'empty'] } });
    await put('commands/good.md', commandMd());
    await put('commands/nodesc.md', '---\nargument-hint: x\n---\nbody\n');
    await put('commands/nofront.md', '# body only\n');
    await put('commands/empty.md', '---\ndescription: d\n---\n');

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.commands.map((c) => c.name)).toEqual(['good']);
    expect(catalog.issues.map((i) => i.file)).toEqual([
      'commands/nodesc.md',
      'commands/nofront.md',
      'commands/empty.md',
    ]);
    expect(catalog.issues[0]).toMatchObject({
      file: 'commands/nodesc.md',
      reason: expect.stringContaining('description') as string,
    });
  });

  it('flags a listed command with no file', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], commands: ['ghost'] } });
    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.commands).toEqual([]);
    expect(catalog.issues).toEqual([
      { file: 'commands/ghost.md', reason: 'listed in catalog.json but the file is missing' },
    ]);
  });

  it('flags an unlisted commands/*.md file but ignores other entries', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], commands: ['listed'] } });
    await put('commands/listed.md', commandMd());
    await put('commands/stray.md', commandMd());
    await put('commands/.DS_Store', 'junk');
    await put('commands/notes.txt', 'junk');

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.commands.map((c) => c.name)).toEqual(['listed']);
    expect(catalog.issues).toEqual([{ file: 'commands/stray.md', reason: 'not listed in catalog.json' }]);
  });

  it('fails the catalog naming a command entry that could traverse paths', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], commands: ['../evil'] } });
    await expect(new FolderCatalogSource(dir, 'folder').load()).rejects.toThrow(/\.\.\/evil/);
  });

  it('skips a command file that is a symlink', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], commands: ['linked', 'ok'] } });
    await put('commands/ok.md', commandMd());
    await put('secret.md', commandMd());
    await symlink(join(dir, 'secret.md'), join(dir, 'commands', 'linked.md'));

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.commands.map((c) => c.name)).toEqual(['ok']);
    expect(catalog.issues).toHaveLength(1);
    expect(catalog.issues[0]?.file).toBe('commands/linked.md');
    expect(catalog.issues[0]?.reason).toContain('symbolic link');
  });

  it('skips commands when the commands directory is a symlink', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], commands: ['jump'] } });
    await put('elsewhere/jump.md', commandMd());
    await symlink(join(dir, 'elsewhere'), join(dir, 'commands'));

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.commands).toEqual([]);
    expect(catalog.issues[0]?.file).toBe('commands/jump.md');
    expect(catalog.issues[0]?.reason).toContain('resolves outside');
  });

  it('rejects a command file above the size limit', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], commands: ['big'] } });
    await put('commands/big.md', `${commandMd()}${'x'.repeat(MAX_FILE_BYTES)}`);

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.commands).toEqual([]);
    expect(catalog.issues[0]?.file).toBe('commands/big.md');
    expect(catalog.issues[0]?.reason).toContain('file size');
  });

  it('resolves profile commands and drops profiles that reference unknown ones', async () => {
    await put('catalog.json', {
      version: 1,
      items: { mcps: [], commands: ['review'], profiles: ['ok', 'broken'] },
    });
    await put('commands/review.md', commandMd());
    await put('profiles/ok.json', { name: 'ok', commands: ['review'] });
    await put('profiles/broken.json', { name: 'broken', commands: ['ghost'] });

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.profiles.map((p) => p.name)).toEqual(['ok']);
    expect(catalog.issues[0]?.reason).toContain("unknown command 'ghost'");
  });

  it('loads an empty hooks list when items.hooks is absent', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [] } });
    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.hooks).toEqual([]);
    expect(catalog.issues).toEqual([]);
  });

  it('loads a valid hook', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], hooks: ['fmt'] } });
    await put('hooks/fmt.json', hookJson('fmt', { matcher: 'Edit|Write', timeout: 30 }));

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.issues).toEqual([]);
    expect(catalog.hooks).toEqual([
      {
        name: 'fmt',
        description: 'fmt hook',
        event: 'PostToolUse',
        command: 'run-fmt',
        matcher: 'Edit|Write',
        timeout: 30,
      },
    ]);
  });

  it('skips invalid hooks, reports each path and reason, and keeps the valid ones', async () => {
    await put('catalog.json', {
      version: 1,
      items: { mcps: [], hooks: ['good', 'nocmd', 'secret', 'renamed', 'broken', 'two'] },
    });
    await put('hooks/good.json', hookJson('good'));
    await put('hooks/nocmd.json', hookJson('nocmd', { command: '' }));
    await put('hooks/secret.json', hookJson('secret', { command: 'curl -H "Authorization: Bearer abc123def456ghi"' }));
    await put('hooks/renamed.json', hookJson('other'));
    await put('hooks/broken.json', '{ not json');
    await put('hooks/two.json', hookJson('two', { hooks: [{ type: 'command', command: 'x' }] }));

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.hooks.map((h) => h.name)).toEqual(['good']);
    expect(catalog.issues.map((i) => i.file)).toEqual([
      'hooks/nocmd.json',
      'hooks/secret.json',
      'hooks/renamed.json',
      'hooks/broken.json',
      'hooks/two.json',
    ]);
    expect(catalog.issues[0]?.reason).toContain('command');
    expect(catalog.issues[1]?.reason).toContain('literal secret');
    expect(catalog.issues[2]?.reason).toContain("does not match file name 'renamed'");
    expect(catalog.issues[4]?.reason).toContain('hooks');
  });

  it('flags a listed hook with no file', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], hooks: ['ghost'] } });
    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.hooks).toEqual([]);
    expect(catalog.issues).toEqual([
      { file: 'hooks/ghost.json', reason: 'listed in catalog.json but the file is missing' },
    ]);
  });

  it('flags an unlisted hooks/*.json file but ignores other entries', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], hooks: ['listed'] } });
    await put('hooks/listed.json', hookJson('listed'));
    await put('hooks/stray.json', hookJson('stray'));
    await put('hooks/.gitkeep', '');
    await put('hooks/pre.sh', 'echo hi');

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.hooks.map((h) => h.name)).toEqual(['listed']);
    expect(catalog.issues).toEqual([{ file: 'hooks/stray.json', reason: 'not listed in catalog.json' }]);
  });

  it('fails the catalog naming a hook entry that could traverse paths', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], hooks: ['../evil'] } });
    await expect(new FolderCatalogSource(dir, 'folder').load()).rejects.toThrow(/\.\.\/evil/);
  });

  it('skips a hook file that is a symlink', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], hooks: ['linked', 'ok'] } });
    await put('hooks/ok.json', hookJson('ok'));
    await put('secret.json', hookJson('linked'));
    await symlink(join(dir, 'secret.json'), join(dir, 'hooks', 'linked.json'));

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.hooks.map((h) => h.name)).toEqual(['ok']);
    expect(catalog.issues).toHaveLength(1);
    expect(catalog.issues[0]?.file).toBe('hooks/linked.json');
    expect(catalog.issues[0]?.reason).toContain('symbolic link');
  });

  it('skips hooks when the hooks directory is a symlink', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], hooks: ['jump'] } });
    await put('elsewhere/jump.json', hookJson('jump'));
    await symlink(join(dir, 'elsewhere'), join(dir, 'hooks'));

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.hooks).toEqual([]);
    expect(catalog.issues[0]?.file).toBe('hooks/jump.json');
    expect(catalog.issues[0]?.reason).toContain('resolves outside');
  });

  it('rejects a hook file above the size limit', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], hooks: ['big'] } });
    await put('hooks/big.json', hookJson('big', { description: 'x'.repeat(MAX_FILE_BYTES) }));

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.hooks).toEqual([]);
    expect(catalog.issues[0]?.file).toBe('hooks/big.json');
    expect(catalog.issues[0]?.reason).toContain('file size');
  });

  it('resolves profile hooks and drops profiles that reference unknown ones', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], hooks: ['fmt'], profiles: ['ok', 'broken'] } });
    await put('hooks/fmt.json', hookJson('fmt'));
    await put('profiles/ok.json', { name: 'ok', hooks: ['fmt'] });
    await put('profiles/broken.json', { name: 'broken', hooks: ['ghost'] });

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.profiles.map((p) => p.name)).toEqual(['ok']);
    expect(catalog.issues[0]?.reason).toContain("unknown hook 'ghost'");
  });
});
