import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { claudeCodeTarget } from '@/adapters/claude-code/target.js';
import { NodeFileSystem } from '@/adapters/fs/node-fs.js';
import { getDiagnosis } from '@/application/doctor.js';
import { initMcps, type InitDeps } from '@/application/init-mcps.js';
import { undoInstall } from '@/application/undo-install.js';
import type { McpItem } from '@/domain/catalog/schema.js';
import type { SkillItem } from '@/domain/catalog/skill.js';
import type { LoadedCatalog } from '@/ports/catalog-source.js';
import { REVIEW_V1 } from '@test/helpers/commands.js';
import { DEMO_V1, DEMO_V2 } from '@test/helpers/skills.js';
import { SCRIPT_V1 } from '@test/helpers/scripts.js';
import { makeTmpPaths, type TmpPaths } from '@test/helpers/tmp-paths.js';

const mcp = (name: string, url: string, extra: Partial<McpItem> = {}): McpItem => ({
  name,
  description: name,
  server: { type: 'http', url },
  env: [],
  ...extra,
});

const GITHUB = mcp('github', 'https://example.com/github');
const TOKENED = mcp('tokened', 'https://example.com/tokened', {
  server: { type: 'http', url: 'https://example.com/tokened', headers: { Authorization: 'Bearer ${DOCTOR_TOKEN}' } },
  env: [{ name: 'DOCTOR_TOKEN', required: true }],
});

describe('getDiagnosis', () => {
  let tmp: TmpPaths;
  let catalog: LoadedCatalog | Error;
  let env: Record<string, string | undefined>;
  const fs = new NodeFileSystem();
  const source = {
    ref: () => ({ kind: 'folder' as const, location: '/catalog' }),
    load: () => (catalog instanceof Error ? Promise.reject(catalog) : Promise.resolve(catalog)),
  };
  const setCatalog = (mcps: McpItem[], skills: SkillItem[] = []): void => {
    catalog = { mcps, skills, scripts: [], commands: [], hooks: [], profiles: [], issues: [] };
  };
  const paths = () => ({ homeDir: tmp.homeDir, cwd: tmp.cwd });
  const deps = (): InitDeps => ({ source, fs, target: claudeCodeTarget, paths: paths(), env });
  const projectFile = () => join(tmp.cwd, '.mcp.json');
  const userFile = () => join(tmp.homeDir, '.claude.json');
  const projectSkill = () => join(tmp.cwd, '.claude', 'skills', 'demo');
  const codes = async (req: { scope?: 'project' | 'user' } = {}) =>
    (await getDiagnosis(deps(), req)).findings.map((f) => `${f.severity}:${f.code}:${f.scope}:${f.name}`);

  beforeEach(async () => {
    tmp = await makeTmpPaths();
    env = {};
    setCatalog([GITHUB, TOKENED], [DEMO_V1]);
  });
  afterEach(() => tmp.cleanup());

  const installProject = () => initMcps(deps(), { mcps: ['github'], skills: ['demo'], scope: 'project' });

  it('reports no findings for a healthy install and surfaces the catalog state', async () => {
    await installProject();
    const report = await getDiagnosis(deps(), {});
    expect(report).toEqual({ target: 'claude-code', catalog: 'available', issues: [], findings: [] });
  });

  it('reports no findings for an empty manifest', async () => {
    expect((await getDiagnosis(deps(), {})).findings).toEqual([]);
  });

  it('reports a deleted config file once, not once per item', async () => {
    await initMcps(deps(), { mcps: ['github', 'tokened'], scope: 'project' });
    env = { DOCTOR_TOKEN: 'x' };
    await rm(projectFile());
    expect(await codes()).toEqual(['problem:config-missing:project:null']);
  });

  it('reports a deleted MCP entry', async () => {
    await installProject();
    await writeFile(projectFile(), JSON.stringify({ mcpServers: {} }));
    expect(await codes()).toEqual(['problem:mcp-missing:project:github']);
  });

  it('reports a corrupt config file as unreadable', async () => {
    await installProject();
    await writeFile(projectFile(), '{ not json');
    expect(await codes()).toEqual(['problem:config-unreadable:project:null']);
  });

  it('reports a deleted skill directory', async () => {
    await installProject();
    await rm(projectSkill(), { recursive: true });
    expect(await codes()).toEqual(['problem:skill-missing:project:demo']);
  });

  it('reports a deleted command file, and nothing for a healthy or directory-replaced one', async () => {
    const file = join(tmp.cwd, '.claude', 'commands', 'review.md');
    catalog = { ...(catalog as LoadedCatalog), commands: [REVIEW_V1] };
    await initMcps(deps(), { mcps: [], commands: ['review'], scope: 'project' });
    expect(await codes()).toEqual([]);
    await rm(file);
    expect(await codes()).toEqual(['problem:command-missing:project:review']);
    await mkdir(file);
    expect(await codes()).toEqual(['info:modified:project:review']);
  });

  it('reports a required variable that is unset, by name, and clears it once set', async () => {
    await initMcps(deps(), { mcps: ['tokened'], scope: 'project' });
    const report = await getDiagnosis(deps(), {});
    expect(report.findings).toEqual([expect.objectContaining({ code: 'env-unset', variable: 'DOCTOR_TOKEN' })]);
    env = { DOCTOR_TOKEN: 'present' };
    expect((await getDiagnosis(deps(), {})).findings).toEqual([]);
  });

  it('never leaks environment values into the report', async () => {
    const sentinel = 'SENTINEL-SECRET-VALUE-123';
    await initMcps(deps(), { mcps: ['tokened'], scope: 'project' });
    env = { DOCTOR_TOKEN: '', OTHER: sentinel };
    await writeFile(projectFile(), (await readFile(projectFile(), 'utf8')).replace('example.com', 'mine.dev'));
    const json = JSON.stringify(await getDiagnosis(deps(), {}));
    expect(json).toContain('DOCTOR_TOKEN');
    expect(json).not.toContain(sentinel);
  });

  it('reports a project MCP that is also installed in user scope', async () => {
    await initMcps(deps(), { mcps: ['github'], scope: 'user' });
    await initMcps(deps(), { mcps: ['github'], scope: 'project' });
    expect(await codes()).toEqual(['problem:duplicate-mcp:project:github']);
    expect(await codes({ scope: 'user' })).toEqual([]);
  });

  it('reports modified and out-of-date as info only', async () => {
    await installProject();
    await writeFile(projectFile(), (await readFile(projectFile(), 'utf8')).replace('/github', '/mine'));
    setCatalog([GITHUB], [DEMO_V2]);
    expect(await codes()).toEqual(['info:modified:project:github', 'info:out-of-date:project:demo']);
  });

  it('ignores undone installs', async () => {
    await installProject();
    await undoInstall({ fs, paths: paths() });
    await rm(projectFile(), { force: true });
    expect(await codes()).toEqual([]);
  });

  it('restricts findings to the requested scope', async () => {
    await initMcps(deps(), { mcps: ['github'], scope: 'user' });
    await installProject();
    await rm(projectFile());
    await rm(userFile());
    expect(await codes({ scope: 'project' })).toEqual(['problem:config-missing:project:null']);
    expect(await codes({ scope: 'user' })).toEqual(['problem:config-missing:user:null']);
  });

  it('drops only out-of-date when the catalog cannot be loaded and reports it unavailable', async () => {
    await installProject();
    await rm(join(projectSkill(), 'refs/a.md'));
    await writeFile(projectFile(), JSON.stringify({ mcpServers: {} }));
    setCatalog([GITHUB], [DEMO_V2]);
    const online = await codes();
    catalog = new Error('catalog down');
    const report = await getDiagnosis(deps(), {});
    expect(report.catalog).toBe('unavailable');
    expect(report.findings.map((f) => `${f.severity}:${f.code}:${f.name}`)).toEqual([
      'problem:mcp-missing:github',
      'info:modified:demo',
    ]);
    expect(online).toContain('problem:mcp-missing:project:github');
  });

  it('never writes: every file keeps its bytes', async () => {
    await installProject();
    await writeFile(projectFile(), '{ not json');
    const before = [await readFile(projectFile(), 'utf8'), await readFile(join(projectSkill(), 'SKILL.md'), 'utf8')];
    await getDiagnosis(deps(), {});
    const after = [await readFile(projectFile(), 'utf8'), await readFile(join(projectSkill(), 'SKILL.md'), 'utf8')];
    expect(after).toEqual(before);
  });

  it('warns when an installed script tool is missing from local .bin and stays healthy', async () => {
    const withTool = {
      ...SCRIPT_V1,
      tools: ['knip'],
      files: SCRIPT_V1.files.map((f) =>
        f.path === 'script.json'
          ? { ...f, bytes: new TextEncoder().encode('{"name":"lint","description":"d","tools":["knip"]}') }
          : f,
      ),
    };
    catalog = { mcps: [], skills: [], scripts: [withTool], commands: [], hooks: [], profiles: [], issues: [] };
    await initMcps(deps(), { mcps: [], skills: [], scripts: ['lint'], scope: 'project' });
    const report = await getDiagnosis(deps(), {});
    expect(report.findings).toEqual([
      expect.objectContaining({
        severity: 'info',
        code: 'script-tool-missing',
        name: 'lint',
        tool: 'knip',
      }),
    ]);
    expect(report.findings.every((f) => f.severity === 'info')).toBe(true);
  });

  it('reports script-tool-missing info for each of complexity five D2A tools when binless', async () => {
    const tools = ['eslint', 'eslint-plugin-sonarjs', 'typescript-eslint', 'typescript', '@eslint/js'];
    const complexity = {
      name: 'complexity',
      description: 'd',
      tools,
      files: [
        { path: 'index.mjs', bytes: new TextEncoder().encode('export default 1;\n') },
        {
          path: 'script.json',
          bytes: new TextEncoder().encode(JSON.stringify({ name: 'complexity', description: 'd', tools })),
        },
      ],
    };
    catalog = { mcps: [], skills: [], scripts: [complexity], commands: [], hooks: [], profiles: [], issues: [] };
    await initMcps(deps(), { mcps: [], skills: [], scripts: ['complexity'], scope: 'project' });
    const report = await getDiagnosis(deps(), {});
    const missing = report.findings.filter((f) => f.code === 'script-tool-missing');
    expect(missing).toHaveLength(5);
    expect(missing.map((f) => f.tool).sort()).toEqual([...tools].sort());
    expect(missing.every((f) => f.severity === 'info' && f.name === 'complexity')).toBe(true);
  });
});
