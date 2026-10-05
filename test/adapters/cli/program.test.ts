import { mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FolderCatalogSource } from '@/adapters/catalog/folder-source.js';
import { renderBanner } from '@/adapters/cli/banner.js';
import { runCli, type CliDeps } from '@/adapters/cli/program.js';
import { claudeCodeTarget } from '@/adapters/claude-code/target.js';
import { NodeFileSystem } from '@/adapters/fs/node-fs.js';
import { PromptCancelled, type Prompter } from '@/ports/prompter.js';
import { parseDoc } from '@test/helpers/parse-doc.js';
import { makeTmpPaths, type TmpPaths } from '@test/helpers/tmp-paths.js';

const CATALOG = join(import.meta.dirname, '..', '..', '..', 'catalog');
const TOKEN = 'abc123-secret-value';

/** Scripted prompter; any call it was not scripted for fails the test. */
function fakePrompter(
  script: Partial<Record<'mcps' | 'skills' | 'scripts' | 'scope' | 'confirm', unknown>> & {
    conflict?: 'overwrite' | 'skip';
  } = {},
) {
  const calls: string[] = [];
  const conflicts: { kind: string; name: string; reason: string }[] = [];
  const unscripted = (name: string): never => {
    throw new Error(`unexpected prompt: ${name}`);
  };
  const prompter: Prompter = {
    selectMcps: () => (
      calls.push('mcps'),
      Promise.resolve((script.mcps as string[] | undefined) ?? unscripted('mcps'))
    ),
    selectSkills: () => (
      calls.push('skills'),
      Promise.resolve((script.skills as string[] | undefined) ?? unscripted('skills'))
    ),
    selectScripts: () => (
      calls.push('scripts'),
      Promise.resolve((script.scripts as string[] | undefined) ?? unscripted('scripts'))
    ),
    selectScope: () => (
      calls.push('scope'),
      Promise.resolve((script.scope as 'project' | 'user' | undefined) ?? unscripted('scope'))
    ),
    resolveConflict: (c) => (
      calls.push('conflict'),
      conflicts.push(c),
      Promise.resolve(script.conflict ?? unscripted('conflict'))
    ),
    confirm: () => (
      calls.push('confirm'),
      Promise.resolve((script.confirm as boolean | undefined) ?? unscripted('confirm'))
    ),
    info: () => {},
  };
  return { prompter, calls, conflicts };
}

describe('runCli', () => {
  let tmp: TmpPaths;
  let out: string[];
  let err: string[];
  let prompter: Prompter;
  let calls: string[];
  let conflicts: { kind: string; name: string; reason: string }[];
  let env: Record<string, string | undefined>;
  let updates: CliDeps['updates'];
  let cliVersion: string | undefined;
  let terminal: CliDeps['terminal'];
  const mcpFile = () => join(tmp.cwd, '.mcp.json');
  const text = () => [...out, ...err].join('\n');

  const run = (...args: string[]) => {
    const deps: CliDeps = {
      makeSource: (folder) => new FolderCatalogSource(folder ?? CATALOG, folder ? 'folder' : 'bundled'),
      fs: new NodeFileSystem(),
      target: claudeCodeTarget,
      paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
      env,
      prompter,
      out: (l) => out.push(l),
      err: (l) => err.push(l),
      updates,
      cliVersion,
      terminal,
    };
    return runCli(['node', 'shitaku', ...args], deps);
  };
  const usePrompter = (script?: Parameters<typeof fakePrompter>[0]) =>
    ({ prompter, calls, conflicts } = fakePrompter(script));

  beforeEach(async () => {
    tmp = await makeTmpPaths();
    out = [];
    err = [];
    env = { GITHUB_TOKEN: TOKEN };
    updates = undefined;
    cliVersion = undefined;
    terminal = undefined;
    usePrompter();
  });
  afterEach(() => tmp.cleanup());

  it('prints help and exits 0', async () => {
    expect(await run('--help')).toBe(0);
    expect(text()).toContain('init');
    expect(text()).toContain('undo');
  });

  describe('version', () => {
    it.each(['version', '-v', '--version'])('prints bare semver on stdout and exits 0 for %s', async (flag) => {
      cliVersion = '0.2.0';
      expect(await run(flag)).toBe(0);
      expect(out).toEqual(['0.2.0']);
      expect(err).toEqual([]);
    });

    it.each(['version', '-v', '--version'])(
      'fails with the exact stderr message when version is unreadable for %s',
      async (flag) => {
        expect(await run(flag)).toBe(1);
        expect(err).toEqual(['Unable to determine shitaku version.']);
        expect(out.join('\n')).not.toMatch(/\d+\.\d+\.\d+/);
      },
    );

    it('lists version in help and registers only -v/--version', async () => {
      cliVersion = '0.2.0';
      expect(await run('--help')).toBe(0);
      expect(text()).toContain('version');
      expect(text()).toMatch(/-v,\s*--version/);
      expect(text()).not.toMatch(/(?:^|\s)-V(?:\s|,|$)/);
    });
  });

  it('installs without prompting when --mcps and --scope are given', async () => {
    expect(await run('init', '--mcps', 'github', '--scope', 'project')).toBe(0);
    expect(parseDoc(await readFile(mcpFile(), 'utf8')).mcpServers.github?.type).toBe('http');
    expect(calls).toEqual([]);
  });

  it('prompts for MCPs, scope and confirmation interactively', async () => {
    usePrompter({ mcps: ['context7'], skills: [], scope: 'project', confirm: true });
    expect(await run('init')).toBe(0);
    expect(calls).toEqual(['mcps', 'skills', 'scope', 'confirm']);
    expect(Object.keys(parseDoc(await readFile(mcpFile(), 'utf8')).mcpServers)).toEqual(['context7']);
  });

  it('writes nothing when the confirmation is declined', async () => {
    usePrompter({ mcps: ['context7'], skills: [], scope: 'project', confirm: false });
    expect(await run('init')).toBe(0);
    await expect(readFile(mcpFile(), 'utf8')).rejects.toThrow();
    expect(await readdir(tmp.homeDir)).toEqual([]);
  });

  it('exits 1 when a prompt is cancelled', async () => {
    prompter.selectMcps = () => Promise.reject(new PromptCancelled());
    expect(await run('init')).toBe(1);
    expect(text()).toContain('cancelled');
  });

  it('exits non-zero naming an unknown MCP and writes nothing', async () => {
    expect(await run('init', '--mcps', 'ghost', '--scope', 'project')).toBe(1);
    expect(text()).toContain('ghost');
    expect(await readdir(tmp.cwd)).toEqual([]);
  });

  it('requires --scope with --yes', async () => {
    expect(await run('init', '--yes', '--mcps', 'github')).toBe(1);
    expect(text()).toContain('--scope');
    expect(calls).toEqual([]);
  });

  it('prints the plan and touches nothing on --dry-run', async () => {
    expect(await run('init', '--mcps', 'github', '--scope', 'user', '--dry-run')).toBe(0);
    expect(text()).toMatch(/github.*create/);
    expect(text()).toContain('close Claude Code');
    expect(await readdir(tmp.homeDir)).toEqual([]);
  });

  describe('skills', () => {
    const skillDir = () => join(tmp.cwd, '.claude', 'skills', 'example-skill');
    const skillFile = () => join(skillDir(), 'SKILL.md');
    const bundled = () => readFile(join(CATALOG, 'skills', 'example-skill', 'SKILL.md'), 'utf8');

    it('lists --skills in init help', async () => {
      expect(await run('init', '--help')).toBe(0);
      expect(text()).toContain('--skills');
    });

    it('installs only skills without touching the MCP file, then undo reverts it', async () => {
      expect(await run('init', '--skills', 'example-skill', '--scope', 'project')).toBe(0);
      expect(await readFile(skillFile(), 'utf8')).toBe(await bundled());
      await expect(readFile(mcpFile(), 'utf8')).rejects.toThrow();
      expect(calls).toEqual([]);
      expect(text()).not.toContain('.mcp.json');
      expect(text()).toContain(skillDir());
      expect(await run('undo')).toBe(0);
      await expect(readdir(join(tmp.cwd, '.claude'))).rejects.toThrow();
    });

    it('installs both kinds under one scope and undoes them together', async () => {
      expect(await run('init', '--yes', '--mcps', 'github', '--skills', 'example-skill', '--scope', 'project')).toBe(0);
      expect(parseDoc(await readFile(mcpFile(), 'utf8')).mcpServers.github).toBeDefined();
      expect(await readFile(skillFile(), 'utf8')).toBe(await bundled());
      expect(await run('undo')).toBe(0);
      await expect(readFile(mcpFile(), 'utf8')).rejects.toThrow();
      await expect(readFile(skillFile(), 'utf8')).rejects.toThrow();
    });

    it('installs at user scope', async () => {
      expect(await run('init', '--skills', 'example-skill', '--scope', 'user')).toBe(0);
      expect(await readFile(join(tmp.homeDir, '.claude', 'skills', 'example-skill', 'SKILL.md'), 'utf8')).toBe(
        await bundled(),
      );
    });

    it('exits 1 with --yes and neither --mcps nor --skills, writing nothing', async () => {
      expect(await run('init', '--yes', '--scope', 'project')).toBe(1);
      expect(text()).toContain('--mcps');
      expect(text()).toContain('--skills');
      expect(text()).toContain('--scripts');
      expect(calls).toEqual([]);
      expect(await readdir(tmp.cwd)).toEqual([]);
    });

    it('exits 1 naming an unknown skill and writes nothing', async () => {
      expect(await run('init', '--skills', 'ghost', '--scope', 'project')).toBe(1);
      expect(text()).toContain('ghost');
      expect(await readdir(tmp.cwd)).toEqual([]);
    });

    it('exits 1 when the target skill directory is a symlink, even with --force', async () => {
      await mkdir(join(tmp.cwd, '.claude', 'skills'), { recursive: true });
      await symlink(tmp.root, skillDir());
      expect(await run('init', '--skills', 'example-skill', '--scope', 'project', '--force')).toBe(1);
    });

    it('prints the plan and writes nothing on --dry-run', async () => {
      expect(await run('init', '--skills', 'example-skill', '--scope', 'project', '--dry-run')).toBe(0);
      expect(text()).toMatch(/example-skill.*create/);
      await expect(readdir(join(tmp.cwd, '.claude'))).rejects.toThrow();
      expect(await readdir(tmp.homeDir)).toEqual([]);
    });

    it('prompts for MCPs, skills, scope and confirmation, then installs the skill', async () => {
      usePrompter({ mcps: [], skills: ['example-skill'], scope: 'project', confirm: true });
      expect(await run('init')).toBe(0);
      expect(calls).toEqual(['mcps', 'skills', 'scope', 'confirm']);
      expect(await readFile(skillFile(), 'utf8')).toBe(await bundled());
      await expect(readFile(mcpFile(), 'utf8')).rejects.toThrow();
    });

    it('skips the skills prompt when the catalog has no skills', async () => {
      const dir = join(tmp.root, 'mcp-only');
      await mkdir(join(dir, 'mcps'), { recursive: true });
      await writeFile(join(dir, 'catalog.json'), JSON.stringify({ version: 1, items: { mcps: ['mine'] } }));
      await writeFile(
        join(dir, 'mcps', 'mine.json'),
        JSON.stringify({ name: 'mine', description: 'd', server: { type: 'stdio', command: 'x' } }),
      );
      usePrompter({ mcps: ['mine'], scope: 'project', confirm: true });
      expect(await run('init', '--source', dir)).toBe(0);
      expect(calls).toEqual(['mcps', 'scope', 'confirm']);
    });

    it('exits 1 when the interactive selection is empty for both kinds', async () => {
      usePrompter({ mcps: [], skills: [], scope: 'project' });
      expect(await run('init')).toBe(1);
      expect(text()).toMatch(/at least one/i);
      expect(calls).not.toContain('confirm');
    });

    it('writes nothing when the interactive confirmation is declined', async () => {
      usePrompter({ mcps: [], skills: ['example-skill'], scope: 'project', confirm: false });
      expect(await run('init')).toBe(0);
      await expect(readdir(join(tmp.cwd, '.claude'))).rejects.toThrow();
    });

    describe('conflicts', () => {
      const mine = '---\nname: example-skill\ndescription: mine\n---\n';
      beforeEach(async () => {
        await mkdir(skillDir(), { recursive: true });
        await writeFile(skillFile(), mine);
      });

      it('exits 2 non-interactively, reports it and leaves the user skill alone', async () => {
        expect(await run('init', '--skills', 'example-skill', '--scope', 'project')).toBe(2);
        expect(text()).toContain('example-skill');
        expect(text()).toContain('--force');
        expect(await readFile(skillFile(), 'utf8')).toBe(mine);
        expect(await readdir(skillDir())).toEqual(['SKILL.md']);
        expect(await readdir(tmp.homeDir)).toEqual([]);
        expect(calls).toEqual([]);
      });

      it('replaces the whole directory with --force after a backup, and undo restores it', async () => {
        await writeFile(join(skillDir(), 'notes.txt'), 'mine too');
        expect(await run('init', '--yes', '--force', '--skills', 'example-skill', '--scope', 'project')).toBe(0);
        expect(await readFile(skillFile(), 'utf8')).toBe(await bundled());
        expect(await readdir(skillDir())).toEqual(['SKILL.md']);
        expect(await run('undo')).toBe(0);
        expect(await readFile(skillFile(), 'utf8')).toBe(mine);
        expect(await readFile(join(skillDir(), 'notes.txt'), 'utf8')).toBe('mine too');
      });

      it('asks per skill conflict interactively and honours skip', async () => {
        usePrompter({ mcps: [], skills: ['example-skill'], scope: 'project', conflict: 'skip', confirm: true });
        expect(await run('init')).toBe(0);
        expect(conflicts.map((c) => [c.kind, c.name])).toEqual([['skill', 'example-skill']]);
        expect(conflicts[0]?.reason).toMatch(/different skill/);
        expect(await readFile(skillFile(), 'utf8')).toBe(mine);
      });

      it('asks per skill conflict interactively and honours overwrite', async () => {
        usePrompter({ mcps: [], skills: ['example-skill'], scope: 'project', conflict: 'overwrite', confirm: true });
        expect(await run('init')).toBe(0);
        expect(await readFile(skillFile(), 'utf8')).toBe(await bundled());
      });
    });
  });

  describe('conflicts', () => {
    const existing = { mcpServers: { github: { type: 'stdio', command: 'mine' } } };
    beforeEach(() => writeFile(mcpFile(), JSON.stringify(existing)));

    it('exits 2 with --yes and leaves the file alone', async () => {
      expect(await run('init', '--yes', '--mcps', 'github', '--scope', 'project')).toBe(2);
      expect(JSON.parse(await readFile(mcpFile(), 'utf8'))).toEqual(existing);
      expect(text()).toContain('--force');
    });

    it('exits 2 in flag-only mode instead of prompting', async () => {
      expect(await run('init', '--mcps', 'github', '--scope', 'project')).toBe(2);
      expect(calls).toEqual([]);
    });

    it('overwrites with --force', async () => {
      expect(await run('init', '--yes', '--force', '--mcps', 'github', '--scope', 'project')).toBe(0);
      expect(parseDoc(await readFile(mcpFile(), 'utf8')).mcpServers.github?.type).toBe('http');
    });

    it('asks per conflict interactively and honours skip', async () => {
      usePrompter({ mcps: ['github', 'context7'], skills: [], scope: 'project', conflict: 'skip', confirm: true });
      expect(await run('init')).toBe(0);
      const servers = parseDoc(await readFile(mcpFile(), 'utf8')).mcpServers;
      expect(servers.github?.command).toBe('mine');
      expect(servers.context7).toBeDefined();
      expect(calls).toContain('conflict');
      expect(conflicts[0]).toMatchObject({ kind: 'mcp', name: 'github' });
    });

    it('asks per conflict interactively and honours overwrite', async () => {
      usePrompter({ mcps: ['github'], skills: [], scope: 'project', conflict: 'overwrite', confirm: true });
      expect(await run('init')).toBe(0);
      expect(parseDoc(await readFile(mcpFile(), 'utf8')).mcpServers.github?.type).toBe('http');
    });
  });

  describe('env values', () => {
    it('warns about unset variables by name only', async () => {
      env = {};
      await run('init', '--mcps', 'github', '--scope', 'project', '--dry-run');
      expect(text()).toContain('GITHUB_TOKEN');
      expect(text()).toMatch(/not set/i);
    });

    it('never leaks a value into output or written files', async () => {
      await run('init', '--mcps', 'github', '--scope', 'user');
      await run('init', '--mcps', 'github', '--scope', 'project', '--dry-run');
      await run('undo', '--dry-run');
      expect(text()).not.toContain(TOKEN);
      const files = [join(tmp.homeDir, '.claude.json'), join(tmp.homeDir, '.claude', '.shitaku', 'manifest.json')];
      for (const f of files) expect(await readFile(f, 'utf8')).not.toContain(TOKEN);
    });
  });

  describe('--source', () => {
    it('reads a custom folder', async () => {
      const dir = join(tmp.root, 'custom');
      await mkdir(join(dir, 'mcps'), { recursive: true });
      await writeFile(join(dir, 'catalog.json'), JSON.stringify({ version: 1, items: { mcps: ['mine'] } }));
      await writeFile(
        join(dir, 'mcps', 'mine.json'),
        JSON.stringify({ name: 'mine', description: 'd', server: { type: 'stdio', command: 'x' } }),
      );
      expect(await run('init', '--source', dir, '--mcps', 'mine', '--scope', 'project')).toBe(0);
      expect(parseDoc(await readFile(mcpFile(), 'utf8')).mcpServers.mine?.command).toBe('x');
    });

    it('explains a malformed catalog.json instead of a stack trace', async () => {
      const dir = join(tmp.root, 'broken');
      await mkdir(dir);
      await writeFile(join(dir, 'catalog.json'), '{ not json');
      expect(await run('init', '--source', dir, '--mcps', 'x', '--scope', 'project')).toBe(1);
      expect(text()).toContain('cannot load catalog');
      expect(text()).toContain(dir);
      expect(text()).not.toContain('SyntaxError');
    });

    it('explains a missing source folder', async () => {
      expect(await run('init', '--source', join(tmp.root, 'nope'), '--mcps', 'x', '--scope', 'project')).toBe(1);
      expect(text()).toContain('cannot load catalog');
    });
  });

  describe('undo', () => {
    it('restores the original and reports it', async () => {
      await run('init', '--mcps', 'github', '--scope', 'project');
      expect(await run('undo')).toBe(0);
      await expect(readFile(mcpFile(), 'utf8')).rejects.toThrow();
      expect(text()).toMatch(/undone|restored/i);
    });

    it('reports nothing to undo without a manifest', async () => {
      expect(await run('undo')).toBe(0);
      expect(text()).toMatch(/nothing to undo/i);
    });

    it('exits 3 when a file changed since install, and --force restores it', async () => {
      await run('init', '--mcps', 'github', '--scope', 'project');
      await writeFile(mcpFile(), '{"edited":true}');
      expect(await run('undo')).toBe(3);
      expect(await readFile(mcpFile(), 'utf8')).toBe('{"edited":true}');
      expect(await run('undo', '--force')).toBe(0);
    });

    it('does not change anything on --dry-run', async () => {
      await run('init', '--mcps', 'github', '--scope', 'project');
      const before = await readFile(mcpFile(), 'utf8');
      expect(await run('undo', '--dry-run')).toBe(0);
      expect(await readFile(mcpFile(), 'utf8')).toBe(before);
    });

    it('exits 1 for an unknown --id', async () => {
      expect(await run('undo', '--id', 'nope')).toBe(1);
      expect(text()).toContain('nope');
    });
  });

  describe('uninstall', () => {
    const skillDir = () => join(tmp.cwd, '.claude', 'skills', 'example-skill');
    const userFile = () => join(tmp.homeDir, '.claude.json');
    const servers = async (path: string) => Object.keys(parseDoc(await readFile(path, 'utf8')).mcpServers);

    it('is listed in --help', async () => {
      await run('--help');
      expect(text()).toContain('uninstall');
    });

    it('removes an owned MCP, exits 0 and leaves the config valid', async () => {
      await run('init', '--mcps', 'github,context7', '--scope', 'project');
      expect(await run('uninstall', 'github')).toBe(0);
      expect(await servers(mcpFile())).toEqual(['context7']);
      expect(text()).toMatch(/uninstalled mcp 'github'/);
    });

    it('removes an owned skill, and undo brings it back', async () => {
      await run('init', '--skills', 'example-skill', '--scope', 'project');
      expect(await run('uninstall', 'example-skill', '--kind', 'skill')).toBe(0);
      await expect(readdir(skillDir())).rejects.toThrow();
      expect(await run('undo')).toBe(0);
      expect(await readdir(skillDir())).toEqual(['SKILL.md']);
    });

    it('exits 1 for a name shitaku does not own, even with --force', async () => {
      await writeFile(mcpFile(), '{"mcpServers":{"ghost":{"type":"stdio","command":"x"}}}');
      expect(await run('uninstall', 'ghost', '--force')).toBe(1);
      expect(err.join('\n')).toMatch(/^error: .*ghost.*not installed/);
      expect(await servers(mcpFile())).toEqual(['ghost']);
    });

    it('exits 1 listing the candidates when the scope is ambiguous, and --scope resolves it', async () => {
      await run('init', '--mcps', 'github', '--scope', 'project');
      await run('init', '--mcps', 'github', '--scope', 'user');
      expect(await run('uninstall', 'github')).toBe(1);
      expect(err.join('\n')).toMatch(/mcp \(project\), mcp \(user\)|mcp \(user\), mcp \(project\)/);
      expect(await servers(mcpFile())).toEqual(['github']);
      out.length = 0;
      expect(await run('uninstall', 'github', '--scope', 'user')).toBe(0);
      expect(await servers(userFile())).toEqual([]);
      expect(text()).toContain('close Claude Code');
    });

    it('rejects an unknown --kind value', async () => {
      expect(await run('uninstall', 'github', '--kind', 'plugin')).toBe(1);
    });

    it('exits 3 with the changed path and a --force hint, and --force removes', async () => {
      await run('init', '--mcps', 'github', '--scope', 'project');
      const edited = (await readFile(mcpFile(), 'utf8')).replace('"type"', '"x": 1, "type"');
      await writeFile(mcpFile(), edited);
      expect(await run('uninstall', 'github')).toBe(3);
      expect(err).toContain(`changed since install: ${mcpFile()}`);
      expect(err.join('\n')).toContain('--force');
      expect(await readFile(mcpFile(), 'utf8')).toBe(edited);
      expect(await run('uninstall', 'github', '--force')).toBe(0);
      expect(await servers(mcpFile())).toEqual([]);
    });

    it('--dry-run prints the plan and writes nothing, but exits 3 on a modified item', async () => {
      await run('init', '--mcps', 'github', '--scope', 'project');
      const before = await readFile(mcpFile(), 'utf8');
      expect(await run('uninstall', 'github', '--dry-run')).toBe(0);
      expect(text()).toMatch(/dry run: would remove .*\.mcp\.json/);
      expect(await readFile(mcpFile(), 'utf8')).toBe(before);
      const edited = before.replace('"type"', '"x": 1, "type"');
      await writeFile(mcpFile(), edited);
      expect(await run('uninstall', 'github', '--dry-run')).toBe(3);
      expect(await readFile(mcpFile(), 'utf8')).toBe(edited);
    });

    it('exits 1 and leaves the skill untouched when it holds a symlink, even with --force', async () => {
      await run('init', '--skills', 'example-skill', '--scope', 'project');
      await symlink(tmp.root, join(skillDir(), 'link.md'));
      expect(await run('uninstall', 'example-skill', '--force')).toBe(1);
      expect(err.join('\n')).toMatch(/^error: /);
      expect((await readdir(skillDir())).sort()).toEqual(['SKILL.md', 'link.md']);
    });

    it('reports an item that is already absent and exits 0', async () => {
      await run('init', '--skills', 'example-skill', '--scope', 'project');
      await rm(skillDir(), { recursive: true });
      expect(await run('uninstall', 'example-skill')).toBe(0);
      expect(text()).toMatch(/already absent/);
    });
  });

  describe('status', () => {
    const skillFile = () => join(tmp.cwd, '.claude', 'skills', 'example-skill', 'SKILL.md');
    const manifestFile = () => join(tmp.homeDir, '.claude', '.shitaku', 'manifest.json');
    const installBoth = async () => {
      await run('init', '--yes', '--mcps', 'github', '--skills', 'example-skill', '--scope', 'project');
      await run('init', '--mcps', 'context7', '--scope', 'user');
      out = [];
      err = [];
    };

    it('lists items per scope with target, kind, state and path', async () => {
      await installBoth();
      expect(await run('status')).toBe(0);
      expect(out).toEqual([
        'target: claude-code',
        'project scope:',
        '  mcps:',
        `    github: installed  ${mcpFile()}`,
        '  skills:',
        `    example-skill: installed  ${join(tmp.cwd, '.claude', 'skills', 'example-skill')}`,
        'user scope:',
        '  mcps:',
        `    context7: installed  ${join(tmp.homeDir, '.claude.json')}`,
      ]);
      expect(err).toEqual([]);
    });

    it('restricts the report to one scope with --scope', async () => {
      await installBoth();
      expect(await run('status', '--scope', 'user')).toBe(0);
      expect(out.filter((l) => l.startsWith('    '))).toHaveLength(1);
      expect(text()).toContain('context7');
      expect(text()).not.toContain('github');
    });

    it('says there are no managed items without a manifest', async () => {
      expect(await run('status')).toBe(0);
      expect(out).toEqual(['target: claude-code', 'no managed items']);
    });

    it('reports drift and exits 0', async () => {
      await installBoth();
      await writeFile(skillFile(), 'edited');
      await writeFile(mcpFile(), '{"mcpServers":{}}');
      expect(await run('status')).toBe(0);
      expect(text()).toMatch(/ {4}example-skill: modified/);
      expect(text()).toMatch(/ {4}github: missing/);
    });

    it('prints catalog unavailable and unknown states when the catalog fails to load', async () => {
      await installBoth();
      expect(await run('status', '--source', join(tmp.root, 'nope'))).toBe(0);
      expect(out[1]).toBe('catalog unavailable');
      expect(text()).toMatch(/ {4}example-skill: unknown/);
    });

    it('warns on stderr about skipped catalog entries without polluting stdout', async () => {
      const dir = join(tmp.root, 'partial');
      await mkdir(join(dir, 'mcps'), { recursive: true });
      await writeFile(join(dir, 'catalog.json'), JSON.stringify({ version: 1, items: { mcps: ['ghost'] } }));
      await writeFile(join(dir, 'mcps', 'ghost.json'), '{ not json');
      expect(await run('status', '--source', dir, '--json')).toBe(0);
      expect(err.join('\n')).toMatch(/warning: skipped .*ghost/);
      expect(JSON.parse(out.join('\n'))).toMatchObject({ catalog: 'available' });
    });

    describe('--json', () => {
      it('prints one versioned document with every item field', async () => {
        await installBoth();
        expect(await run('status', '--json')).toBe(0);
        expect(out).toHaveLength(1);
        const doc = JSON.parse(out[0] ?? '') as { version: number; items: Record<string, unknown>[] };
        expect(doc).toMatchObject({ version: 1, target: 'claude-code', catalog: 'available' });
        expect(doc.items).toHaveLength(3);
        expect(doc.items[0]).toEqual({
          scope: 'project',
          kind: 'mcp',
          name: 'github',
          state: 'installed',
          path: mcpFile(),
          installId: expect.stringMatching(/\S/) as string,
        });
        expect(err).toEqual([]);
      });

      it('reports an unavailable catalog as unknown with an empty-safe document', async () => {
        await installBoth();
        expect(await run('status', '--json', '--source', join(tmp.root, 'nope'))).toBe(0);
        const doc = JSON.parse(out.join('\n')) as { catalog: string; items: { state: string }[] };
        expect(doc.catalog).toBe('unavailable');
        expect(doc.items.map((i) => i.state)).toEqual(['unknown', 'unknown', 'unknown']);
      });

      it('prints an empty items list without a manifest', async () => {
        expect(await run('status', '--json')).toBe(0);
        expect(JSON.parse(out.join('\n'))).toEqual({
          version: 1,
          target: 'claude-code',
          catalog: 'available',
          items: [],
        });
      });
    });

    describe('corrupt manifest', () => {
      beforeEach(async () => {
        await mkdir(join(tmp.homeDir, '.claude', '.shitaku'), { recursive: true });
        await writeFile(manifestFile(), '{ not json');
      });

      it.each([
        ['status', ['status']],
        ['init', ['init', '--mcps', 'github', '--scope', 'project']],
        ['undo', ['undo']],
        ['uninstall', ['uninstall', 'github']],
        ['doctor', ['doctor']],
      ])('%s prints an error, no stack trace, and exits 1', async (_name, args) => {
        expect(await run(...args)).toBe(1);
        expect(err.join('\n')).toMatch(/^error: .*manifest/i);
        expect(text()).not.toMatch(/\n\s+at /);
        expect(out).toEqual([]);
      });
    });
  });

  describe('list', () => {
    interface Entry {
      name: string;
      description?: string;
    }
    /** Writes a folder catalog; profiles have no skills or MCPs of their own, so they always resolve. */
    const writeCatalog = async (
      name: string,
      items: { mcps?: Entry[]; skills?: Entry[]; scripts?: Entry[]; profiles?: Entry[] },
    ): Promise<string> => {
      const dir = join(tmp.root, name);
      const { mcps = [], skills = [], scripts = [], profiles = [] } = items;
      await mkdir(join(dir, 'mcps'), { recursive: true });
      await mkdir(join(dir, 'profiles'), { recursive: true });
      await writeFile(
        join(dir, 'catalog.json'),
        JSON.stringify({
          version: 1,
          items: {
            mcps: mcps.map((m) => m.name),
            skills: skills.map((s) => s.name),
            scripts: scripts.map((s) => s.name),
            profiles: profiles.map((p) => p.name),
          },
        }),
      );
      for (const m of mcps) {
        const server = { type: 'stdio', command: 'x' };
        await writeFile(join(dir, 'mcps', `${m.name}.json`), JSON.stringify({ ...m, server }));
      }
      for (const s of skills) {
        await mkdir(join(dir, 'skills', s.name), { recursive: true });
        await writeFile(
          join(dir, 'skills', s.name, 'SKILL.md'),
          `---\nname: ${s.name}\ndescription: ${s.description ?? ''}\n---\n`,
        );
      }
      for (const s of scripts) {
        await mkdir(join(dir, 'scripts', s.name), { recursive: true });
        await writeFile(
          join(dir, 'scripts', s.name, 'script.json'),
          JSON.stringify({ name: s.name, description: s.description ?? '', tools: [] }),
        );
        await writeFile(join(dir, 'scripts', s.name, 'index.mjs'), 'export default {};\n');
      }
      for (const p of profiles) await writeFile(join(dir, 'profiles', `${p.name}.json`), JSON.stringify(p));
      return dir;
    };
    const fullCatalog = () =>
      writeCatalog('full', {
        mcps: [
          { name: 'github-tools', description: 'GitHub\n  tools' },
          { name: 'fs', description: 'Filesystem access' },
        ],
        skills: [{ name: 'demo', description: 'Browser automation' }],
        profiles: [{ name: 'web', description: 'Web setup' }, { name: 'base' }],
      });

    it('rejects an invalid kind with the allowed choices, exit 1 and empty stdout', async () => {
      expect(await run('list', 'bogus')).toBe(1);
      expect(err.join('\n')).toContain('Allowed choices');
      expect(out).toEqual([]);
    });

    describe('text', () => {
      it('groups by kind with one aligned name column, collapsed descriptions and name-only profiles', async () => {
        expect(await run('list', '--source', await fullCatalog())).toBe(0);
        expect(out).toEqual([
          'mcps:',
          '  fs            Filesystem access',
          '  github-tools  GitHub tools',
          'profiles:',
          '  base',
          '  web           Web setup',
          'skills:',
          '  demo          Browser automation',
        ]);
        expect(err).toEqual([]);
      });

      it('lists only the requested kind', async () => {
        expect(await run('list', 'skills', '--source', await fullCatalog())).toBe(0);
        expect(out).toEqual(['skills:', '  demo  Browser automation']);
      });

      it('lists only scripts when asked', async () => {
        const dir = await writeCatalog('with-scripts', {
          scripts: [{ name: 'lint', description: 'Run lint' }],
        });
        expect(await run('list', 'scripts', '--source', dir)).toBe(0);
        expect(out).toEqual(['scripts:', '  lint  Run lint']);
      });

      it('includes scripts among all kinds', async () => {
        const dir = await writeCatalog('all-kinds', {
          mcps: [{ name: 'fs', description: 'Files' }],
          skills: [{ name: 'demo', description: 'Skill' }],
          scripts: [{ name: 'lint', description: 'Run lint' }],
          profiles: [{ name: 'base' }],
        });
        expect(await run('list', '--source', dir)).toBe(0);
        expect(out).toEqual([
          'mcps:',
          '  fs    Files',
          'profiles:',
          '  base',
          'scripts:',
          '  lint  Run lint',
          'skills:',
          '  demo  Skill',
        ]);
      });

      it('lists only profiles when asked, printing a profile without description as its name', async () => {
        expect(await run('list', 'profiles', '--source', await fullCatalog())).toBe(0);
        expect(out).toEqual(['profiles:', '  base', '  web   Web setup']);
      });

      it('searches descriptions case-insensitively', async () => {
        expect(await run('list', '--search', 'BROWSER', '--source', await fullCatalog())).toBe(0);
        expect(out).toEqual(['skills:', '  demo  Browser automation']);
      });

      it('searches names and combines with the kind filter', async () => {
        const dir = await writeCatalog('search', {
          mcps: [{ name: 'fs', description: 'Files' }],
          skills: [{ name: 'fs-tips', description: 'Tips' }],
        });
        expect(await run('list', '--search', 'fs', '--source', dir)).toBe(0);
        expect(out).toEqual(['mcps:', '  fs       Files', 'skills:', '  fs-tips  Tips']);
        out = [];
        expect(await run('list', 'mcps', '--search', 'fs', '--source', dir)).toBe(0);
        expect(out).toEqual(['mcps:', '  fs  Files']);
      });

      it('prints no matching items and exits 0 when nothing matches', async () => {
        expect(await run('list', '--search', 'zzz-nothing', '--source', await fullCatalog())).toBe(0);
        expect(out).toEqual(['no matching items']);
      });

      it('lists the bundled catalog with a header per kind', async () => {
        expect(await run('list')).toBe(0);
        expect(out.filter((l) => !l.startsWith(' '))).toEqual(['mcps:', 'profiles:', 'skills:']);
        expect(out).toContainEqual(expect.stringMatching(/^ {2}github\s+\S/));
      });
    });

    describe('--json', () => {
      it('prints one versioned document with flat items sorted by kind then name', async () => {
        expect(await run('list', '--json', '--source', await fullCatalog())).toBe(0);
        expect(out).toHaveLength(1);
        expect(JSON.parse(out[0] ?? '')).toEqual({
          version: 1,
          items: [
            { kind: 'mcp', name: 'fs', description: 'Filesystem access' },
            { kind: 'mcp', name: 'github-tools', description: 'GitHub\n  tools' },
            { kind: 'profile', name: 'base', description: null },
            { kind: 'profile', name: 'web', description: 'Web setup' },
            { kind: 'skill', name: 'demo', description: 'Browser automation' },
          ],
        });
        expect(out[0]).toContain('\n  "version": 1');
        expect(err).toEqual([]);
      });

      it('applies the kind filter and search', async () => {
        expect(await run('list', 'profiles', '--json', '--search', 'web', '--source', await fullCatalog())).toBe(0);
        expect(JSON.parse(out.join('\n'))).toEqual({
          version: 1,
          items: [{ kind: 'profile', name: 'web', description: 'Web setup' }],
        });
      });

      it('prints scripts with singular JSON kind script', async () => {
        const dir = await writeCatalog('json-scripts', {
          scripts: [{ name: 'demo', description: 'Demo script' }],
        });
        expect(await run('list', '--json', '--source', dir)).toBe(0);
        expect(JSON.parse(out.join('\n'))).toEqual({
          version: 1,
          items: [{ kind: 'script', name: 'demo', description: 'Demo script' }],
        });
      });

      it('prints an empty items list and exits 0 when nothing matches', async () => {
        expect(await run('list', '--json', '--search', 'zzz-nothing', '--source', await fullCatalog())).toBe(0);
        expect(JSON.parse(out.join('\n'))).toEqual({ version: 1, items: [] });
      });

      it('warns on stderr about skipped entries while stdout stays parseable', async () => {
        const dir = await writeCatalog('partial', { mcps: [{ name: 'ok', description: 'Fine' }] });
        await writeFile(join(dir, 'catalog.json'), JSON.stringify({ version: 1, items: { mcps: ['ok', 'ghost'] } }));
        await writeFile(join(dir, 'mcps', 'ghost.json'), '{ not json');
        expect(await run('list', '--json', '--source', dir)).toBe(0);
        expect(err.join('\n')).toMatch(/^warning: skipped mcps\/ghost\.json: /);
        expect(JSON.parse(out.join('\n'))).toEqual({
          version: 1,
          items: [{ kind: 'mcp', name: 'ok', description: 'Fine' }],
        });
      });
    });

    describe('load failure', () => {
      it.each(['text', 'json'])(
        'explains a missing source folder in %s mode and prints nothing on stdout',
        async (mode) => {
          const missing = join(tmp.root, 'nope');
          const args = mode === 'json' ? ['--json'] : [];
          expect(await run('list', ...args, '--source', missing)).toBe(1);
          expect(err).toHaveLength(1);
          expect(err[0]).toMatch(new RegExp(`^error: cannot load catalog from ${missing}: \\S`));
          expect(out).toEqual([]);
        },
      );

      it('explains a malformed catalog.json instead of a stack trace', async () => {
        const dir = join(tmp.root, 'broken');
        await mkdir(dir);
        await writeFile(join(dir, 'catalog.json'), '{ not json');
        expect(await run('list', '--source', dir)).toBe(1);
        expect(err[0]).toContain(`error: cannot load catalog from ${dir}: `);
        expect(text()).not.toMatch(/\n\s+at /);
        expect(out).toEqual([]);
      });
    });

    it('lists a name used by both an MCP and a skill in both groups', async () => {
      const dir = await writeCatalog('dupes', {
        mcps: [{ name: 'shared', description: 'As MCP' }],
        skills: [{ name: 'shared', description: 'As skill' }],
      });
      expect(await run('list', '--source', dir)).toBe(0);
      expect(out).toEqual(['mcps:', '  shared  As MCP', 'skills:', '  shared  As skill']);
    });

    it('never writes to the project or home directory', async () => {
      expect(await run('list', '--source', await fullCatalog())).toBe(0);
      expect(await run('list', '--json')).toBe(0);
      expect(await readdir(tmp.cwd)).toEqual([]);
      expect(await readdir(tmp.homeDir)).toEqual([]);
    });

    it('warns on stderr about skipped entries in text mode and still lists the rest', async () => {
      const dir = await writeCatalog('partial-text', { mcps: [{ name: 'ok', description: 'Fine' }] });
      await writeFile(join(dir, 'catalog.json'), JSON.stringify({ version: 1, items: { mcps: ['ok', 'ghost'] } }));
      await writeFile(join(dir, 'mcps', 'ghost.json'), '{ not json');
      expect(await run('list', '--source', dir)).toBe(0);
      expect(err.join('\n')).toMatch(/^warning: skipped mcps\/ghost\.json: /);
      expect(out).toEqual(['mcps:', '  ok  Fine']);
    });
  });

  describe('update notice', () => {
    const NOTICE = 'Update available: shitaku 0.2.0 -> 0.3.0. Run: npm install -g @jsisques/shitaku';
    let asked: number;
    const useUpdates = (latest: string | null, currentVersion = '0.2.0') => {
      asked = 0;
      updates = {
        currentVersion,
        interactive: true,
        source: {
          latest: () => {
            asked++;
            return Promise.resolve(latest);
          },
        },
      };
    };

    it('prints the notice on stderr after the command, leaving stdout alone', async () => {
      useUpdates('0.3.0');
      expect(await run('status')).toBe(0);
      expect(err).toEqual([NOTICE]);
      expect(out).not.toContain(NOTICE);
    });

    it('prints nothing when already on the latest version', async () => {
      useUpdates('0.2.0');
      expect(await run('status')).toBe(0);
      expect(err).toEqual([]);
    });

    it('keeps status --json stdout parseable and unchanged', async () => {
      useUpdates('0.3.0');
      expect(await run('status', '--json')).toBe(0);
      expect(JSON.parse(out.join('\n'))).toEqual({
        version: 1,
        target: 'claude-code',
        catalog: 'available',
        items: [],
      });
      expect(err).toEqual([NOTICE]);
    });

    it('keeps the exit code of a failing command and still prints the notice', async () => {
      useUpdates('0.3.0');
      expect(await run('init', '--yes')).toBe(1);
      expect(err).toEqual(['error: select at least one kind: pass --mcps, --skills and/or --scripts', NOTICE]);
    });

    it('does not check without updates settings', async () => {
      useUpdates('0.3.0');
      updates = undefined;
      expect(await run('status')).toBe(0);
      expect(asked).toBe(0);
      expect(err).toEqual([]);
    });

    it.each(['version', '-v', '--version'])(
      'does not start the update check for %s even when updates are wired',
      async (flag) => {
        useUpdates('0.3.0');
        cliVersion = '0.2.0';
        expect(await run(flag)).toBe(0);
        expect(asked).toBe(0);
        expect(err).toEqual([]);
        expect(out).toEqual(['0.2.0']);
      },
    );

    it('still notifies on non-version commands when an update is available', async () => {
      useUpdates('0.3.0');
      cliVersion = '0.2.0';
      expect(await run('status')).toBe(0);
      expect(asked).toBe(1);
      expect(err).toEqual([NOTICE]);
    });
  });

  describe('doctor', () => {
    const skillDir = () => join(tmp.cwd, '.claude', 'skills', 'example-skill');
    const install = async () => {
      await run('init', '--yes', '--mcps', 'github', '--skills', 'example-skill', '--scope', 'project');
      out = [];
      err = [];
    };
    const breakSkill = () => rm(skillDir(), { recursive: true });
    const jsonDoc = () =>
      JSON.parse(out.join('\n')) as {
        version: number;
        target: string;
        healthy: boolean;
        summary: { problems: number; info: number };
        findings: Record<string, unknown>[];
      };

    it('exits 0 and says no problems found on a healthy setup', async () => {
      await install();
      expect(await run('doctor')).toBe(0);
      expect(out).toEqual(['target: claude-code', 'no problems found']);
      expect(err).toEqual([]);
    });

    it('exits 4 when a problem exists and shows the item, message, fix and summary', async () => {
      await install();
      await breakSkill();
      expect(await run('doctor')).toBe(4);
      expect(out).toEqual([
        'target: claude-code',
        'problems:',
        `  project skill example-skill is missing at ${skillDir()}`,
        '    fix: run shitaku init again to reinstall the skill',
        '1 problems, 0 info',
      ]);
    });

    it('exits 0 and lists info findings when only info exists', async () => {
      await install();
      await writeFile(join(skillDir(), 'SKILL.md'), 'edited');
      expect(await run('doctor')).toBe(0);
      expect(out).toContain('info:');
      expect(text()).toContain('project skill example-skill: modified since install');
      expect(out.at(-1)).toBe('0 problems, 1 info');
    });

    it('restricts the diagnosis with --scope', async () => {
      await install();
      await breakSkill();
      expect(await run('doctor', '--scope', 'user')).toBe(0);
      expect(out).toEqual(['target: claude-code', 'no problems found']);
    });

    it('prints one versioned JSON document with every finding field', async () => {
      await install();
      await breakSkill();
      expect(await run('doctor', '--json')).toBe(4);
      expect(out).toHaveLength(1);
      expect(jsonDoc()).toEqual({
        version: 1,
        target: 'claude-code',
        healthy: false,
        summary: { problems: 1, info: 0 },
        findings: [
          {
            severity: 'problem',
            code: 'skill-missing',
            scope: 'project',
            kind: 'skill',
            name: 'example-skill',
            path: skillDir(),
            message: expect.stringMatching(/example-skill/) as string,
            fix: expect.stringMatching(/\S/) as string,
          },
        ],
      });
    });

    it('prints a healthy JSON document and exits 0', async () => {
      await install();
      expect(await run('doctor', '--json')).toBe(0);
      expect(jsonDoc()).toEqual({
        version: 1,
        target: 'claude-code',
        healthy: true,
        summary: { problems: 0, info: 0 },
        findings: [],
      });
    });

    it('warns on stderr when the catalog is unavailable and keeps stdout one JSON document', async () => {
      await install();
      await breakSkill();
      expect(await run('doctor', '--json', '--source', join(tmp.root, 'nope'))).toBe(4);
      expect(err.join('\n')).toMatch(/^warning: .*catalog/);
      expect(jsonDoc().findings.map((f) => f.code)).toEqual(['skill-missing']);
    });

    it('reports out-of-date as info with exit 0 using the catalog given by --source', async () => {
      const dir = join(tmp.root, 'custom');
      await mkdir(join(dir, 'mcps'), { recursive: true });
      await writeFile(join(dir, 'catalog.json'), JSON.stringify({ version: 1, items: { mcps: ['mine'] } }));
      const publish = (command: string) =>
        writeFile(
          join(dir, 'mcps', 'mine.json'),
          JSON.stringify({ name: 'mine', description: 'd', server: { type: 'stdio', command } }),
        );
      await publish('x');
      await run('init', '--source', dir, '--mcps', 'mine', '--scope', 'project');
      await publish('y');
      out = [];
      expect(await run('doctor', '--source', dir, '--json')).toBe(0);
      expect(jsonDoc().findings).toMatchObject([{ severity: 'info', code: 'out-of-date', name: 'mine' }]);
    });

    it('never prints environment values, only names, in text or JSON', async () => {
      await install();
      env = { SENTINEL: 's3cret-sentinel-value' };
      for (const args of [['doctor'], ['doctor', '--json'], ['doctor', '--json', '--source', join(tmp.root, 'nope')]]) {
        out = [];
        err = [];
        expect(await run(...args)).toBe(4);
        expect(text()).toContain('GITHUB_TOKEN');
        expect(text()).not.toContain('s3cret-sentinel-value');
      }
    });

    it('writes nothing', async () => {
      await install();
      await breakSkill();
      const before = await readFile(mcpFile(), 'utf8');
      const manifest = await readFile(join(tmp.homeDir, '.claude', '.shitaku', 'manifest.json'), 'utf8');
      await run('doctor');
      expect(await readFile(mcpFile(), 'utf8')).toBe(before);
      expect(await readFile(join(tmp.homeDir, '.claude', '.shitaku', 'manifest.json'), 'utf8')).toBe(manifest);
      await expect(readdir(skillDir())).rejects.toThrow();
    });
  });

  describe('banner', () => {
    const plain = (version?: string) =>
      renderBanner({ version, color: false, unicode: false }).map((line) => stripVTControlCharacters(line));
    const shown = () => stripVTControlCharacters(err.join('\n'));
    const art = () => plain()[1] ?? '';

    const interactive = () => {
      usePrompter({ mcps: ['context7'], skills: [], scope: 'project', confirm: true });
      terminal = { tty: true, color: false, unicode: false };
      cliVersion = '0.2.0';
    };

    it('prints the banner on stderr before the first prompt and leaves stdout alone', async () => {
      interactive();
      const selectMcps = prompter.selectMcps.bind(prompter);
      let atPrompt: string[] = [];
      prompter.selectMcps = (mcps) => {
        atPrompt = [...err];
        return selectMcps(mcps);
      };
      expect(await run('init')).toBe(0);
      expect(atPrompt).toEqual(plain('0.2.0'));
      expect(out.join('\n')).not.toContain(art());
    });

    it('colors the banner only when color is enabled', async () => {
      interactive();
      terminal = { tty: true, color: true, unicode: false };
      expect(await run('init')).toBe(0);
      expect(err.join('\n')).toContain('\u001b[');
      expect(shown()).toContain(art());

      out = [];
      err = [];
      terminal = { tty: true, color: false, unicode: false };
      expect(await run('init')).toBe(0);
      expect(err.join('\n')).not.toContain('\u001b[');
    });

    it('adds the kanji mark only when unicode is enabled', async () => {
      interactive();
      terminal = { tty: true, color: false, unicode: true };
      expect(await run('init')).toBe(0);
      expect(err.join('\n')).toContain('支度');

      out = [];
      err = [];
      terminal = { tty: true, color: false, unicode: false };
      expect(await run('init')).toBe(0);
      expect(err.join('\n')).not.toContain('支度');
    });

    it('omits the version line when the version is unreadable', async () => {
      interactive();
      cliVersion = undefined;
      expect(await run('init')).toBe(0);
      expect(err).toEqual(plain());
      expect(err.join('\n')).not.toContain('Get your agent environment ready');
    });

    it.each([
      ['not a tty', { tty: false, color: false, unicode: false }, {}],
      ['CI', { tty: true, color: false, unicode: false }, { CI: 'true' }],
      ['empty is not CI', { tty: true, color: false, unicode: false }, { CI: '' }],
    ])('respects the terminal and CI (%s)', async (label, term, extra) => {
      interactive();
      terminal = term;
      env = { ...env, ...extra };
      expect(await run('init')).toBe(0);
      if (label === 'empty is not CI') expect(shown()).toContain(art());
      else expect(shown()).not.toContain(art());
    });

    it.each([
      ['1', false],
      ['true', false],
      ['yes', false],
      ['TRUE', false],
      ['Yes', false],
      ['', true],
      ['0', true],
      ['false', true],
      ['no', true],
    ])('SHITAKU_NO_BANNER=%s shows the banner: %s', async (value, shows) => {
      interactive();
      env = { ...env, SHITAKU_NO_BANNER: value };
      expect(await run('init')).toBe(0);
      if (shows) expect(shown()).toContain(art());
      else expect(shown()).not.toContain(art());
    });

    it.each([
      ['before the command', ['--no-banner', 'init']],
      ['after the command', ['init', '--no-banner']],
    ])('hides the banner with --no-banner %s', async (_label, args) => {
      interactive();
      expect(await run(...args)).toBe(0);
      expect(calls).toEqual(['mcps', 'skills', 'scope', 'confirm']);
      expect(shown()).not.toContain(art());
    });

    it.each([
      ['--yes', ['init', '--yes', '--mcps', 'github', '--scope', 'project']],
      ['kind and scope', ['init', '--mcps', 'github', '--scope', 'project']],
    ])('skips the banner for non-interactive init (%s)', async (_label, args) => {
      terminal = { tty: true, color: false, unicode: false };
      cliVersion = '0.2.0';
      expect(await run(...args)).toBe(0);
      expect(calls).toEqual([]);
      expect(shown()).not.toContain(art());
    });

    it('still prints the banner when init will prompt for the remaining answers', async () => {
      usePrompter({ scope: 'project', confirm: true });
      terminal = { tty: true, color: false, unicode: false };
      cliVersion = '0.2.0';
      expect(await run('init', '--mcps', 'github')).toBe(0);
      expect(calls).toEqual(['scope', 'confirm']);
      expect(shown()).toContain(art());
    });

    it.each([
      ['status', ['status', '--json']],
      ['list', ['list', '--json']],
      ['doctor', ['doctor', '--json']],
    ])('does not print the banner for %s --json', async (_name, args) => {
      terminal = { tty: true, color: true, unicode: true };
      cliVersion = '0.2.0';
      expect(await run(...args)).toBe(0);
      expect(shown()).not.toContain(art());
      expect(out.join('\n')).not.toContain(art());
      expect(JSON.parse(out.join('\n')) as unknown).toEqual(expect.any(Object));
    });

    it.each(['version', '-v', '--version'])('does not print the banner for %s', async (flag) => {
      terminal = { tty: true, color: true, unicode: true };
      cliVersion = '0.2.0';
      expect(await run(flag)).toBe(0);
      expect(out).toEqual(['0.2.0']);
      expect(err).toEqual([]);
    });

    it('lists --no-banner in help and does not print the banner', async () => {
      terminal = { tty: true, color: true, unicode: true };
      cliVersion = '0.2.0';
      expect(await run('--help')).toBe(0);
      expect(text()).toContain('--no-banner');
      expect(shown()).not.toContain(art());
      out = [];
      err = [];
      expect(await run('init', '--help')).toBe(0);
      expect(text()).toContain('--no-banner');
      expect(shown()).not.toContain(art());
    });

    it('keeps the exit code when a prompt is cancelled', async () => {
      terminal = { tty: true, color: false, unicode: false };
      cliVersion = '0.2.0';
      prompter.selectMcps = () => Promise.reject(new PromptCancelled());
      expect(await run('init')).toBe(1);
      expect(shown()).toContain(art());
      expect(out.join('\n')).not.toContain(art());
    });
  });
});
