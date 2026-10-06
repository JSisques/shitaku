import { spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO = join(import.meta.dirname, '..', '..', '..');
const CATALOG_SCRIPT = join(REPO, 'catalog', 'scripts', 'dead-code');
const FIXTURES = join(REPO, 'test', 'fixtures', 'dead-code');

const FINDING_KINDS = ['files', 'exports', 'types', 'dependencies', 'devDependencies', 'unlisted'] as const;

type FindingKind = (typeof FINDING_KINDS)[number];
type Finding = { file: string; name: string; line?: number; col?: number };
type DeadCodeReport = {
  schema: string;
  tool: string;
  findings: Record<FindingKind, Finding[]>;
};
type RunResult = { code: number | null; stdout: string; stderr: string };
type KnipIssues = { issues: Record<string, unknown>[] };

async function runDeadCode(
  scriptRoot: string,
  args: string[],
  opts: { cwd: string; env?: NodeJS.ProcessEnv } = { cwd: REPO },
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(scriptRoot, 'index.mjs'), ...args], {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function copyScriptRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'shitaku-dead-code-'));
  await cp(CATALOG_SCRIPT, root, { recursive: true });
  return root;
}

async function copyFixture(name: string): Promise<string> {
  const project = await mkdtemp(join(tmpdir(), `dead-code-${name}-`));
  await cp(join(FIXTURES, name), project, { recursive: true });
  return project;
}

/** Mock knip in cwd `.bin` that emits controlled JSON (avoids flaky npx). */
async function installMockKnip(project: string, payload: KnipIssues, opts: { failParse?: boolean } = {}) {
  const binDir = join(project, 'node_modules', '.bin');
  await mkdir(binDir, { recursive: true });
  const outPath = join(project, '.mock-knip-output.json');
  await writeFile(outPath, opts.failParse ? '{not-json' : JSON.stringify(payload));
  const shim = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
if (args.includes('--fix')) {
  console.error('mock-knip: --fix unexpected');
  process.exit(99);
}
if (!args.includes('--reporter') || !args.includes('json')) {
  console.error('mock-knip: expected --reporter json');
  process.exit(2);
}
process.stdout.write(fs.readFileSync(path.join(process.cwd(), '.mock-knip-output.json'), 'utf8'));
process.exit(0);
`;
  await writeFile(join(binDir, 'knip'), shim, { mode: 0o755 });
}

/** Fake `npx` on PATH that delegates to the same mock payload (no network). */
async function installFakeNpx(project: string, payload: KnipIssues): Promise<string> {
  const binDir = await mkdtemp(join(tmpdir(), 'fake-npx-'));
  const outPath = join(project, '.mock-knip-output.json');
  await writeFile(outPath, JSON.stringify(payload));
  const npx = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
if (args[0] !== 'knip') {
  console.error('fake-npx: expected knip');
  process.exit(2);
}
if (args.includes('--fix')) {
  console.error('fake-npx: --fix unexpected');
  process.exit(99);
}
process.stdout.write(fs.readFileSync(path.join(process.cwd(), '.mock-knip-output.json'), 'utf8'));
process.exit(0);
`;
  await writeFile(join(binDir, 'npx'), npx, { mode: 0o755 });
  return binDir;
}

function emptyFindings(): DeadCodeReport['findings'] {
  return {
    files: [],
    exports: [],
    types: [],
    dependencies: [],
    devDependencies: [],
    unlisted: [],
  };
}

function parseReport(stdout: string): DeadCodeReport {
  return JSON.parse(stdout) as DeadCodeReport;
}

function assertEnvelopeShape(report: DeadCodeReport) {
  expect(report.schema).toBe('shitaku.catalog.dead-code/v1');
  expect(report.tool).toBe('dead-code');
  for (const kind of FINDING_KINDS) {
    expect(Array.isArray(report.findings[kind]), kind).toBe(true);
  }
}

describe('catalog dead-code script', () => {
  let scriptRoot: string;

  beforeAll(async () => {
    scriptRoot = await copyScriptRoot();
  });

  afterAll(async () => {
    if (scriptRoot) await rm(scriptRoot, { recursive: true, force: true });
  });

  describe('exit 0/1 on fixtures', () => {
    it('exits 0 for a clean project with no unused findings', async () => {
      const project = await copyFixture('clean');
      try {
        await installMockKnip(project, { issues: [] });
        const result = await runDeadCode(scriptRoot, [], { cwd: project });
        expect(result.stderr, result.stderr).not.toMatch(/not implemented/i);
        expect(result.code).toBe(0);
        const report = parseReport(result.stdout);
        assertEnvelopeShape(report);
        expect(report.findings).toEqual(emptyFindings());
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });

    it('exits 1 when unused export findings are present', async () => {
      const project = await copyFixture('unused-export');
      try {
        await installMockKnip(project, {
          issues: [
            {
              file: 'index.js',
              exports: [{ name: 'unusedExport', line: 5, col: 17 }],
            },
          ],
        });
        const result = await runDeadCode(scriptRoot, [], { cwd: project });
        expect(result.code).toBe(1);
        const report = parseReport(result.stdout);
        expect(report.findings.exports).toEqual([
          expect.objectContaining({ file: 'index.js', name: 'unusedExport', line: 5 }),
        ]);
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });

    it('exits 1 when an unused file is reported', async () => {
      const project = await copyFixture('unused-file');
      try {
        await installMockKnip(project, {
          issues: [{ file: 'orphan.js', files: [{ name: 'orphan.js' }] }],
        });
        const result = await runDeadCode(scriptRoot, [], { cwd: project });
        expect(result.code).toBe(1);
        const report = parseReport(result.stdout);
        expect(report.findings.files).toEqual([expect.objectContaining({ file: 'orphan.js', name: 'orphan.js' })]);
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });
  });

  describe('JSON envelope, formats, and sort', () => {
    it('emits schema/tool and all six findings keys with stable sort', async () => {
      const project = await copyFixture('unused-export');
      try {
        await installMockKnip(project, {
          issues: [
            {
              file: 'b.js',
              exports: [
                { name: 'z', line: 2 },
                { name: 'a', line: 1 },
              ],
            },
            {
              file: 'a.js',
              exports: [{ name: 'm', line: 3 }],
            },
          ],
        });
        const result = await runDeadCode(scriptRoot, [], { cwd: project });
        expect(result.code).toBe(1);
        const report = parseReport(result.stdout);
        assertEnvelopeShape(report);
        expect(report.findings.files).toEqual([]);
        expect(report.findings.types).toEqual([]);
        expect(report.findings.dependencies).toEqual([]);
        expect(report.findings.devDependencies).toEqual([]);
        expect(report.findings.unlisted).toEqual([]);
        expect(report.findings.exports.map((e) => `${e.file}:${e.name}:${e.line}`)).toEqual([
          'a.js:m:3',
          'b.js:a:1',
          'b.js:z:2',
        ]);
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });

    it('prints text rows with --format text and rejects unsupported formats', async () => {
      const project = await copyFixture('unused-export');
      try {
        await installMockKnip(project, {
          issues: [{ file: 'index.js', exports: [{ name: 'unusedExport', line: 5 }] }],
        });
        const text = await runDeadCode(scriptRoot, ['--format', 'text'], { cwd: project });
        expect(text.code).toBe(1);
        let textIsJson = true;
        try {
          JSON.parse(text.stdout);
        } catch {
          textIsJson = false;
        }
        expect(textIsJson).toBe(false);
        expect(text.stdout).toMatch(/exports\tindex\.js\tunusedExport/);

        const bad = await runDeadCode(scriptRoot, ['--format', 'yaml'], { cwd: project });
        expect(bad.code).toBe(2);
        expect(bad.stderr).toMatch(/unsupported --format/i);
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });
  });

  describe('include filter and dependency classification', () => {
    it('filters to --include exports and ignores other kinds for exit 1', async () => {
      const project = await copyFixture('unused-export');
      try {
        await installMockKnip(project, {
          issues: [
            { file: 'orphan.js', files: [{ name: 'orphan.js' }] },
            { file: 'index.js', exports: [{ name: 'unusedExport', line: 5 }] },
          ],
        });
        const onlyExports = await runDeadCode(scriptRoot, ['--include', 'exports'], { cwd: project });
        expect(onlyExports.code).toBe(1);
        const report = parseReport(onlyExports.stdout);
        expect(report.findings.exports).toHaveLength(1);
        expect(report.findings.files).toEqual([]);

        const onlyFiles = await runDeadCode(scriptRoot, ['--include', 'files'], {
          cwd: project,
        });
        expect(onlyFiles.code).toBe(1);
        expect(parseReport(onlyFiles.stdout).findings.files).toHaveLength(1);
        expect(parseReport(onlyFiles.stdout).findings.exports).toEqual([]);

        // Included kinds empty → exit 0 even when knip reported other kinds.
        const noneIncluded = await runDeadCode(scriptRoot, ['--include', 'types'], { cwd: project });
        expect(noneIncluded.code).toBe(0);
        expect(parseReport(noneIncluded.stdout).findings.types).toEqual([]);
        expect(parseReport(noneIncluded.stdout).findings.exports).toEqual([]);

        const unknown = await runDeadCode(scriptRoot, ['--include', 'binaries'], { cwd: project });
        expect(unknown.code).toBe(2);
        expect(unknown.stderr).toMatch(/unknown --include|unsupported --include/i);
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });

    it('splits knip dependencies via package.json into dependencies vs devDependencies', async () => {
      const project = await copyFixture('unused-deps');
      try {
        const pkgPath = join(project, 'package.json');
        const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as Record<string, unknown>;
        pkg.peerDependencies = { 'peer-pkg': '1.0.0' };
        pkg.optionalDependencies = { 'optional-pkg': '1.0.0' };
        await writeFile(pkgPath, JSON.stringify(pkg, null, 2));

        await installMockKnip(project, {
          issues: [
            {
              file: 'package.json',
              dependencies: [
                { name: 'lodash' },
                { name: 'unused-dev' },
                { name: 'ambiguous-pkg' },
                { name: 'peer-pkg' },
                { name: 'optional-pkg' },
              ],
              unlisted: [{ name: 'rimraf' }],
            },
          ],
        });
        const result = await runDeadCode(scriptRoot, [], { cwd: project });
        expect(result.code).toBe(1);
        const report = parseReport(result.stdout);
        expect(report.findings.dependencies.map((d) => d.name).sort()).toEqual([
          'ambiguous-pkg',
          'lodash',
          'optional-pkg',
          'peer-pkg',
        ]);
        expect(report.findings.devDependencies).toEqual([
          expect.objectContaining({ name: 'unused-dev', file: 'package.json' }),
        ]);
        expect(report.findings.unlisted).toEqual([expect.objectContaining({ name: 'rimraf' })]);
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });
  });

  describe('knip config policy', () => {
    it('respects consumer knip.json ignoreIssues for exports (mock: empty exports)', async () => {
      const project = await copyFixture('with-config');
      try {
        // Consumer config would hide the export; mock emits what knip would after config.
        await installMockKnip(project, { issues: [] });
        const result = await runDeadCode(scriptRoot, [], { cwd: project });
        expect(result.code).toBe(0);
        const report = parseReport(result.stdout);
        expect(report.findings.exports).toEqual([]);
        const files = await readdir(CATALOG_SCRIPT);
        expect(files).not.toContain('knip.json');
        expect(files).not.toContain('knip.config.js');
        expect(files).not.toContain('knip.config.mjs');
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });

    it('reports unused exports under knip defaults when no consumer config', async () => {
      const project = await copyFixture('defaults');
      try {
        await installMockKnip(project, {
          issues: [{ file: 'index.js', exports: [{ name: 'unusedWithoutConfig', line: 5 }] }],
        });
        const result = await runDeadCode(scriptRoot, [], { cwd: project });
        expect(result.code).toBe(1);
        const report = parseReport(result.stdout);
        expect(report.findings.exports.some((e) => e.name === 'unusedWithoutConfig')).toBe(true);
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });
  });

  describe('tool resolution', () => {
    it('uses cwd node_modules/.bin/knip when present', async () => {
      const project = await copyFixture('clean');
      try {
        await installMockKnip(project, { issues: [] });
        const result = await runDeadCode(scriptRoot, [], { cwd: project });
        expect(result.code).toBe(0);
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });

    it('falls back to npx knip when no local bin exists', async () => {
      const project = await copyFixture('clean');
      let fakeBin = '';
      try {
        await installFakeNpx(project, { issues: [] }).then((dir) => {
          fakeBin = dir;
        });
        const result = await runDeadCode(scriptRoot, [], {
          cwd: project,
          env: { PATH: `${fakeBin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}` },
        });
        expect(result.code).toBe(0);
        const report = parseReport(result.stdout);
        assertEnvelopeShape(report);
      } finally {
        await rm(project, { recursive: true, force: true });
        if (fakeBin) await rm(fakeBin, { recursive: true, force: true });
      }
    });
  });

  describe('threat: no-fix and fatal failures', () => {
    it('rejects --fix with exit 2 and does not mutate package.json', async () => {
      const project = await copyFixture('unused-deps');
      try {
        await installMockKnip(project, { issues: [] });
        const before = await readFile(join(project, 'package.json'), 'utf8');
        const beforeIndex = await readFile(join(project, 'index.js'), 'utf8');
        const result = await runDeadCode(scriptRoot, ['--fix'], { cwd: project });
        expect(result.code).toBe(2);
        expect(result.stderr).toMatch(/--fix/i);
        const after = await readFile(join(project, 'package.json'), 'utf8');
        const afterIndex = await readFile(join(project, 'index.js'), 'utf8');
        expect(after).toBe(before);
        expect(afterIndex).toBe(beforeIndex);
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });

    it('exits 2 when knip JSON cannot be parsed', async () => {
      const project = await copyFixture('clean');
      try {
        await installMockKnip(project, { issues: [] }, { failParse: true });
        const before = await readFile(join(project, 'package.json'), 'utf8');
        const result = await runDeadCode(scriptRoot, [], { cwd: project });
        expect(result.code).toBe(2);
        const after = await readFile(join(project, 'package.json'), 'utf8');
        expect(after).toBe(before);
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });

    it('exits 2 when knip binary cannot be spawned', async () => {
      const project = await copyFixture('clean');
      try {
        const binDir = join(project, 'node_modules', '.bin');
        await mkdir(binDir, { recursive: true });
        // Non-executable garbage that spawn will fail to run as node script meaningfully —
        // use a binary that exits via missing interpreter by being empty with no shebang...
        // Better: knip shim that exits 2 with no stdout (script treats missing JSON as fail).
        await writeFile(join(binDir, 'knip'), '#!/bin/sh\necho "fatal" >&2\nexit 2\n', { mode: 0o755 });
        const result = await runDeadCode(scriptRoot, [], { cwd: project });
        expect(result.code).toBe(2);
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });
  });

  describe('real knip smoke (local install)', () => {
    let realProject: string | undefined;

    beforeAll(async () => {
      realProject = await copyFixture('unused-export');
      // Install real knip into the fixture copy once.
      await new Promise<void>((resolve, reject) => {
        const child = spawn('npm', ['install', '--omit=dev', '--no-save', 'knip@6.39.0'], {
          cwd: realProject,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
          env: process.env,
        });
        let stderr = '';
        child.stderr?.on('data', (c: Buffer) => {
          stderr += c.toString();
        });
        child.on('error', reject);
        child.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`npm install knip failed: ${stderr}`));
        });
      });
    }, 180_000);

    afterAll(async () => {
      if (realProject) await rm(realProject, { recursive: true, force: true });
    });

    it('reports unusedExport via real knip without catalog bootstrap', async () => {
      expect(realProject).toBeTruthy();
      const result = await runDeadCode(scriptRoot!, [], { cwd: realProject! });
      expect(result.code).toBe(1);
      const report = parseReport(result.stdout);
      assertEnvelopeShape(report);
      expect(report.findings.exports.some((e) => e.name === 'unusedExport')).toBe(true);
      const scriptFiles = await readdir(CATALOG_SCRIPT);
      expect(scriptFiles).toEqual(expect.arrayContaining(['index.mjs', 'script.json']));
      expect(scriptFiles).not.toContain('package.json');
      expect(scriptFiles).not.toContain('node_modules');
    }, 180_000);

    it('honors consumer knip.json ignoreIssues with real knip', async () => {
      const project = await copyFixture('with-config');
      try {
        await cp(join(realProject!, 'node_modules'), join(project, 'node_modules'), { recursive: true });
        const result = await runDeadCode(scriptRoot!, [], { cwd: project });
        expect(result.code).toBe(0);
        const report = parseReport(result.stdout);
        expect(report.findings.exports.some((e) => e.name === 'ignoredUnusedExport')).toBe(false);
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    }, 180_000);
  });
});
